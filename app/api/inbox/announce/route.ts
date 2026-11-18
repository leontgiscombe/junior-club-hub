// A coach telling a team's families who's Player of the Month (Coach Admin →
// Player of the Month → Poster): a notification behind the bell for every
// approved member with that team — its coaches, and the parents of its
// players. Once for each team and month, so a second tap doesn't repeat it.
//   POST { key, team, month: "YYYY-MM", playerId }
import { NextResponse } from "next/server";
import { isCoach } from "@/lib/adminAuth";
import { addToInbox, teamsOf } from "@/lib/inbox";
import { rawKv } from "@/lib/kv";
import { shortName, showFullNames } from "@/lib/names";
import { listPeople } from "@/lib/people";
import { monthName } from "@/lib/playerOfMonth";
import { getTeams } from "@/lib/settings";
import { listPlayers } from "@/lib/statsStorage";
import { getTenant } from "@/lib/tenant";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!(await isCoach(typeof body?.key === "string" ? body.key : ""))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const tenant = await getTenant();
  const team = (await getTeams()).find((t) => t.slug === body?.team);
  const month = typeof body?.month === "string" && /^\d{4}-\d{2}$/.test(body.month) ? body.month : "";
  const player = (await listPlayers()).find((p) => p.id === body?.playerId && p.team === team?.slug);
  if (!tenant || !team || !month || !player) return NextResponse.json({ error: "That isn't a player of this team" }, { status: 400 });

  const kv = await rawKv();
  if (kv && !(await kv.set(`platform:potm-told:${tenant}:${team.slug}:${month}`, 1, { nx: true, ex: 60 * 24 * 3600 }))) {
    return NextResponse.json({ error: `The families have already been told about ${monthName(month)}` }, { status: 409 });
  }
  const people = (await listPeople(tenant)).filter((p) => p.status === "approved" && teamsOf(p).has(team.slug));
  // names as the club shows them elsewhere: in full for a private hub, shortened otherwise (lib/names.ts)
  const name = (await showFullNames()) ? player.name : shortName(player.name);
  await addToInbox(tenant, people.map((p) => p.userId), {
    kind: "potm",
    title: `${monthName(month)}'s Player of the Month`,
    body: `${name} is Player of the Month for ${team.name} in ${monthName(month)}. Well done! 🌟`,
  });
  return NextResponse.json({ told: people.length });
}
