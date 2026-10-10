// A person's own profile photo (Your Account), shown in the profile badge.
// Kept with their account, not with any club, as a small square JPEG; only
// they can load it. Server only.
import { kvCall } from "./access";

const photoKey = (userId: string) => `platform:user-photo:${userId}`;
/** When it last changed — read on every page, so it's kept apart from the picture. */
const versionKey = (userId: string) => `platform:user-photo-v:${userId}`;

export const MAX_PHOTO_BYTES = 200_000;

/** The address of `userId`'s photo for the profile badge, or null if they haven't added one. */
export async function photoUrl(userId: string): Promise<string | null> {
  const v = await kvCall<string | null>(["GET", versionKey(userId)]);
  return v ? `/api/account/photo?v=${v}` : null;
}

export async function getPhoto(userId: string): Promise<Buffer | null> {
  const data = await kvCall<string | null>(["GET", photoKey(userId)]);
  return data ? Buffer.from(data, "base64") : null;
}

export async function setPhoto(userId: string, jpeg: Buffer): Promise<void> {
  await kvCall(["SET", photoKey(userId), jpeg.toString("base64")]);
  await kvCall(["SET", versionKey(userId), String(Date.now())]);
}

export async function deletePhoto(userId: string): Promise<void> {
  await kvCall(["DEL", photoKey(userId), versionKey(userId)]);
}
