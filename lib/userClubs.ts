// The clubs an account belongs to, with its roles at each. Server only.
import { kvCall, readPerson } from "./access";
import { userClubsKey } from "./auth";
import { getClubFor } from "./settings";
import { tenantUrl } from "./tenant";

export async function clubsOfUser(userId: string) {
  const ids = (await kvCall<string[]>(["SMEMBERS", userClubsKey(userId)])) ?? [];
  const out = [];
  for (const id of ids) {
    const person = await readPerson(id, userId);
    if (!person) continue;
    out.push({ id, name: (await getClubFor(id)).name, url: tenantUrl(id), roles: person.roles, status: person.status, person: person.name });
  }
  return out;
}
