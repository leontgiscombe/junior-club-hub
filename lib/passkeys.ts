// Passkeys: sign in with Face ID, a fingerprint or the phone's screen lock
// instead of an emailed code. A passkey belongs to the account (Apple and
// Google sync it to the person's other devices), and works on every club's
// address. Treasurers and club admins can also use theirs to open Financial
// Admin (public/finance) — the passkey gives the browser a secret only it can
// produce, which unlocks their copy of the team's key. Server only.
//
//   platform:passkeys:<userId>      the account's passkeys: credential id -> Passkey
//   platform:passkey-owner          credential id -> userId, for signing in
//   platform:webauthn:<challenge>   a passkey prompt waiting to be answered (5 minutes)
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { kvCall } from "./access";
import type { User } from "./auth";
import { requestBase } from "./safeNext";
import { PLATFORM_NAME, rootDomain } from "./tenantHost";

export type Passkey = {
  id: string;
  publicKey: string;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
  /** e.g. "iPhone · Safari" — where it was made */
  label: string;
  /** whether it can unlock Financial Admin (the browser supports it) */
  prf?: boolean;
  createdAt: string;
  lastUsedAt?: string;
};

const passkeysKey = (userId: string) => `platform:passkeys:${userId}`;
const OWNERS = "platform:passkey-owner";
const challengeKey = (c: string) => `platform:webauthn:${c}`;
const CHALLENGE_SECONDS = 300;

type Req = { headers: Headers; nextUrl: URL };

/**
 * Who the passkey is for. On the platform's domain it's the domain itself, so
 * one passkey works on the platform's site and every club's address.
 */
export function relyingParty(req: Req): { rpID: string; origin: string } {
  const origin = requestBase(req);
  const host = new URL(origin).hostname;
  const root = rootDomain().replace(/:\d+$/, "");
  // (not on this computer: browsers won't share "localhost" with its subdomains)
  const shared = root && root !== "localhost" && (host === root || host.endsWith(`.${root}`));
  const rpID = shared ? root : host;
  return { rpID, origin };
}

export async function listPasskeys(userId: string): Promise<Passkey[]> {
  const flat = (await kvCall<string[] | null>(["HGETALL", passkeysKey(userId)])) ?? [];
  const out: Passkey[] = [];
  for (let i = 1; i < flat.length; i += 2) {
    try {
      out.push(JSON.parse(flat[i]) as Passkey);
    } catch {}
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getPasskey(userId: string, id: string): Promise<Passkey | null> {
  const raw = await kvCall<string | null>(["HGET", passkeysKey(userId), id]);
  return typeof raw === "string" ? (JSON.parse(raw) as Passkey) : null;
}

async function savePasskey(userId: string, key: Passkey): Promise<void> {
  await kvCall(["HSET", passkeysKey(userId), key.id, JSON.stringify(key)]);
}

export async function removePasskey(userId: string, id: string): Promise<void> {
  await kvCall(["HDEL", passkeysKey(userId), id]);
  if ((await kvCall<string | null>(["HGET", OWNERS, id])) === userId) await kvCall(["HDEL", OWNERS, id]);
}

/** Forget all of an account's passkeys (when it's deleted). */
export async function forgetPasskeys(userId: string): Promise<void> {
  const keys = await listPasskeys(userId);
  if (keys.length) await kvCall(["HDEL", OWNERS, ...keys.map((k) => k.id)]);
  await kvCall(["DEL", passkeysKey(userId)]);
}

async function rememberChallenge(challenge: string, what: string): Promise<void> {
  await kvCall(["SET", challengeKey(challenge), what, "EX", CHALLENGE_SECONDS]);
}

/** A remembered challenge, used once: whether it was made for `what`. */
async function spendChallenge(challenge: string, what: string): Promise<boolean> {
  return (await kvCall<string | null>(["GETDEL", challengeKey(challenge)])) === what;
}

/** Adding a passkey: what the browser needs to make one. */
export async function registrationOptions(req: Req, user: User) {
  const { rpID } = relyingParty(req);
  const existing = await listPasskeys(user.id);
  const options = await generateRegistrationOptions({
    rpName: PLATFORM_NAME,
    rpID,
    userName: user.email,
    userDisplayName: user.name || user.email,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: existing.map((k) => ({ id: k.id, transports: k.transports })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
    // asks whether the passkey can also unlock Financial Admin
    extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
  });
  await rememberChallenge(options.challenge, `add:${user.id}`);
  return options;
}

/** Adding a passkey: check what the browser made, and keep it. */
export async function finishRegistration(req: Req, user: User, response: RegistrationResponseJSON, label: string): Promise<Passkey | null> {
  const { rpID, origin } = relyingParty(req);
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: (c) => spendChallenge(c, `add:${user.id}`),
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
  }).catch(() => null);
  if (!verification?.verified || !verification.registrationInfo) return null;
  const { credential } = verification.registrationInfo;
  const prf = (response.clientExtensionResults as { prf?: { enabled?: boolean } } | undefined)?.prf?.enabled;
  const key: Passkey = {
    id: credential.id,
    publicKey: isoBase64URL.fromBuffer(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports,
    label: label.trim().slice(0, 60) || "A device",
    ...(prf !== undefined ? { prf } : {}),
    createdAt: new Date().toISOString(),
  };
  if ((await kvCall<number>(["HSETNX", OWNERS, key.id, user.id])) !== 1) return null;
  await savePasskey(user.id, key);
  return key;
}

/** Signing in with a passkey: the browser offers whichever this site has. */
export async function signInOptions(req: Req) {
  const { rpID } = relyingParty(req);
  const options = await generateAuthenticationOptions({ rpID, userVerification: "required" });
  await rememberChallenge(options.challenge, "signin");
  return options;
}

/** Signing in with a passkey: whose it is, if it checks out. */
export async function finishSignIn(req: Req, response: AuthenticationResponseJSON): Promise<string | null> {
  const { rpID, origin } = relyingParty(req);
  if (typeof response?.id !== "string") return null;
  const userId = await kvCall<string | null>(["HGET", OWNERS, response.id]);
  if (typeof userId !== "string") return null;
  const key = await getPasskey(userId, response.id);
  if (!key) return null;
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: (c) => spendChallenge(c, "signin"),
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: { id: key.id, publicKey: isoBase64URL.toBuffer(key.publicKey), counter: key.counter, transports: key.transports },
    requireUserVerification: true,
  }).catch(() => null);
  if (!verification?.verified) return null;
  await savePasskey(userId, { ...key, counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date().toISOString() });
  return userId;
}
