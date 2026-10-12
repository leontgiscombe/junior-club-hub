// The player device a request comes from (lib/playerDevices.ts), and what the
// Training Hub may show about them: first name, initials and team. Server only.
import { cookies } from "next/headers";
import { PLAYER_COOKIE, playerSession, type PlayerSession } from "./access";
import { getTeams } from "./settings";
import { listPlayers } from "./statsStorage";
import { getTenant } from "./tenant";

export async function currentPlayer(): Promise<PlayerSession | null> {
  const tenant = await getTenant();
  if (!tenant) return null;
  const token = (await cookies()).get(PLAYER_COOKIE)?.value ?? "";
  return playerSession(tenant, token).catch(() => null);
}

/** The signed-in player as their device shows them — never their surname or anyone else's details. */
export async function playerView(session: PlayerSession) {
  const [players, teams] = await Promise.all([listPlayers(), getTeams()]);
  const p = players.find((x) => x.id === session.playerId);
  if (!p) return null;
  const words = p.name.trim().split(/\s+/).filter(Boolean);
  const t = teams.find((x) => x.slug === p.team);
  return {
    firstName: words[0] ?? "",
    initials: words.slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?",
    team: t ? { slug: t.slug, name: t.name } : null,
  };
}
