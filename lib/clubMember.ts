// Whether whoever's asking is one of the club's approved members: signed in
// with an approved account, or on a phone a coach approved before accounts
// (lib/access.ts). Server only.
import { cookies } from "next/headers";
import { MEMBER_COOKIE, SESSION_COOKIE, isApprovedPerson, readMember } from "./access";

export async function isClubMember(tenant: string | null): Promise<boolean> {
  if (!tenant) return false;
  const jar = await cookies();
  try {
    if ((await readMember(tenant, jar.get(MEMBER_COOKIE)?.value ?? ""))?.status === "approved") return true;
    return await isApprovedPerson(tenant, jar.get(SESSION_COOKIE)?.value ?? "");
  } catch {
    return false;
  }
}
