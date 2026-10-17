import { childrenOf, type Person } from "./access";
import { kitFamily, listKitRequests, type KitRequest } from "./kitRequests";
import { getTeams } from "./settings";
import { listPlayers } from "./statsStorage";
import { getSubmissions, type Submission } from "./storage";

export type ParentKitChild = {
  id: string;
  name: string;
  team: string;
  teamName: string;
  playerId?: string;
  submissions: Submission[];
};

export type ParentKitRequest = Pick<KitRequest, "id" | "team" | "childName" | "item" | "size" | "quantity" | "note" | "createdAt" | "doneAt">;
export type ParentKitData = { family: ParentKitChild[]; requests: ParentKitRequest[] };

const sameName = (first: string, second: string) => first.trim().replace(/\s+/g, " ").toLowerCase() === second.trim().replace(/\s+/g, " ").toLowerCase();

export async function parentKitData(person: Person): Promise<ParentKitData> {
  if (person.status !== "approved") throw new Error("Approved membership is required");
  const [teams, roster, requests] = await Promise.all([getTeams(), listPlayers(), listKitRequests()]);
  const family = kitFamily(person).filter((child) => teams.some((team) => team.slug === child.team));
  const submissions = new Map(await Promise.all([...new Set(family.map((child) => child.team))].map(async (team) => [team, await getSubmissions(team)] as const)));
  return {
    family: family.map((child) => {
      const linkedId = childrenOf(person).find((entry) => entry.id === child.id)?.playerId;
      const named = roster.filter((player) => player.team === child.team && sameName(player.name, child.name));
      const playerId = linkedId ?? (named.length === 1 ? named[0].id : undefined);
      const legacySafe = named.length <= 1 && (!linkedId || !named.length || named[0].id === linkedId);
      return {
        ...child,
        teamName: teams.find((team) => team.slug === child.team)?.name ?? child.team,
        ...(playerId ? { playerId } : {}),
        submissions: (submissions.get(child.team) ?? []).filter((submission) => submission.playerId
          ? !!playerId && submission.playerId === playerId
          : legacySafe && sameName(submission.childName, child.name)).sort((first, second) => second.submittedAt.localeCompare(first.submittedAt)),
      };
    }),
    requests: requests.filter((request) => request.userId === person.userId).map(({ id, team, childName, item, size, quantity, note, createdAt, doneAt }) => ({ id, team, childName, item, size, quantity, note, createdAt, doneAt })),
  };
}