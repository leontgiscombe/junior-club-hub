// Who's signed in, and their place at this club.
//   GET -> { user: { email, name } | null, person: { status, roles } | null, canCoach,
//            passwordSignIn (whether this club's shared coach password still works) }
import { NextResponse } from "next/server";
import { readAccess } from "@/lib/access";
import { canCoach, currentPerson } from "@/lib/people";
import { getTenant } from "@/lib/tenant";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const tenant = await getTenant();
  const passwordSignIn = tenant ? !(await readAccess(tenant).catch(() => null))?.passwordOff : false;
  const me = tenant ? await currentPerson(tenant) : (await currentUser().then((user) => (user ? { user, person: null } : null)));
  if (!me) return NextResponse.json({ user: null, person: null, canCoach: false, passwordSignIn });
  return NextResponse.json({
    user: { email: me.user.email, name: me.user.name },
    person: me.person ? { status: me.person.status, roles: me.person.roles } : null,
    canCoach: canCoach(me.person),
    passwordSignIn,
  });
}
