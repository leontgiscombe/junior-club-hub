// Who's looking at a club's pages, for what the app shows them: their initials
// for the profile badge, and which tools are theirs to open. Server only.
import { FINANCE_ROLES } from "./financeDevices";
import { canCoach, currentPerson } from "./people";

export type Viewer = {
  /** signed in with an account */
  signedIn: boolean;
  /** their initials for the profile badge ("SJ"), or "" */
  initials: string;
  /** an approved club admin or coach: Coach Admin is theirs */
  canCoach: boolean;
  /** an approved treasurer or club admin: Financial Admin is theirs */
  canFinance: boolean;
};

export const SIGNED_OUT: Viewer = { signedIn: false, initials: "", canCoach: false, canFinance: false };

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 2)
    .join("");

export async function getViewer(tenant: string | null): Promise<Viewer> {
  if (!tenant) return SIGNED_OUT;
  const me = await currentPerson(tenant).catch(() => null);
  if (!me) return SIGNED_OUT;
  const person = me.person;
  const approved = person?.status === "approved";
  const name = person?.name || me.user.name || me.user.email.split("@")[0];
  return {
    signedIn: true,
    initials: initialsOf(name) || "?",
    canCoach: canCoach(person),
    canFinance: approved && !!person?.roles.some((r) => (FINANCE_ROLES as readonly string[]).includes(r)),
  };
}
