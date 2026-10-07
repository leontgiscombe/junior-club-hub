"use client";

// Hands the club's settings (read on the server in the root layout) to every
// page in the browser: `const club = useClub()` and `const { TEAMS, teamName } =
// useTeams()`.
import { createContext, useContext, useMemo } from "react";
import { DEFAULT_CLUB, DEFAULT_TEAMS, type Club, type Team } from "@/lib/clubSettings";
import { accentOf, findTeam, nameOf } from "@/lib/teams";

const ClubContext = createContext<{ club: Club; teams: Team[] }>({
  club: DEFAULT_CLUB,
  teams: DEFAULT_TEAMS,
});

export function ClubProvider({
  club,
  teams,
  children,
}: {
  club: Club;
  teams: Team[];
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ club, teams }), [club, teams]);
  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}

export function useClub(): Club {
  return useContext(ClubContext).club;
}

/** The teams in use, and helpers that look one up by its slug. */
export function useTeams() {
  const { teams } = useContext(ClubContext);
  return useMemo(
    () => ({
      TEAMS: teams,
      teamName: (slug: string) => nameOf(teams, slug),
      teamAccent: (slug: string) => accentOf(teams, slug),
      isValidTeam: (slug: string) => teams.some((t) => t.slug === slug),
      findTeam: (slug: string) => findTeam(teams, slug),
    }),
    [teams],
  );
}
