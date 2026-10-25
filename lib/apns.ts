// Native alerts on the App Store app (ios-app/), through Apple's push service
// (APNs). Set APNS_KEY (the .p8 key's contents), APNS_KEY_ID, APPLE_TEAM_ID and
// IOS_BUNDLE_ID where the site's hosted. A build run from Xcode gets "sandbox"
// tokens and an App Store or TestFlight one "production" tokens: each is tried
// on production first, then the sandbox. Server only.
import { createPrivateKey, sign } from "crypto";
import { connect } from "http2";
import { rawKv } from "./kv";

const HOSTS = ["https://api.push.apple.com", "https://api.sandbox.push.apple.com"];

const env = () => ({
  key: (process.env.APNS_KEY ?? "").replace(/\\n/g, "\n").trim(),
  keyId: (process.env.APNS_KEY_ID ?? "").trim(),
  team: (process.env.APPLE_TEAM_ID ?? "").trim(),
  bundle: (process.env.IOS_BUNDLE_ID ?? "").trim(),
});

export const apnsConfigured = () => {
  const e = env();
  return !!(e.key && e.keyId && e.team && e.bundle);
};

/** A device token as the app sends it: hex. */
export const isApnsToken = (t: unknown): t is string => typeof t === "string" && /^[0-9a-f]{64,200}$/i.test(t);

// Apple's sign-in token for the push service, made again every 50 minutes (it lasts an hour)
let jwt: { token: string; at: number } | null = null;
function bearer(): string {
  if (jwt && Date.now() - jwt.at < 50 * 60 * 1000) return jwt.token;
  const { key, keyId, team } = env();
  const b64 = (v: object | Buffer) => Buffer.from(v instanceof Buffer ? v : JSON.stringify(v)).toString("base64url");
  const iat = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: "ES256", kid: keyId })}.${b64({ iss: team, iat })}`;
  const signature = sign("sha256", Buffer.from(body), { key: createPrivateKey(key), dsaEncoding: "ieee-p1363" });
  jwt = { token: `${body}.${b64(signature)}`, at: Date.now() };
  return jwt.token;
}

function post(host: string, token: string, payload: string): Promise<{ status: number; reason: string }> {
  return new Promise((resolve) => {
    const client = connect(host);
    const done = (status: number, reason: string) => {
      client.close();
      resolve({ status, reason });
    };
    client.on("error", (e) => done(0, e.message));
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${bearer()}`,
      "apns-topic": env().bundle,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });
    let status = 0;
    let data = "";
    req.on("response", (h) => (status = Number(h[":status"]) || 0));
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      let reason = "";
      try {
        reason = data ? (JSON.parse(data).reason ?? "") : "";
      } catch {}
      done(status, reason);
    });
    req.on("error", (e) => done(0, e.message));
    req.setTimeout(10_000, () => {
      req.close();
      done(0, "timeout");
    });
    req.end(payload);
  });
}

// The red number on the app's icon: alerts since the app was last opened on
// that phone. Kept for the phone itself, not per club, as it has one icon.
const badgeKey = (token: string) => `platform:apns-badge:${token}`;

async function nextBadge(token: string): Promise<number | undefined> {
  try {
    const kv = await rawKv();
    if (!kv) return undefined;
    const n = await kv.incr(badgeKey(token));
    await kv.expire(badgeKey(token), 60 * 24 * 3600);
    return n;
  } catch {
    return undefined;
  }
}

/** The app's been opened on this phone: start counting again from nothing. */
export async function clearBadge(token: string) {
  const kv = await rawKv();
  await kv?.del(badgeKey(token));
}

/**
 * Send one alert. "sent"; "gone" when the phone has turned alerts off or
 * removed the app (drop its token); otherwise why it failed.
 */
export async function sendApns(token: string, message: { title: string; body: string; url: string }): Promise<string> {
  if (!apnsConfigured()) return "not set up";
  const badge = await nextBadge(token);
  const payload = JSON.stringify({ aps: { alert: { title: message.title, body: message.body }, sound: "default", badge }, url: message.url });
  let last = "";
  for (const host of HOSTS) {
    const r = await post(host, token, payload);
    if (r.status === 200) return "sent";
    if (r.status === 410 || r.reason === "Unregistered") return "gone";
    last = `${r.status || "no status"} ${r.reason}`.trim();
    // a token from the other environment: try the other host
    if (r.reason !== "BadDeviceToken") break;
  }
  return last === "400 BadDeviceToken" ? "gone" : last;
}
