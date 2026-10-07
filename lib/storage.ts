import { getKv, kvCredentials } from "./kv";
export interface Submission {
  id: string;
  childName: string;
  // the squad member picked on the form (see lib/kitSquad.ts); absent when the
  // parent typed a name because their child wasn't listed, and on older answers
  playerId?: string;
  shirtSize: string;
  shortsSize: string;
  socksSize: string;
  submittedAt: string;
}


// Each team's submissions live under their own Redis list key in the one shared
// store, e.g. "kit_submissions:lions". This keeps the teams fully isolated
// without needing separate KV/Upstash databases.
const keyFor = (team: string) => `kit_submissions:${team}`;

export async function saveSubmission(
  team: string,
  data: Omit<Submission, "id" | "submittedAt">
): Promise<{ saved: boolean; submission: Submission }> {
  const submission: Submission = {
    ...data,
    id: crypto.randomUUID(),
    submittedAt: new Date().toISOString(),
  };
  const kv = await getKv();
  if (kv) {
    await kv.lpush(keyFor(team), JSON.stringify(submission));
    return { saved: true, submission };
  }
  return { saved: false, submission };
}

export async function getSubmissions(team: string): Promise<Submission[]> {
  const kv = await getKv();
  if (!kv) return [];
  const items = await kv.lrange<string>(keyFor(team), 0, -1);
  return items.map((item) => (typeof item === "string" ? JSON.parse(item) : item));
}

export async function deleteSubmission(team: string, id: string): Promise<void> {
  const kv = await getKv();
  if (!kv) return;
  const key = keyFor(team);
  const items = await kv.lrange<string>(key, 0, -1);
  const parsed: Submission[] = items.map((item) =>
    typeof item === "string" ? JSON.parse(item) : item
  );
  const target = parsed.find((s) => s.id === id);
  if (target) await kv.lrem(key, 1, JSON.stringify(target));
}

export const isKvConfigured = () => !!kvCredentials();
