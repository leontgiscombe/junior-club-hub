// Telling a club's admins and coaches that someone has asked to join, or that
// a parent has asked for kit: an email to each, and an alert on any phone
// they've turned alerts on for (Your Account → Alerts). Club admins hear about
// every join request; a coach hears about requests for their own team (or
// every one, if they have no team). Kit requests go to the team's own coaches
// (the admins only if it has none). No message has children's names in it.
// Server only.
import { createHash } from "crypto";
import webpush from "web-push";
import { joinAlertsKey, kvCall, type Person } from "./access";
import { sendEmail, simpleEmail } from "./email";
import { rawKv } from "./kv";
import { listPeople } from "./people";
import { getTenantRecord } from "./tenants";
import { setUpVapid, vapidKeys } from "./vapid";
import { DEFAULT_TENANT, PLATFORM_NAME, tenantUrl } from "./tenant";

const REPEAT_GAP_SECONDS = 1800; // someone sending the form again within half an hour isn't news

/** A phone's alert subscription, kept by its endpoint. */
type Alert = { userId: string; endpoint: string; keys: { p256dh: string; auth: string }; addedAt: string };

export const pushConfigured = async () => !!(await vapidKeys());

/** Whether `person` should hear about a request for `teams` (no teams: every coach). */
function wantsToHear(person: Person, teams: string[]): boolean {
  if (person.status !== "approved") return false;
  if (person.roles.includes("admin")) return true;
  if (!person.roles.includes("coach")) return false;
  return !teams.length || !person.team || teams.includes(person.team.slug);
}

export async function addJoinAlert(tenant: string, userId: string, sub: { endpoint: string; keys: Alert["keys"] }) {
  const alert: Alert = { userId, endpoint: sub.endpoint, keys: sub.keys, addedAt: new Date().toISOString() };
  await kvCall(["HSET", joinAlertsKey(tenant), sub.endpoint, JSON.stringify(alert)]);
}

export async function removeJoinAlert(tenant: string, endpoint: string) {
  await kvCall(["HDEL", joinAlertsKey(tenant), endpoint]);
}

export async function hasJoinAlert(tenant: string, endpoint: string): Promise<boolean> {
  return !!(await kvCall(["HEXISTS", joinAlertsKey(tenant), endpoint]));
}

async function listAlerts(tenant: string): Promise<Alert[]> {
  const flat = (await kvCall<string[]>(["HGETALL", joinAlertsKey(tenant)])) ?? [];
  const out: Alert[] = [];
  for (let i = 1; i < flat.length; i += 2) {
    try {
      out.push(JSON.parse(flat[i]) as Alert);
    } catch {}
  }
  return out;
}

/** Let the right admins and coaches know `name` has asked to join. Never throws. */
export async function notifyJoinRequest(
  tenant: string,
  request: { userId: string; name: string; who: string; teams: string[]; clubName: string },
): Promise<void> {
  try {
    const kv = await rawKv();
    if (kv && !(await kv.set(`platform:join-alert:${tenant}:${request.userId}`, 1, { nx: true, ex: REPEAT_GAP_SECONDS }))) {
      console.log(`Join request alerts (${tenant}): skipped — the same person asked again within 30 minutes`);
      return;
    }
    const people = (await listPeople(tenant)).filter((p) => wantsToHear(p, request.teams));
    const line = `${request.name} (${request.who}) has asked to join ${request.clubName}'s hub.`;
    const membersUrl = tenantUrl(tenant, "/admin/members");

    // email: everyone who should hear, plus the club's own address (its first admin, who may not have signed in yet)
    const emails = new Set(people.map((p) => p.email.toLowerCase()));
    if (tenant !== DEFAULT_TENANT) {
      const record = await getTenantRecord(tenant);
      if (record?.email) emails.add(record.email.toLowerCase());
    }
    const message = simpleEmail({
      heading: "A new request to join",
      paragraphs: [line, "Approve or decline them in Coach Admin → Members."],
      button: { label: "Open Members", url: membersUrl },
      footer: `${PLATFORM_NAME} · ${tenantUrl(tenant)}`,
    });
    await Promise.all(
      [...emails].map((to) =>
        sendEmail({ to, subject: `Someone wants to join ${request.clubName}`, ...message }).catch(() => false),
      ),
    );

    await pushTo(tenant, people, emails.size, "Join request", {
      title: "New request to join",
      body: `${line} Tap to approve or decline.`,
      url: "/admin/members",
    });
  } catch (e) {
    console.error("Join request alerts not sent:", e);
  }
}

/** Let the right admins and coaches know an approved parent has added a child to approve. Never throws. */
/** A parent has taken a child (a squad player) off their account: the child may have left the club. */
export async function notifyChildRemoved(
  tenant: string,
  request: { userId: string; parentName: string; playerIds: string[]; teams: string[]; clubName: string },
): Promise<void> {
  try {
    // each child once in half an hour (saving again isn't news)
    const kv = await rawKv();
    let fresh = 0;
    for (const id of request.playerIds) {
      if (!kv || (await kv.set(`platform:child-removed:${tenant}:${request.userId}:${id}`, 1, { nx: true, ex: REPEAT_GAP_SECONDS }))) fresh++;
    }
    if (!fresh) return;
    const people = (await listPeople(tenant)).filter((p) => p.userId !== request.userId && wantsToHear(p, request.teams));
    // no children's names in emails or alerts
    const line = `${request.parentName} has removed ${fresh === 1 ? "a child" : `${fresh} children`} from their account at ${request.clubName}.`;
    const membersUrl = tenantUrl(tenant, "/admin/members");
    const emails = new Set(people.map((p) => p.email.toLowerCase()));
    const message = simpleEmail({
      heading: "A child removed from a parent's account",
      paragraphs: [
        line,
        "They're still in the squad. If they've left the club, delete them from the squad in Coach Admin → Members (that stops their subs too); otherwise there's nothing to do.",
      ],
      button: { label: "Open Members", url: membersUrl },
      footer: `${PLATFORM_NAME} · ${tenantUrl(tenant)}`,
    });
    await Promise.all(
      [...emails].map((to) => sendEmail({ to, subject: `A child removed from a parent's account at ${request.clubName}`, ...message }).catch(() => false)),
    );
    await pushTo(tenant, people, emails.size, "Child removed", {
      title: "A child removed from a parent's account",
      body: `${line} Tap to check Members.`,
      url: "/admin/members",
    });
  } catch (e) {
    console.error("Child removed alerts not sent:", e);
  }
}

export async function notifyChildRequest(
  tenant: string,
  request: { userId: string; parentName: string; childNames: string[]; teams: string[]; clubName: string },
): Promise<void> {
  try {
    // each child once in half an hour (a parent saving the same child again
    // isn't news), but a second child added straight after still is
    const kv = await rawKv();
    const fresh: string[] = [];
    for (const name of request.childNames) {
      const key = `platform:child-alert:${tenant}:${request.userId}:${createHash("sha256").update(name.trim().toLowerCase()).digest("hex").slice(0, 16)}`;
      if (!kv || (await kv.set(key, 1, { nx: true, ex: REPEAT_GAP_SECONDS }))) fresh.push(name);
    }
    if (!fresh.length) {
      console.log(`Child request alerts (${tenant}): not sent — the same child was added in the last ${REPEAT_GAP_SECONDS / 60} minutes`);
      return;
    }
    const people = (await listPeople(tenant)).filter((p) => wantsToHear(p, request.teams));
    // no children's names in emails or alerts
    const line = `${request.parentName} has added a child to ${request.clubName}'s hub.`;
    const membersUrl = tenantUrl(tenant, "/admin/members");
    const emails = new Set(people.map((p) => p.email.toLowerCase()));
    const message = simpleEmail({
      heading: "A child to approve",
      paragraphs: [line, "Add them to the squad, or decline, in Coach Admin → Members."],
      button: { label: "Open Members", url: membersUrl },
      footer: `${PLATFORM_NAME} · ${tenantUrl(tenant)}`,
    });
    await Promise.all(
      [...emails].map((to) => sendEmail({ to, subject: `A child to approve at ${request.clubName}`, ...message }).catch(() => false)),
    );
    await pushTo(tenant, people, emails.size, "Child request", {
      title: "A child to approve",
      body: `${line} Tap to approve or decline.`,
      url: "/admin/members",
    });
  } catch (e) {
    console.error("Child request alerts not sent:", e);
  }
}

/** Alerts on the phones `people` have turned alerts on for; `what` names it in the log. */
async function pushTo(
  tenant: string,
  people: Person[],
  emailed: number,
  what: string,
  message: { title: string; body: string; url: string },
): Promise<void> {
  const ids = new Set(people.map((p) => p.userId));
  const alerts = (await listAlerts(tenant)).filter((a) => ids.has(a.userId));
  // counts only — no names or addresses in the log
  const summary = `${people.length} admins/coaches, ${emailed} emails, ${alerts.length} phones`;
  if (!alerts.length) {
    console.log(`${what} alerts (${tenant}): ${summary}`);
    return;
  }
  if (!(await setUpVapid(tenantUrl(tenant)))) {
    console.log(`${what} alerts (${tenant}): ${summary} — no keys to send phone alerts with`);
    return;
  }
  let sent = 0;
  const payload = JSON.stringify(message);
  await Promise.all(
    alerts.map(async (a) => {
      try {
        await webpush.sendNotification({ endpoint: a.endpoint, keys: a.keys }, payload);
        sent++;
      } catch (err) {
        // a phone that's turned alerts off, or a browser that's gone
        const code = (err as { statusCode?: number })?.statusCode;
        console.log(`${what} alert to a phone refused (${code ?? "no status"})`);
        if (code === 403 || code === 404 || code === 410) await removeJoinAlert(tenant, a.endpoint).catch(() => {});
      }
    }),
  );
  console.log(`${what} alerts (${tenant}): ${summary}, ${sent} phone alerts sent`);
}

/** Let a team's coaches know a parent has asked for kit — one or more items, in one alert. Never throws. */
export async function notifyKitRequest(
  tenant: string,
  request: { team: string; teamName: string; items: { item: string; size: string; quantity: number }[]; clubName: string },
): Promise<void> {
  try {
    const approved = (await listPeople(tenant)).filter((p) => p.status === "approved");
    const teamCoaches = approved.filter((p) => p.roles.includes("coach") && p.team?.slug === request.team);
    // no coach of the team's own: the admins, and coaches who look after every team
    const people = teamCoaches.length
      ? teamCoaches
      : approved.filter((p) => p.roles.includes("admin") || (p.roles.includes("coach") && !p.team));
    const one = (i: { item: string; size: string; quantity: number }) => `${i.quantity > 1 ? `${i.quantity} × ` : ""}${i.item} (${i.size})`;
    const what =
      request.items.length === 1
        ? `${request.items[0].quantity > 1 ? "" : "a "}${one(request.items[0])}`
        : `${request.items.length} items: ${request.items.map(one).join(", ")}`;
    const line = `A parent has asked for ${what} for a ${request.teamName} player.`;
    const url = `/admin/kit?team=${encodeURIComponent(request.team)}`;

    const message = simpleEmail({
      heading: "A kit request",
      paragraphs: [line, "See who it's for, and mark it done, in Coach Admin → Kit Responses."],
      button: { label: "Open Kit Responses", url: tenantUrl(tenant, url) },
      footer: `${PLATFORM_NAME} · ${tenantUrl(tenant)}`,
    });
    const emails = new Set(people.map((p) => p.email.toLowerCase()));
    await Promise.all(
      [...emails].map((to) =>
        sendEmail({ to, subject: `Kit request – ${request.teamName}`, ...message }).catch(() => false),
      ),
    );
    await pushTo(tenant, people, emails.size, "Kit request", { title: "Kit request", body: `${line} Tap to see it.`, url });
  } catch (e) {
    console.error("Kit request alerts not sent:", e);
  }
}

/** A test alert to one of `userId`'s own phones. Returns why it failed, or null if the push service took it. */
export async function sendTestAlert(tenant: string, userId: string, endpoint: string): Promise<string | null> {
  const alert = (await listAlerts(tenant)).find((a) => a.endpoint === endpoint && a.userId === userId);
  if (!alert) return "This phone's alerts aren't on — turn them off and on again";
  if (!(await setUpVapid(tenantUrl(tenant)))) return "Phone alerts aren't set up on this hub";
  try {
    await webpush.sendNotification(
      { endpoint: alert.endpoint, keys: alert.keys },
      JSON.stringify({ title: "Test alert", body: "Join request alerts are working on this phone.", url: "/account#alerts" }),
    );
    return null;
  } catch (err) {
    const code = (err as { statusCode?: number })?.statusCode;
    if (code === 403 || code === 404 || code === 410) {
      await removeJoinAlert(tenant, alert.endpoint).catch(() => {});
      return "This phone's subscription has expired — turn alerts off and on again";
    }
    console.error("Test alert not sent:", err);
    return `The alert service refused it${code ? ` (${code})` : ""}`;
  }
}
