// The monthly subs reminders, for a host's scheduled job (on Render, the cron
// job in render.yaml). It runs on the 1st and the 15th and asks the app to send
// that day's reminder: the "check this month's subs" one on the 1st, the
// halfway chase-up on the 15th.
//   APP_URL      the app's own address, e.g. https://junior-club-hub.onrender.com
//   CRON_SECRET  the same value the app has, so only this job can trigger it
const base = (process.env.APP_URL ?? "").replace(/\/+$/, "");
const secret = process.env.CRON_SECRET ?? "";
if (!base || !secret) {
  console.error("Set APP_URL and CRON_SECRET");
  process.exit(1);
}
const mid = new Date().getUTCDate() >= 15 ? "?when=mid" : "";
const res = await fetch(`${base}/api/finance/cron-remind${mid}`, {
  headers: { Authorization: `Bearer ${secret}` },
});
console.log(res.status, await res.text());
if (!res.ok) process.exit(1);
