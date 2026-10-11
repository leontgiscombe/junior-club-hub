// GET /api/search?q=… -> { results: Hit[] }: the club's own data that matches,
// only what the person searching may see.
//   coaches (an approved coach or club admin): players, matches, members,
//     drills and kit requests;
//   parents and players: their own (or their children's) teams' matches;
//   anyone else: nothing (Search still finds pages: lib/searchIndex.ts).
import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenant";
import { canCoach, currentPerson, listPeople } from "@/lib/people";
import { teamsOf } from "@/lib/access";
import { getClub, getTeams } from "@/lib/settings";
import { listPlayers } from "@/lib/statsStorage";
import { listMatches, type Match } from "@/lib/matchStorage";
import { listDrills } from "@/lib/trainingPlans";
import { listKitRequests } from "@/lib/kitRequests";
import { KIT_ITEMS } from "@/lib/kitItems";
import { score } from "@/lib/searchIndex";

export const runtime = "nodejs";

export type Hit = { kind: string; title: string; sub: string; href?: string; score: number };

const MAX_PER_KIND = 6;

const day = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  const tenant = await getTenant();
  if (q.length < 2 || !tenant) return NextResponse.json({ results: [] });
  const me = await currentPerson(tenant).catch(() => null);
  const person = me?.person?.status === "approved" ? me.person : null;
  if (!person) return NextResponse.json({ results: [] });

  const coach = canCoach(person);
  const [club, teams] = await Promise.all([getClub(), getTeams()]);
  const teamName = (slug: string) => teams.find((t) => t.slug === slug)?.name ?? "";
  const many = teams.length > 1;
  const hits: Hit[] = [];
  const add = (list: Hit[]) => hits.push(...list.filter((h) => h.score > 0).sort((a, b) => b.score - a.score).slice(0, MAX_PER_KIND));

  const matchHit = (m: Match, link: boolean): Hit => {
    const result = m.resultLogged ? `${m.goals.length}–${m.opponentGoals}` : m.time ? m.time : "";
    return {
      kind: "Matches",
      title: `${many ? `${teamName(m.team)} ` : ""}vs ${m.opponent || "TBC"}`,
      sub: [day(m.date), m.home ? "Home" : "Away", result].filter(Boolean).join(" · "),
      ...(link ? { href: "/admin/stats/matches" } : club.publicResults && m.resultLogged ? { href: `/results?team=${m.team}` } : {}),
      score: score(q, m.opponent, `${teamName(m.team)} ${m.date} ${m.home ? "home" : "away"}`),
    };
  };

  if (coach) {
    const [players, matches, people, drills, requests] = await Promise.all([
      listPlayers().catch(() => []),
      listMatches().catch(() => []),
      listPeople(tenant).catch(() => []),
      club.features.trainingPlans ? listDrills().catch(() => []) : [],
      club.features.kitSizes ? listKitRequests().catch(() => []) : [],
    ]);
    add(
      players.map((p) => ({
        kind: "Players",
        title: p.name,
        sub: [teamName(p.team) || "No team yet", p.position].filter(Boolean).join(" · "),
        href: `/admin/members?q=${encodeURIComponent(p.name)}`,
        score: score(q, p.name),
      })),
    );
    add(matches.sort((a, b) => b.date.localeCompare(a.date)).map((m) => matchHit(m, true)));
    add(
      people
        .filter((p) => p.status !== "declined")
        .map((p) => ({
          kind: "Members",
          title: p.name,
          sub: [p.status === "pending" ? "Waiting for approval" : p.roles.join(", ") || p.relation || "Member", p.team?.name]
            .filter(Boolean)
            .join(" · "),
          href: "/admin/members",
          score: score(q, p.name, `${p.email} ${(p.children ?? []).map((c) => c.name).join(" ")}`),
        })),
    );
    add(
      drills.map((d) => ({
        kind: "Drills",
        title: d.title,
        sub: [d.kind, d.topic, d.ageGroup].filter(Boolean).join(" · "),
        href: `/admin/training/plans?view=library&q=${encodeURIComponent(d.title)}`,
        score: score(q, d.title, `${d.topic} ${d.kind} ${d.equipment}`),
      })),
    );
    add(
      requests.map((r) => ({
        kind: "Kit Requests",
        title: `${KIT_ITEMS[r.item]?.short ?? r.item} · ${r.size}`,
        sub: `For ${r.childName}${r.doneAt ? " · Done" : " · Waiting"}`,
        href: `/admin/kit?team=${encodeURIComponent(r.team)}`,
        score: score(q, r.childName, `${KIT_ITEMS[r.item]?.label ?? ""} ${r.requestedBy} kit request`),
      })),
    );
  } else {
    // a parent or player: their own teams' matches, to look at
    const mine = teamsOf(person);
    const matches = (await listMatches().catch(() => [])).filter((m) => mine.includes(m.team));
    add(matches.sort((a, b) => b.date.localeCompare(a.date)).map((m) => matchHit(m, false)));
  }

  return NextResponse.json({ results: hits });
}
