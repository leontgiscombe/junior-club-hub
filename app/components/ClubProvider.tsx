"use client";

// Hands the club's settings (read on the server in the root layout) to every
// page in the browser: `const club = useClub()`.
import { createContext, useContext } from "react";
import { DEFAULT_CLUB, type Club } from "@/lib/clubSettings";

const ClubContext = createContext<Club>(DEFAULT_CLUB);

export function ClubProvider({ club, children }: { club: Club; children: React.ReactNode }) {
  return <ClubContext.Provider value={club}>{children}</ClubContext.Provider>;
}

export function useClub(): Club {
  return useContext(ClubContext);
}
