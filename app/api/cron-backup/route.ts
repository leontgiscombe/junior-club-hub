// The nightly backup (lib/backup.ts), run by the scheduled job in render.yaml
// (scripts/run-reminders.mjs). Only that job, which sends CRON_SECRET, may run it.
import { NextRequest, NextResponse } from "next/server";
import { runBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runBackup();
    console.log(`backup ${result.date}: ${result.keys} records${result.separate ? "" : " (in the main database)"}`);
    return NextResponse.json(result);
  } catch (e) {
    console.error("backup failed:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "backup failed" }, { status: 500 });
  }
}
