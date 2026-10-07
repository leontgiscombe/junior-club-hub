// The old standalone camera register (Redis hash `camera_fixtures`). Home
// fixtures, who filmed them and whether the footage was uploaded now live on
// the matches themselves, so this only remains to read those old fixtures once
// and carry them across — see app/api/camera/route.ts.
export interface Fixture {
  id: string;
  team: string; // team slug (see lib/teams.ts)
  opponent: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (24h)
  holder: string; // who has the camera for this game (see lib/cameraHolders.ts); "" if unset
  uploaded: boolean;
  createdAt: string;
}

async function getKv() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  try {
    const { kv } = await import("@vercel/kv");
    return kv;
  } catch {
    return null;
  }
}

const KEY = "camera_fixtures";

function parse(value: unknown): Fixture {
  return typeof value === "string" ? (JSON.parse(value) as Fixture) : (value as Fixture);
}

export async function addFixture(
  data: Omit<Fixture, "id" | "uploaded" | "createdAt">
): Promise<{ saved: boolean; fixture: Fixture }> {
  const fixture: Fixture = {
    ...data,
    id: crypto.randomUUID(),
    uploaded: false,
    createdAt: new Date().toISOString(),
  };
  const kv = await getKv();
  if (kv) {
    await kv.hset(KEY, { [fixture.id]: JSON.stringify(fixture) });
    return { saved: true, fixture };
  }
  return { saved: false, fixture };
}

// Update the mutable fields of one fixture (who has the camera, uploaded flag).
export async function updateFixture(
  id: string,
  patch: Partial<Pick<Fixture, "holder" | "uploaded">>
): Promise<boolean> {
  const kv = await getKv();
  if (!kv) return false;
  const current = await kv.hget<unknown>(KEY, id);
  if (current == null) return false;
  const fixture = { ...parse(current), ...patch };
  await kv.hset(KEY, { [id]: JSON.stringify(fixture) });
  return true;
}

export async function listFixtures(): Promise<Fixture[]> {
  const kv = await getKv();
  if (!kv) return [];
  const all = await kv.hgetall<Record<string, unknown>>(KEY);
  if (!all) return [];
  return Object.values(all).map(parse);
}

export async function deleteFixture(id: string): Promise<void> {
  const kv = await getKv();
  if (!kv) return;
  await kv.hdel(KEY, id);
}

/** Drop the old register once its fixtures have been imported. */
export async function clearFixtures(): Promise<void> {
  const kv = await getKv();
  if (!kv) return;
  await kv.del(KEY);
}
