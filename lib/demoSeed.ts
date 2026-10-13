// Made-up data for a demo club (Platform Admin → a club → Fill With Demo Data):
// two teams of invented players, a few results with scorers and awards, the
// next fixtures, and training awards — so App Review, or anyone shown the app,
// sees a hub that's in use. Only for a club with no players yet, so it can
// never touch a real club's squad. No real names. Server only.
import { randomUUID } from "crypto";
import type { Team } from "./clubSettings";
import { getKv } from "./kv";
import { getAllTeamsFor, saveTeams } from "./settings";

const FIRST = ["Alfie", "Mia", "Leo", "Isla", "Noah", "Ava", "Oscar", "Ella", "Jack", "Ruby", "Harry", "Grace", "Theo", "Lily", "Finn", "Freya", "Arlo", "Poppy", "Max", "Evie"];
const LAST = ["Brook", "Carter", "Dale", "Ellis", "Fenwick", "Garner", "Hollis", "Ingram", "Jarvis", "Kemp"];
const OPPONENTS = ["Riverside Rovers", "Oakfield Juniors", "Millbrook FC", "Hilltop Athletic", "Westgate Colts", "Kingsway Youth"];

const day = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

/** Fill `tenant` with demo data. Refuses a club that already has players. */
export async function seedDemoClub(tenant: string): Promise<{ teams: number; players: number; matches: number }> {
  const kv = await getKv(tenant);
  if (!kv) throw new Error("Storage isn't set up");
  const existing = await kv.hgetall<Record<string, unknown>>("player_stats");
  if (existing && Object.keys(existing).length) throw new Error("This club already has players — demo data only goes into an empty club");

  // two teams: the club's first one, and a second
  const teams = (await getAllTeamsFor(tenant)).filter((t) => !t.archived);
  const first: Team = teams[0] ?? { slug: "lions", name: "U10 Lions", accent: "🦁" };
  const second: Team = teams[1] ?? { ...first, slug: "tigers", name: "U9 Tigers", accent: "🐯", faSnippet: undefined, opponents: undefined };
  if (!teams[1]) await saveTeams([...teams.length ? teams : [first], second], tenant);

  const now = new Date().toISOString();
  let players = 0;
  let matches = 0;
  for (const [ti, team] of [first, second].entries()) {
    // ten invented players, the first in goal
    const squad = Array.from({ length: 10 }, (_, i) => ({
      id: randomUUID(),
      team: team.slug,
      name: `${FIRST[(i + ti * 10) % FIRST.length]} ${LAST[(i * 3 + ti) % LAST.length]}`,
      position: i === 0 ? "goalkeeper" : "outfield",
      appearances: 0,
      goals: 0,
      assists: 0,
      saves: 0,
      penaltiesSaved: 0,
      potm: 0,
      mostImproved: 0,
      bestTrainer: 0,
      createdAt: now,
    }));
    const pick = (n: number) => squad[(n * 7 + ti) % squad.length];

    // four results over the last month, then the next two fixtures
    const games: Record<string, string> = {};
    for (let g = 0; g < 6; g++) {
      const played = g < 4;
      const ours = played ? [1, 2, 1, 3][g] : 0;
      const goals = Array.from({ length: ours }, (_, k) => ({ id: randomUUID(), scorerId: pick(g + k + 1).id, assistId: pick(g + k + 3).id }));
      const appearanceIds = played ? squad.map((p) => p.id) : [];
      const potm = played ? pick(g + 2) : null;
      const improved = played ? pick(g + 5) : null;
      for (const goal of goals) {
        squad.find((p) => p.id === goal.scorerId)!.goals++;
        squad.find((p) => p.id === goal.assistId)!.assists++;
      }
      if (played) for (const p of squad) p.appearances++;
      if (potm) potm.potm++;
      if (improved) improved.mostImproved++;
      const id = randomUUID();
      games[id] = JSON.stringify({
        id,
        team: team.slug,
        opponent: OPPONENTS[(g + ti * 2) % OPPONENTS.length],
        date: day(played ? -7 * (4 - g) + 5 : 7 * (g - 3) - 1),
        time: g % 2 ? "10:30" : "09:30",
        home: g % 2 === 0,
        cameraHolder: "",
        footageUploaded: false,
        friendly: false,
        cup: false,
        goals,
        opponentGoals: played ? [1, 0, 2, 1][g] : 0,
        appearanceIds,
        potmId: potm?.id ?? "",
        mostImprovedId: improved?.id ?? "",
        resultLogged: played,
        faId: "",
        createdAt: now,
      });
      matches++;
    }
    await kv.hset("matches", games);

    // the last three weeks' training: a best trainer each time
    const sessions: Record<string, string> = {};
    for (let w = 1; w <= 3; w++) {
      const date = day(-7 * w + 1);
      const best = pick(w + 4);
      best.bestTrainer++;
      sessions[`${team.slug}:${date}`] = JSON.stringify({ team: team.slug, date, bestTrainerId: best.id, cancelled: false });
    }
    await kv.hset("training", sessions);

    await kv.hset("player_stats", Object.fromEntries(squad.map((p) => [p.id, JSON.stringify(p)])));
    players += squad.length;
  }
  return { teams: 2, players, matches };
}
