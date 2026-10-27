// The platform admin's API, on the platform's own site only. Every request
// carries the admin key in the "x-platform-key" header.
//   GET                                   -> { clubs (with their counts, last use and setup: lib/platformStats.ts),
//                                             log, emailConfigured, backups, separateBackups }
//   GET                                    -> also { feedback }: Help & Feedback messages (lib/feedback.ts)
//   POST { action: "feedbackDone", feedbackId, done? } -> marks a message done (or not)
//   POST { action: "billing", id, op: "extend" | "free" | "unfree" | "paid" | "unpaid", reason?, plan?, months? }
//                                          -> a club's trial or plan (lib/billing.ts)
//   POST { action: "demo", id }           -> fills an empty club with made-up teams, players and games (lib/demoSeed.ts)
//   POST { action: "reset", id }          -> emails the club a password-reset link
//   POST { action: "pause", id, reason? } -> the club's hub shows a "paused" page; nothing is deleted
//   POST { action: "resume", id }         -> opens it again
//   POST { action: "notes", id, text }    -> the platform admin's own notes on the club
//   POST { action: "delete", id, confirm } -> deletes the club and all its data
//                                            (confirm must repeat the id)
//   POST { action: "restore", id, date, confirm } -> puts a club back as it was in
//                                            that day's backup (confirm repeats the id)
import { seedDemoClub } from "@/lib/demoSeed";
import { PLANS, PLAN_IDS } from "@/lib/billing";
import { listFeedback, setFeedbackDone } from "@/lib/feedback";
import { NextRequest, NextResponse } from "next/server";
import { listBackups, restoreClub, separateBackupDb } from "@/lib/backup";
import { forgetClubSettings } from "@/lib/settings";
import { emailConfigured } from "@/lib/email";
import { platformAdminProblem } from "@/lib/platformAdmin";
import { sendResetEmail } from "@/lib/resetEmail";
import { getTenant } from "@/lib/tenant";
import { adminLog, clubStats, forgetClubExtras, logAdmin, setNotes } from "@/lib/platformStats";
import { deleteTenant, getTenantRecord, listTenantsForAdmin, setTenantPaused, setTenantBilling } from "@/lib/tenants";

export const dynamic = "force-dynamic";

async function refuse(req: NextRequest): Promise<NextResponse | null> {
  if ((await getTenant()) !== null) return NextResponse.json({ error: "Not here" }, { status: 404 });
  const problem = await platformAdminProblem(req);
  return problem ? NextResponse.json({ error: problem.error }, { status: problem.status }) : null;
}

export async function GET(req: NextRequest) {
  const refused = await refuse(req);
  if (refused) return refused;
  const [records, backups, log, feedback] = await Promise.all([listTenantsForAdmin(), listBackups().catch(() => []), adminLog(), listFeedback()]);
  const clubs = await Promise.all(records.map(clubStats));
  return NextResponse.json(
    { clubs, log, feedback, emailConfigured: emailConfigured(), backups, separateBackups: separateBackupDb() },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  const refused = await refuse(req);
  if (refused) return refused;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id : "";

  // a club's trial or plan (lib/billing.ts): extend the trial, free for good, or mark a plan paid
  if (body?.action === "billing") {
    const record = await getTenantRecord(id);
    if (!record) return NextResponse.json({ error: "No such club" }, { status: 404 });
    const op = body.op;
    const DAY = 86400_000;
    const from = (iso?: string) => Math.max(Date.now(), iso ? Date.parse(iso) || 0 : 0);
    let message = "";
    if (op === "extend") {
      await setTenantBilling(id, { trialEndsAt: new Date(from(record.billing?.trialEndsAt) + 30 * DAY).toISOString(), reminded: null });
      message = `${record.name}'s trial is 30 days longer`;
    } else if (op === "free") {
      const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 80) : "Free";
      await setTenantBilling(id, { free: { reason } });
      message = `${record.name} is free (${reason})`;
    } else if (op === "unfree") {
      // back to paying: a fresh 30-day trial if it never had one running
      await setTenantBilling(id, { free: null, ...(record.billing?.trialEndsAt ? {} : { trialEndsAt: new Date(Date.now() + 30 * DAY).toISOString() }) });
      message = `${record.name} now needs a plan (after any trial)`;
    } else if (op === "paid") {
      const plan = PLAN_IDS.find((p) => p === body.plan);
      const months = Math.min(24, Math.max(1, Number(body.months) || 1));
      if (!plan) return NextResponse.json({ error: "Choose a plan" }, { status: 400 });
      const until = new Date(from(record.billing?.plan === plan ? record.billing?.paidUntil : undefined));
      until.setUTCMonth(until.getUTCMonth() + months);
      await setTenantBilling(id, { plan, paidUntil: until.toISOString(), source: "manual", cancelled: null, billingIssue: null });
      message = `${record.name}: ${PLANS[plan].name} plan, paid up to ${until.toLocaleDateString("en-GB")}`;
    } else if (op === "unpaid") {
      await setTenantBilling(id, { plan: null, paidUntil: null, source: null, cancelled: null, billingIssue: null });
      message = `${record.name}'s plan removed`;
    } else return NextResponse.json({ error: "Unknown change" }, { status: 400 });
    await logAdmin("Billing", id, message);
    return NextResponse.json({ message });
  }

  if (body?.action === "feedbackDone") {
    const fid = typeof body.feedbackId === "string" ? body.feedbackId : "";
    if (!(await setFeedbackDone(fid, body.done !== false))) return NextResponse.json({ error: "No such message" }, { status: 404 });
    return NextResponse.json({ message: body.done !== false ? "Marked done" : "Marked not done" });
  }

  if (body?.action === "demo") {
    const record = await getTenantRecord(id);
    if (!record) return NextResponse.json({ error: "No such club" }, { status: 404 });
    try {
      const done = await seedDemoClub(id);
      await logAdmin("Filled with demo data", id);
      return NextResponse.json({ message: `${record.name}: ${done.teams} teams, ${done.players} made-up players and ${done.matches} matches added` });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't add the demo data" }, { status: 400 });
    }
  }

  if (body?.action === "reset") {
    const record = await getTenantRecord(id);
    if (!record) return NextResponse.json({ error: "No such club" }, { status: 404 });
    await sendResetEmail(record);
    await logAdmin("Password reset sent", id, record.email);
    return NextResponse.json({
      message: emailConfigured()
        ? `Reset link sent to ${record.email}`
        : `Reset link for ${record.email} written to the server log`,
    });
  }

  if (body?.action === "delete") {
    if (body.confirm !== id) {
      return NextResponse.json({ error: "Type the club's address to confirm" }, { status: 400 });
    }
    const deleted = await deleteTenant(id);
    if (deleted === null) return NextResponse.json({ error: "No such club" }, { status: 404 });
    console.log(`platform admin deleted club "${id}" (${deleted} records)`);
    await forgetClubExtras(id);
    await forgetClubSettings(id);
    await logAdmin("Deleted", id, `${deleted} records`);
    return NextResponse.json({ message: `Deleted ${id} and ${deleted} records` });
  }

  if (body?.action === "restore") {
    const date = typeof body.date === "string" ? body.date : "";
    if (body.confirm !== id) {
      return NextResponse.json({ error: "Type the club's address to confirm" }, { status: 400 });
    }
    const restored = await restoreClub(id, date);
    if (restored === null) return NextResponse.json({ error: `The ${date} backup doesn't have a club at "${id}"` }, { status: 404 });
    console.log(`platform admin restored club "${id}" from ${date} (${restored} records)`);
    await forgetClubSettings(id);
    await logAdmin("Restored", id, `from the ${date} backup`);
    return NextResponse.json({ message: `Restored ${id} as it was on ${date} (${restored} records)` });
  }

  if (body?.action === "pause" || body?.action === "resume") {
    const record = await getTenantRecord(id);
    if (!record) return NextResponse.json({ error: "No such club" }, { status: 404 });
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 200) : "";
    await setTenantPaused(id, body.action === "pause" ? { at: new Date().toISOString(), ...(reason ? { reason } : {}) } : null);
    await logAdmin(body.action === "pause" ? "Paused" : "Resumed", id, reason || undefined);
    return NextResponse.json({
      message: body.action === "pause" ? `${record.name} is paused — its hub now says so (within 30 seconds)` : `${record.name} is open again`,
    });
  }

  if (body?.action === "notes") {
    if (!(await getTenantRecord(id))) return NextResponse.json({ error: "No such club" }, { status: 404 });
    await setNotes(id, typeof body.text === "string" ? body.text : "");
    return NextResponse.json({ message: "Notes saved" });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
