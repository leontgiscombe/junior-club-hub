/**
 * Who votes for an award: "players" — a ballot per child in the squad, filled
 * in by their parent on their behalf, and not for themselves (Players' Player);
 * "parents" — a ballot per parent's account (Parents' Player); "coaches" — the
 * coaches choose, so it isn't on the parents' ballot at all. An award saved
 * before there was a choice is "parents", which is how they all worked.
 */
export type AwardVoters = "players" | "parents" | "coaches";
export const AWARD_VOTERS: AwardVoters[] = ["players", "parents", "coaches"];
export const VOTERS_LABEL: Record<AwardVoters, string> = {
  players: "Players (parents vote for their child)",
  parents: "Parents & supporters",
  coaches: "Coaches decide",
};

/** The usual end-of-season awards, for a team to add in one go (and rename or remove as they like). */
export const STARTER_AWARDS: { title: string; description: string; voters: AwardVoters }[] = [
  { title: "Players' Player of the Season", description: "Chosen by the players: who they most like playing alongside.", voters: "players" },
  { title: "Parents' Player of the Year", description: "Chosen by the parents and supporters.", voters: "parents" },
  { title: "Manager's Player of the Year", description: "", voters: "coaches" },
  { title: "Most Improved Player", description: "", voters: "coaches" },
  { title: "Top Goalscorer", description: "", voters: "coaches" },
  { title: "Club Person of the Year", description: "For effort, attitude and being a great team-mate.", voters: "coaches" },
];

/**
 * Who most likely votes for an award, from its name: the players' and parents'
 * awards say so; anything else (Manager's Player, Most Improved, Top Scorer, a
 * club's own) the coaches decide, so it's off the parents' ballot unless chosen.
 */
export function guessVoters(title: string): AwardVoters {
  const t = title.toLowerCase().replace(/[’']/g, "");
  if (/\bplayers player\b|\bplayers choice\b|voted by (the )?players/.test(t)) return "players";
  if (/\bparent|\bsupporter|\bfans?\b/.test(t)) return "parents";
  return "coaches";
}

export type SeasonAward = {
  id: string;
  team: string;
  season: string;
  title: string;
  description: string;
  open: boolean;
  nominees: { id: string; name: string }[];
  voters?: AwardVoters;
};

export type AwardBallot = {
  choices: string[];
  updatedAt: string;
  /** who saved it (a players' award ballot can be saved by either parent) */
  by?: string;
};

/** One ballot a parent fills in: their own, or one on behalf of a child of theirs. */
export type AwardSlot = {
  forPlayer?: { id: string; name: string };
  ballot: AwardBallot | null;
};

export type SeasonAwardView = SeasonAward & {
  slots?: AwardSlot[];
  ballotCount?: number;
  standings?: AwardStanding[];
};

export type SeasonAwardsData = {
  season: string;
  activeTeams: string[];
  teams: { slug: string; name: string }[];
  awards: SeasonAwardView[];
};

export type AwardStanding = {
  playerId: string;
  points: number;
  first: number;
  second: number;
  third: number;
  percentage: number;
  rank: number;
};

export const votersOf = (award: Pick<SeasonAward, "voters">): AwardVoters => award.voters ?? "parents";

/** Where a ballot is kept: a players' award's under the child, so they get one vote however many parents they have. */
export const ballotField = (userId: string, playerId?: string) => (playerId ? `player:${playerId}` : userId);

/**
 * The ballots a parent fills in for an award: none for the coaches' awards, one
 * for each of their children in the award's team for a players' award, and
 * their own for a parents' one.
 */
export function awardSlotsFor(
  award: Pick<SeasonAward, "team" | "voters">,
  kids: { playerId?: string; name: string; pending?: boolean; team?: { slug: string } }[],
): { playerId?: string; name?: string }[] {
  const voters = votersOf(award);
  if (voters === "coaches") return [];
  const mine = kids.filter((k) => !k.pending && k.team?.slug === award.team);
  if (voters === "parents") return mine.length ? [{}] : [];
  return mine.flatMap((k) => (k.playerId ? [{ playerId: k.playerId, name: k.name }] : []));
}

/** Who can be voted for: everyone nominated, except the child whose ballot it is. */
export const nomineesFor = (award: Pick<SeasonAward, "nominees">, playerId?: string) =>
  award.nominees.filter((n) => n.id !== playerId);

export function validAwardChoices(value: unknown, playerIds: string[]): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 3 &&
    value.every((choice) => typeof choice === "string" && playerIds.includes(choice)) &&
    new Set(value).size === value.length;
}

export function awardStandings(ballots: AwardBallot[]): AwardStanding[] {
  const players = new Map<string, AwardStanding>();
  let total = 0;
  for (const ballot of ballots) {
    ballot.choices.slice(0, 3).forEach((playerId, index) => {
      const standing = players.get(playerId) ?? {
        playerId, points: 0, first: 0, second: 0, third: 0, percentage: 0, rank: 0,
      };
      const points = 3 - index;
      standing.points += points;
      if (index === 0) standing.first += 1;
      if (index === 1) standing.second += 1;
      if (index === 2) standing.third += 1;
      total += points;
      players.set(playerId, standing);
    });
  }
  const standings = [...players.values()].sort((first, second) => second.points - first.points || first.playerId.localeCompare(second.playerId));
  standings.forEach((standing, index) => {
    standing.percentage = total ? standing.points / total * 100 : 0;
    standing.rank = index > 0 && standings[index - 1].points === standing.points ? standings[index - 1].rank : index + 1;
  });
  return standings;
}