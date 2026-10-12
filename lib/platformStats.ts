// The platform admin's view of each club (app/platform/admin): how big it is,
// when it was last used, which parts it uses and how far it's got setting up,
// plus the admin's own notes on it and a log of what the admin has done.
// Counts only: no children's names or anyone's details beyond the club's
// admins, who are the platform's customers. Server only.
import { childrenOf, invitesKey, kvCall, peopleKey, readAccess, type Person } from "./access";
import { activeKey } from "./clubStatus";
import type { Feature } from "./clubSettings";
import { keyPrefix } from "./kv";
import { getAllTeamsFor, getClubFor, getImageInfo } from "./settings";
import type { AdminTenant } from "./tenants";

export type ClubStats = AdminTenant & {
  lastActive: string | null;
  members: number;
  waiting: number;
  coaches: number;
  parents: number;
  players: number;
  teams: number;
  matches: number;
  training: number;
  invites: number;
  private: boolean;
  features: Feature[];
  /** how far it's got: a crest, someone besides its admin, a squad, a game or session logged */
  setup: { crest: boolean; members: boolean; squad: boolean; logged: boolean };
  admins: { name: string; email: string; phone?: string }[];
  notes: string;
};

const notesKey = (id: string) => `platform:club-notes:${id}`;
const LOG_KEY = "platform:admin-log";

const count = async (key: string) => Number((await kvCall<number | null>(["HLEN", key]).catch(() => 0)) ?? 0);

export async function clubStats(club: AdminTenant): Promise<ClubStats> {
  const t = club.id;
  const kp = keyPrefix(t);
  const [flat, players, matches, training, invites, teams, info, crest, access, lastActive, notes] = await Promise.all([
    kvCall<string[] | null>(["HGETALL", peopleKey(t)]).catch(() => null),
    count(`${kp}player_stats`),
    count(`${kp}matches`),
    count(`${kp}training`),
    count(invitesKey(t)),
    getAllTeamsFor(t).catch(() => []),
    getClubFor(t).catch(() => null),
    getImageInfo("crest", t).catch(() => null),
    readAccess(t).catch(() => null),
    kvCall<string | null>(["GET", activeKey(t)]).catch(() => null),
    kvCall<string | null>(["GET", notesKey(t)]).catch(() => null),
  ]);
  const people: Person[] = [];
  for (let i = 0; i + 1 < (flat ?? []).length; i += 2) {
    try {
      people.push(JSON.parse(flat![i + 1]) as Person);
    } catch {}
  }
  const approved = people.filter((p) => p.status === "approved");
  const admins = approved
    .filter((p) => p.roles.includes("admin"))
    .map((p) => ({ name: p.name, email: p.email, ...(p.phone ? { phone: p.phone } : {}) }));
  const features = info ? (Object.entries(info.features) as [Feature, boolean][]).filter(([, on]) => on).map(([f]) => f) : [];
  return {
    ...club,
    lastActive: typeof lastActive === "string" ? lastActive : null,
    members: approved.length,
    waiting: people.filter((p) => p.status === "pending").length,
    coaches: approved.filter((p) => p.roles.includes("coach")).length,
    parents: approved.filter((p) => childrenOf(p).length > 0).length,
    players,
    teams: teams.filter((x) => !x.archived).length,
    matches,
    training,
    invites,
    private: !!access?.private,
    features,
    setup: { crest: !!crest, members: approved.length > 1, squad: players > 0, logged: matches + training > 0 },
    admins,
    notes: typeof notes === "string" ? notes : "",
  };
}

export async function setNotes(id: string, text: string): Promise<void> {
  const clean = text.trim().slice(0, 4000);
  await kvCall(clean ? ["SET", notesKey(id), clean] : ["DEL", notesKey(id)]);
}

export async function forgetClubExtras(id: string): Promise<void> {
  await kvCall(["DEL", notesKey(id), activeKey(id)]);
}

export type LogEntry = { at: string; action: string; club: string; detail?: string };

/** One more line in the platform admin's log (the latest 200 are kept). */
export async function logAdmin(action: string, club: string, detail?: string): Promise<void> {
  const entry: LogEntry = { at: new Date().toISOString(), action, club, ...(detail ? { detail } : {}) };
  await kvCall(["LPUSH", LOG_KEY, JSON.stringify(entry)]).catch(() => {});
  await kvCall(["LTRIM", LOG_KEY, 0, 199]).catch(() => {});
}

export async function adminLog(): Promise<LogEntry[]> {
  const raw = (await kvCall<string[] | null>(["LRANGE", LOG_KEY, 0, 49]).catch(() => null)) ?? [];
  return raw.flatMap((r) => {
    try {
      return [JSON.parse(r) as LogEntry];
    } catch {
      return [];
    }
  });
}
