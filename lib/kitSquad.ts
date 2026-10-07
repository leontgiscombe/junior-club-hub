// The kit form's "pick your child" list. On a hub open to everyone the form
// never sees a child's full name: each squad member appears as their first name
// and surname initial ("Jamie S."), with more of the surname only when two
// would read the same. A private hub, seen only by approved members, shows full
// names (lib/names.ts). The full name is looked up on the server from the
// player's id when the form is sent.
import { showFullNames } from "./names";
import { listPlayers, type Player } from "./statsStorage";

export interface SquadOption {
  id: string;
  label: string;
}

function shortLabel(name: string, letters: number): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "";
  const surname = parts[parts.length - 1];
  return `${parts[0]} ${surname.slice(0, letters)}.`;
}

export function squadLabels(players: Pick<Player, "id" | "name">[]): SquadOption[] {
  const options = players.map((p) => {
    // lengthen the surname part until no one else in the squad reads the same
    let letters = 1;
    const max = Math.max(1, ...p.name.split(/\s+/).map((w) => w.length));
    while (
      letters < max &&
      players.some((o) => o.id !== p.id && shortLabel(o.name, letters) === shortLabel(p.name, letters))
    ) {
      letters++;
    }
    return { id: p.id, label: shortLabel(p.name, letters) };
  });
  return options.sort((a, b) => a.label.localeCompare(b.label));
}

/** A team's squad, ready for the kit form. */
export async function kitSquad(team: string): Promise<SquadOption[]> {
  const [players, full] = await Promise.all([listPlayers(), showFullNames()]);
  const squad = players.filter((p) => p.team === team);
  if (full) return squad.map((p) => ({ id: p.id, label: p.name.trim() })).sort((a, b) => a.label.localeCompare(b.label));
  return squadLabels(squad);
}

/** The squad member a kit form named, if they're in that team. */
export async function squadPlayer(team: string, id: string): Promise<Player | null> {
  if (!id) return null;
  return (await listPlayers()).find((p) => p.id === id && p.team === team) ?? null;
}
