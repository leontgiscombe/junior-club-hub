// Who's signed in, and their place at this club.
//   GET -> { user: { email, name } | null, person: { status, roles } | null, canCoach }
import { NextResponse } from "next/server";
import { canCoach, currentPerson } from "@/lib/people";
import { getTenant } from "@/lib/tenant";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const tenant = await getTenant();
  const me = tenant ? await currentPerson(tenant) : (await currentUser().then((user) => (user ? { user, person: null } : null)));
  if (!me) return NextResponse.json({ user: null, person: null, canCoach: false });
  return NextResponse.json({
    user: { email: me.user.email, name: me.user.name },
    person: me.person ? { status: me.person.status, roles: me.person.roles } : null,
    canCoach: canCoach(me.person),
  });
}
