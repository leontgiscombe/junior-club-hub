// The team a coach looks after, remembered on their own phone or computer so
// every page in the hub opens on it. Everyone signs in with the same password,
// so the hub can't tell coaches apart — instead, whichever team was last picked
// on a device becomes its default. Stored in the browser only; nothing is sent
// to the server, and a private window or cleared site data just falls back to
// the first team.
import { useCallback, useEffect, useState } from "react";
import { TEAMS, isValidTeam, type TeamSlug } from "./teams";
import { CLUB } from "@/club.config";

const STORAGE_KEY = `${CLUB.storagePrefix}:my-team`;

export function getMyTeam(): TeamSlug | null {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY) ?? "";
    return isValidTeam(saved) ? saved : null;
  } catch {
    return null;
  }
}

export function setMyTeam(team: TeamSlug) {
  try {
    window.localStorage.setItem(STORAGE_KEY, team);
  } catch {
    // storage blocked — the page still works, it just won't remember
  }
}

/**
 * The page's selected team, starting on this device's remembered team.
 * `chooseTeam` is for a coach's own pick, which also becomes the new default.
 */
export function useMyTeam() {
  const [team, setTeam] = useState<TeamSlug>(TEAMS[0].slug);

  // Read after mount, so the server-rendered page and the first client render
  // agree; the setState here runs once.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const saved = getMyTeam();
    if (saved) setTeam(saved);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const chooseTeam = useCallback((slug: TeamSlug) => {
    setTeam(slug);
    setMyTeam(slug);
  }, []);

  return [team, chooseTeam] as const;
}
