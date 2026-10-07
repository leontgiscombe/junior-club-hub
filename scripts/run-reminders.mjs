// The daily job, for a host's scheduler (on Render, the cron job in
// render.yaml, every day at 9am UTC). Every day it asks the app to back up the
// database (lib/backup.ts); on the 1st and the 15th it also sends that day's
// subs reminder: "check this month's subs" on the 1st, the halfway chase-up on
// the 15th.
//   APP_URL      the app's own address, e.g. https://junior-club-hub.onrender.com
//   CRON_SECRET  the same value the app has, so only this job can trigger it
const base = (process.env.APP_URL ?? "").replace(/\/+$/, "");
const secret = process.env.CRON_SECRET ?? "";
if (!base || !secret) {
  console.error("Set APP_URL and CRON_SECRET");
  process.exit(1);
}
const headers = { Authorization: `Bearer ${secret}` };
let failed = false;

async function run(label, path) {
  try {
    const res = await fetch(`${base}${path}`, { headers });
    console.log(label, res.status, await res.text());
    if (!res.ok) failed = true;
  } catch (e) {
    console.error(label, "failed:", e);
    failed = true;
  }
}

await run("backup", "/api/cron-backup");
const day = new Date().getUTCDate();
if (day === 1 || day === 15) await run("reminders", `/api/finance/cron-remind${day >= 15 ? "?when=mid" : ""}`);
if (failed) process.exit(1);
