// Team helpers that work on a list of teams. The list itself is the club's
// saved teams (Coach Admin → Settings): server code reads it with getTeams()
// from lib/settings.ts, and pages in the browser with useTeams() from
// app/components/ClubProvider.tsx.
import type { Team } from "./clubSettings";

export type { Team };
export type TeamSlug = string;

export function findTeam(teams: readonly Team[], slug: string): Team | undefined {
  return teams.find((t) => t.slug === slug);
}

export function nameOf(teams: readonly Team[], slug: string): string {
  return findTeam(teams, slug)?.name ?? slug;
}

export function accentOf(teams: readonly Team[], slug: string): string {
  return findTeam(teams, slug)?.accent ?? "⚽";
}
