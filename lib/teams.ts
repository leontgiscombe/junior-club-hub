// The club's teams, as set in club.config.ts. Each gets its own kit-size page
// and store of responses, stats, logs and training plan; the /kit landing page,
// the /kit/[team] form and every team selector pick them up automatically.
import { TEAMS as CLUB_TEAMS } from "@/club.config";

export const TEAMS = CLUB_TEAMS.map(({ slug, name, accent }) => ({ slug, name, accent }));

export type TeamSlug = (typeof CLUB_TEAMS)[number]["slug"];

export function isValidTeam(slug: string): slug is TeamSlug {
  return TEAMS.some((t) => t.slug === slug);
}

export function teamName(slug: string): string {
  return TEAMS.find((t) => t.slug === slug)?.name ?? slug;
}
