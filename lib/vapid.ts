// The key pair phone alerts are sent with (web push's "VAPID" keys): join
// request alerts and the Financial Admin subs reminders.
//
// VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in the environment are used when they
// are a valid pair. Otherwise the hub makes its own pair the first time it
// needs one and keeps it in the database, so nobody has to generate and paste
// keys by hand. Phones subscribe with the public key, so a phone that turned
// alerts on under an earlier key has to turn them on again. Server only.
import webpush from "web-push";
import { kvCall } from "./access";

export type VapidKeys = { publicKey: string; privateKey: string };

const STORE_KEY = "platform:vapid-keys";

const bytes = (s: string) => Buffer.from(s, "base64url").length;
/** A P-256 key pair as web push wants it: a 65-byte public key and a 32-byte private key. */
const valid = (k: Partial<VapidKeys> | null | undefined): k is VapidKeys =>
  typeof k?.publicKey === "string" &&
  typeof k.privateKey === "string" &&
  bytes(k.publicKey) === 65 &&
  bytes(k.privateKey) === 32;

const parse = (v: unknown): VapidKeys | null => {
  if (typeof v !== "string") return null;
  try {
    const k = JSON.parse(v) as Partial<VapidKeys>;
    return valid(k) ? k : null;
  } catch {
    return null;
  }
};

/** The hub's key pair, or null if there's no database to keep one in. */
export async function vapidKeys(): Promise<VapidKeys | null> {
  const env = { publicKey: process.env.VAPID_PUBLIC_KEY?.trim(), privateKey: process.env.VAPID_PRIVATE_KEY?.trim() };
  if (valid(env)) return env;
  try {
    const stored = parse(await kvCall(["GET", STORE_KEY]));
    if (stored) return stored;
    // first use: make a pair; if two requests race, the first one saved wins
    await kvCall(["SET", STORE_KEY, JSON.stringify(webpush.generateVAPIDKeys()), "NX"]);
    return parse(await kvCall(["GET", STORE_KEY]));
  } catch {
    return null;
  }
}

/** Set web push up to send with the hub's keys; false if it can't. */
export async function setUpVapid(subject: string): Promise<boolean> {
  const keys = await vapidKeys();
  if (!keys) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || subject, keys.publicKey, keys.privateKey);
  return true;
}
