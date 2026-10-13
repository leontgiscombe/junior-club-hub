// The platform admin's API, on the platform's own site only. Every request
// carries the admin key in the "x-platform-key" header.
//   GET                                   -> { clubs (with their counts, last use and setup: lib/platformStats.ts),
//                                             log, emailConfigured, backups, separateBackups }
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
import { NextRequest, NextResponse } from "next/server";
import { listBackups, restoreClub, separateBackupDb } from "@/lib/backup";
import { emailConfigured } from "@/lib/email";
import { platformAdminProblem } from "@/lib/platformAdmin";
import { sendResetEmail } from "@/lib/resetEmail";
import { getTenant } from "@/lib/tenant";
import { adminLog, clubStats, forgetClubExtras, logAdmin, setNotes } from "@/lib/platformStats";
import { deleteTenant, getTenantRecord, listTenantsForAdmin, setTenantPaused } from "@/lib/tenants";

export const dynamic = "force-dynamic";

async function refuse(req: NextRequest): Promise<NextResponse | null> {
  if ((await getTenant()) !== null) return NextResponse.json({ error: "Not here" }, { status: 404 });
  const problem = await platformAdminProblem(req);
  return problem ? NextResponse.json({ error: problem.error }, { status: problem.status }) : null;
}

export async function GET(req: NextRequest) {
  const refused = await refuse(req);
  if (refused) return refused;
  const [records, backups, log] = await Promise.all([listTenantsForAdmin(), listBackups().catch(() => []), adminLog()]);
  const clubs = await Promise.all(records.map(clubStats));
  return NextResponse.json(
    { clubs, log, emailConfigured: emailConfigured(), backups, separateBackups: separateBackupDb() },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  const refused = await refuse(req);
  if (refused) return refused;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id : "";

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
