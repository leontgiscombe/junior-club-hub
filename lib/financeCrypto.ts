// Financial Admin's encryption, for resetting a team's password from Coach
// Admin → Settings. Must match public/finance/index.html exactly: PBKDF2
// (SHA-256, 250,000 rounds) to AES-GCM, base64 throughout, and the team's data
// key locked once with its password and once with its recovery code.
// Browser only.

const PBKDF2_ITER = 250000;
const REC_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type Wrapped = { iv: string; ct: string };
export type FinanceAuth = {
  v?: 2;
  encSalt: string;
  verifySalt: string;
  verifyHash: string;
  writeSalt?: string;
  writeHash?: string;
  wrapPass?: Wrapped;
  recSalt?: string;
  wrapRec?: Wrapped;
};

function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const ub64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

const baseKey = (password: string) =>
  crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits", "deriveKey"]);
async function deriveKey(password: string, salt: Uint8Array) {
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITER, hash: "SHA-256" },
    await baseKey(password),
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
async function deriveVerify(password: string, salt: Uint8Array) {
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITER, hash: "SHA-256" },
    await baseKey(password),
    256,
  );
  return b64(new Uint8Array(bits));
}
const sha256b64 = async (text: string) =>
  b64(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))));

async function wrap(key: CryptoKey, bytes: Uint8Array): Promise<Wrapped> {
  const iv = random(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, bytes as BufferSource));
  return { iv: b64(iv), ct: b64(ct) };
}
async function unwrap(key: CryptoKey, w: Wrapped): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: ub64(w.iv) as BufferSource }, key, ub64(w.ct) as BufferSource),
  );
}

export const normaliseCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");

function newRecoveryCode(): string {
  const chars = Array.from(random(20), (b) => REC_CHARS[b % REC_CHARS.length]).join("");
  return chars.match(/.{4}/g)!.join("-");
}

/** The team's data key, from its recovery code; null if the code is wrong. */
export async function openWithRecoveryCode(auth: FinanceAuth, code: string): Promise<Uint8Array | null> {
  if (!auth.recSalt || !auth.wrapRec) return null;
  try {
    return await unwrap(await deriveKey(normaliseCode(code), ub64(auth.recSalt)), auth.wrapRec);
  } catch {
    return null;
  }
}

/**
 * A new login record for `password`. With `keep` (the data key, opened with
 * the recovery code, and the record it came from), the data key and recovery
 * code stay the same; without it, there's a new data key and a new recovery
 * code, which is returned to show the coach.
 */
export async function newFinanceAuth(
  password: string,
  keep?: { dataKey: Uint8Array; auth: FinanceAuth },
): Promise<{ auth: FinanceAuth; recoveryCode?: string }> {
  const dataKey = keep?.dataKey ?? random(32);
  const encSalt = random(16), verifySalt = random(16), writeSalt = random(16);
  const auth: FinanceAuth = {
    v: 2,
    encSalt: b64(encSalt),
    verifySalt: b64(verifySalt),
    verifyHash: await deriveVerify(password, verifySalt),
    writeSalt: b64(writeSalt),
    writeHash: await sha256b64(await deriveVerify(password, writeSalt)),
    wrapPass: await wrap(await deriveKey(password, encSalt), dataKey),
  };
  if (keep) {
    auth.recSalt = keep.auth.recSalt;
    auth.wrapRec = keep.auth.wrapRec;
    return { auth };
  }
  const recoveryCode = newRecoveryCode();
  const recSalt = random(16);
  auth.recSalt = b64(recSalt);
  auth.wrapRec = await wrap(await deriveKey(normaliseCode(recoveryCode), recSalt), dataKey);
  return { auth, recoveryCode };
}
