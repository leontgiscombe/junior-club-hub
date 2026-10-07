// The club's settings in the database: the identity changes saved on Coach
// Admin → Settings, the teams and the uploaded pictures (crest and kit). Server only. Reads take
// the club from the request unless one is named (the reminders job goes
// through every club); on the platform's own site they give the defaults.
import { cache } from "react";
import { redirect } from "next/navigation";
import { CLUB } from "@/club.config";
import {
  DEFAULT_CLUB,
  DEFAULT_KIT_IMAGE,
  DEFAULT_TEAMS,
  cleanChanges,
  cleanTeams,
  type Club,
  type ClubChanges,
  type Feature,
  type Team,
} from "./clubSettings";
import { getKv } from "./kv";
import { getTenant } from "./tenant";
import { tenantExists } from "./tenants";

const CHANGES_KEY = `${CLUB.storagePrefix}:settings:club`;
const TEAMS_KEY = `${CLUB.storagePrefix}:settings:teams`;

/** The pictures a club can upload: its crest and its kit. */
export type ImageSlot = "crest" | "kit";
// each picture, and its size and date without the image, for building each page
const IMAGE_KEYS: Record<ImageSlot, { data: string; info: string }> = {
  crest: { data: `${CLUB.storagePrefix}:settings:crest`, info: `${CLUB.storagePrefix}:settings:crest-info` },
  kit: { data: `${CLUB.storagePrefix}:settings:kit-image`, info: `${CLUB.storagePrefix}:settings:kit-image-info` },
};

/** An uploaded picture: the image itself (base64) and its size. */
export type StoredImage = { type: string; data: string; width: number; height: number; updatedAt: string };
export type StoredCrest = StoredImage;

/** The database for `tenant`, or the request's club; null when there's no club. */
async function kvFor(tenant?: string) {
  const t = tenant ?? (await getTenant());
  return t && (await tenantExists(t)) ? getKv(t) : null;
}


export async function getClubChanges(tenant?: string): Promise<ClubChanges> {
  const kv = await kvFor(tenant);
  if (!kv) return {};
  try {
    return cleanChanges(await kv.get(CHANGES_KEY));
  } catch {
    return {};
  }
}

export async function saveClubChanges(changes: ClubChanges, tenant?: string): Promise<void> {
  const kv = await getKv(tenant);
  if (!kv) throw new Error("Storage isn't set up");
  await kv.set(CHANGES_KEY, cleanChanges(changes));
}

export async function getImageInfo(slot: ImageSlot, tenant?: string): Promise<Omit<StoredImage, "data"> | null> {
  const kv = await kvFor(tenant);
  if (!kv) return null;
  try {
    return (await kv.get<Omit<StoredImage, "data">>(IMAGE_KEYS[slot].info)) ?? null;
  } catch {
    return null;
  }
}

export async function getImage(slot: ImageSlot): Promise<StoredImage | null> {
  const kv = await kvFor();
  if (!kv) return null;
  try {
    return (await kv.get<StoredImage>(IMAGE_KEYS[slot].data)) ?? null;
  } catch {
    return null;
  }
}

/** Save an uploaded picture, or remove it (null) to go back to the default. */
export async function saveImage(slot: ImageSlot, image: StoredImage | null): Promise<void> {
  const kv = await getKv();
  if (!kv) throw new Error("Storage isn't set up");
  const keys = IMAGE_KEYS[slot];
  if (image) {
    const { type, width, height, updatedAt } = image;
    await kv.set(keys.data, image);
    await kv.set(keys.info, { type, width, height, updatedAt });
  } else {
    await kv.del(keys.data, keys.info);
  }
}

export const getCrest = () => getImage("crest");

/**
 * The club as every page shows it: club.config.ts with the saved changes and
 * crest laid over it. Read once per request.
 */
export const getClub = cache(async (): Promise<Club> => {
  const { club } = await getClubWithIcons();
  return club;
});

/** The home-screen icons: made from the uploaded crest, or the defaults in public/. */
export type ClubIcons = { icon: string; apple: string; large: string };

export const getClubWithIcons = cache(() => clubWithIcons());

/** A named club's settings (outside a request for it, like the reminders job). */
export async function getClubFor(tenant: string): Promise<Club> {
  return (await clubWithIcons(tenant)).club;
}

async function clubWithIcons(tenant?: string): Promise<{ club: Club; icons: ClubIcons }> {
  const [changes, crest, kit] = await Promise.all([
    getClubChanges(tenant),
    getImageInfo("crest", tenant),
    getImageInfo("kit", tenant),
  ]);
  const club: Club = {
    ...DEFAULT_CLUB,
    ...changes,
    crest: { ...DEFAULT_CLUB.crest },
    kitImage: kit
      ? { src: `/api/club/kit?v=${encodeURIComponent(kit.updatedAt)}`, width: kit.width, height: kit.height }
      : { ...DEFAULT_KIT_IMAGE },
    features: { ...DEFAULT_CLUB.features, ...changes.features },
  };
  if (crest) {
    club.crest = {
      src: `/api/club/crest?v=${encodeURIComponent(crest.updatedAt)}`,
      alt: `${club.name} crest`,
      width: crest.width,
      height: crest.height,
    };
  }
  const v = crest ? encodeURIComponent(crest.updatedAt) : "";
  const icons: ClubIcons = crest
    ? { icon: club.crest.src, apple: `/api/club/icon?size=180&v=${v}`, large: `/api/club/icon?size=512&v=${v}` }
    : { icon: DEFAULT_CLUB.crest.src, apple: "/hub-icon-180.png", large: "/hub-icon-512.png" };
  return { club, icons };
}

/** Every team, archived ones included: the saved list, or club.config.ts's. */
export const getAllTeams = cache(() => getAllTeamsFor());

/** Every team of `tenant` (by default, the request's club), archived ones included. */
export async function getAllTeamsFor(tenant?: string): Promise<Team[]> {
  const kv = await kvFor(tenant);
  if (!kv) return DEFAULT_TEAMS;
  try {
    return cleanTeams(await kv.get(TEAMS_KEY)) ?? DEFAULT_TEAMS;
  } catch {
    return DEFAULT_TEAMS;
  }
}

/** The teams in use: everything except archived ones. */
export const getTeams = cache(async (): Promise<Team[]> =>
  (await getAllTeams()).filter((t) => !t.archived),
);

/** Whether `slug` is a team in use — for checking a team named in a request. */
export async function isTeam(slug: string): Promise<boolean> {
  return (await getTeams()).some((t) => t.slug === slug);
}

export async function saveTeams(teams: Team[]): Promise<void> {
  const clean = cleanTeams(teams);
  if (!clean) throw new Error("Keep at least one team");
  const kv = await getKv();
  if (!kv) throw new Error("Storage isn't set up");
  await kv.set(TEAMS_KEY, clean);
}

/** Send a visitor away from a part of the hub the club has switched off. */
export async function requireFeature(feature: Feature, elsewhere = "/"): Promise<void> {
  if (!(await getClub()).features[feature]) redirect(elsewhere);
}
