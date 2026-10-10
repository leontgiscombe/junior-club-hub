// Telling a club's admins and coaches that someone has asked to join: an
// email to each, and an alert on any phone they've turned alerts on for
// (Coach Admin). Club admins hear about every request; a coach hears about
// requests for their own team (or every one, if they have no team). Neither
// message has children's names in it. Server only.
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

    // phone alerts
    const ids = new Set(people.map((p) => p.userId));
    const alerts = (await listAlerts(tenant)).filter((a) => ids.has(a.userId));
    // counts only — no names or addresses in the log
    const summary = `${people.length} admins/coaches, ${emails.size} emails, ${alerts.length} phones`;
    if (!alerts.length) {
      console.log(`Join request alerts (${tenant}): ${summary}`);
      return;
    }
    if (!(await setUpVapid(tenantUrl(tenant)))) {
      console.log(`Join request alerts (${tenant}): ${summary} — no keys to send phone alerts with`);
      return;
    }
    let sent = 0;
    const payload = JSON.stringify({ title: "New request to join", body: `${line} Tap to approve or decline.`, url: "/admin/members" });
    await Promise.all(
      alerts.map(async (a) => {
        try {
          await webpush.sendNotification({ endpoint: a.endpoint, keys: a.keys }, payload);
          sent++;
        } catch (err) {
          // a phone that's turned alerts off, or a browser that's gone
          const code = (err as { statusCode?: number })?.statusCode;
          console.log(`Join request alert to a phone refused (${code ?? "no status"})`);
          if (code === 403 || code === 404 || code === 410) await removeJoinAlert(tenant, a.endpoint).catch(() => {});
        }
      }),
    );
    console.log(`Join request alerts (${tenant}): ${summary}, ${sent} phone alerts sent`);
  } catch (e) {
    console.error("Join request alerts not sent:", e);
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
