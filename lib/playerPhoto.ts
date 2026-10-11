// A squad player's photo (Coach Admin → Members → the player's profile): a
// small square JPEG kept with the club. A child's photo, so only the club's
// coaches and admins and the child's own parents or carers can load it — never
// a public page, Search or an alert (app/api/players/photo). Server only.
import { getKv } from "./kv";

const photoKey = (id: string) => `player_photo:${id}`;
/** Each player's photo version, read with the squad (kept apart from the pictures). */
const VERSIONS = "player_photo_v";

export const MAX_PLAYER_PHOTO_BYTES = 200_000;

/** Player id → version, for every player with a photo. */
export async function playerPhotoVersions(): Promise<Record<string, string>> {
  const kv = await getKv();
  if (!kv) return {};
  return ((await kv.hgetall<Record<string, unknown>>(VERSIONS)) ?? {}) as Record<string, string>;
}

export async function getPlayerPhoto(id: string): Promise<Buffer | null> {
  const kv = await getKv();
  const data = kv ? await kv.get<string>(photoKey(id)) : null;
  return data ? Buffer.from(data, "base64") : null;
}

export async function setPlayerPhoto(id: string, jpeg: Buffer): Promise<void> {
  const kv = await getKv();
  if (!kv) throw new Error("Storage isn't set up");
  await kv.set(photoKey(id), jpeg.toString("base64"));
  await kv.hset(VERSIONS, { [id]: String(Date.now()) });
}

export async function deletePlayerPhoto(id: string): Promise<void> {
  const kv = await getKv();
  if (!kv) return;
  await kv.del(photoKey(id));
  await kv.hdel(VERSIONS, id);
}
