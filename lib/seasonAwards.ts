export type SeasonAward = {
  id: string;
  team: string;
  season: string;
  title: string;
  description: string;
  open: boolean;
  nominees: { id: string; name: string }[];
};

export type AwardBallot = {
  choices: string[];
  updatedAt: string;
};

export type SeasonAwardView = SeasonAward & {
  ballot?: AwardBallot | null;
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