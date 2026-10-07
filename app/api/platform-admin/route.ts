// The platform admin's API, on the platform's own site only. Every request
// carries the admin key in the "x-platform-key" header.
//   GET                                   -> { clubs, emailConfigured, backups, separateBackups }
//   POST { action: "reset", id }          -> emails the club a password-reset link
//   POST { action: "delete", id, confirm } -> deletes the club and all its data
//                                            (confirm must repeat the id)
//   POST { action: "restore", id, date, confirm } -> puts a club back as it was in
//                                            that day's backup (confirm repeats the id)
import { NextRequest, NextResponse } from "next/server";
import { listBackups, restoreClub, separateBackupDb } from "@/lib/backup";
import { emailConfigured } from "@/lib/email";
import { platformAdminProblem } from "@/lib/platformAdmin";
import { sendResetEmail } from "@/lib/resetEmail";
import { getTenant } from "@/lib/tenant";
import { deleteTenant, getTenantRecord, listTenantsForAdmin } from "@/lib/tenants";

export const dynamic = "force-dynamic";

async function refuse(req: NextRequest): Promise<NextResponse | null> {
  if ((await getTenant()) !== null) return NextResponse.json({ error: "Not here" }, { status: 404 });
  const problem = await platformAdminProblem(req);
  return problem ? NextResponse.json({ error: problem.error }, { status: problem.status }) : null;
}

export async function GET(req: NextRequest) {
  const refused = await refuse(req);
  if (refused) return refused;
  const [clubs, backups] = await Promise.all([listTenantsForAdmin(), listBackups().catch(() => [])]);
  return NextResponse.json({ clubs, emailConfigured: emailConfigured(), backups, separateBackups: separateBackupDb() });
}

export async function POST(req: NextRequest) {
  const refused = await refuse(req);
  if (refused) return refused;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id : "";

  if (body?.action === "reset") {
    const record = await getTenantRecord(id);
    if (!record) return NextResponse.json({ error: "No such club" }, { status: 404 });
    await sendResetEmail(record);
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
    return NextResponse.json({ message: `Restored ${id} as it was on ${date} (${restored} records)` });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
