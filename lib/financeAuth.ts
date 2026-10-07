// A team's Financial Admin login record, as the server checks and keeps it
// (app/api/finance). Server only.

/**
 * A team's login record. writeHash is the SHA-256 of the team's write token.
 * From v2 the data is encrypted with a data key, kept here locked with the team
 * password (wrapPass) and with the team's recovery code (recSalt + wrapRec).
 */
export type Auth = {
  encSalt: string;
  verifySalt: string;
  verifyHash: string;
  writeSalt?: string;
  writeHash?: string;
  v?: 2;
  wrapPass?: Wrapped;
  recSalt?: string;
  wrapRec?: Wrapped;
};
type Wrapped = { iv: string; ct: string };
const wrapped = (w: unknown): Wrapped | null =>
  w && typeof w === "object" && typeof (w as Wrapped).iv === "string" && typeof (w as Wrapped).ct === "string"
    ? { iv: (w as Wrapped).iv, ct: (w as Wrapped).ct }
    : null;

/** A well-formed login record from a request, or null. */
export function cleanAuth(a: Record<string, unknown> | undefined): Auth | null {
  if (!a || typeof a.encSalt !== "string" || typeof a.verifySalt !== "string" || typeof a.verifyHash !== "string") {
    return null;
  }
  const out: Auth = { encSalt: a.encSalt, verifySalt: a.verifySalt, verifyHash: a.verifyHash };
  if (typeof a.writeSalt === "string" && typeof a.writeHash === "string") {
    out.writeSalt = a.writeSalt;
    out.writeHash = a.writeHash;
  }
  const wrapPass = wrapped(a.wrapPass);
  if (a.v === 2 && wrapPass) {
    out.v = 2;
    out.wrapPass = wrapPass;
    const wrapRec = wrapped(a.wrapRec);
    if (typeof a.recSalt === "string" && wrapRec) {
      out.recSalt = a.recSalt;
      out.wrapRec = wrapRec;
    }
  }
  return out;
}
