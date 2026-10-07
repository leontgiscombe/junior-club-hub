// League opponents per team, so fixtures can be picked from a list instead of
// typed each time — set per team in club.config.ts, taken from the division's
// FA Full-Time table with the club's own entry left out.
//
// A team with no list just gets a free-text opponent box, and every team
// keeps the "Other team…" option for cup games and friendlies.
import { TEAMS } from "@/club.config";

export function opponentsFor(team: string): string[] {
  const found = TEAMS.find((t) => t.slug === team);
  return found?.opponents ? [...found.opponents] : [];
}
