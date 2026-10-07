// The club's settings in the database: the identity changes saved on Coach
// Admin → Settings, and the uploaded crest. Server only.
import { cache } from "react";
import { CLUB } from "@/club.config";
import {
  DEFAULT_CLUB,
  DEFAULT_TEAMS,
  cleanChanges,
  cleanTeams,
  type Club,
  type ClubChanges,
  type Team,
} from "./clubSettings";

const CHANGES_KEY = `${CLUB.storagePrefix}:settings:club`;
const TEAMS_KEY = `${CLUB.storagePrefix}:settings:teams`;
const CREST_KEY = `${CLUB.storagePrefix}:settings:crest`;
// the crest's size and date without the image, for building each page
const CREST_INFO_KEY = `${CLUB.storagePrefix}:settings:crest-info`;

/** An uploaded crest: the image itself (base64) and its size. */
export type StoredCrest = { type: string; data: string; width: number; height: number; updatedAt: string };

async function getKv() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  try {
    const { kv } = await import("@vercel/kv");
    return kv;
  } catch {
    return null;
  }
}

export async function getClubChanges(): Promise<ClubChanges> {
  const kv = await getKv();
  if (!kv) return {};
  try {
    return cleanChanges(await kv.get(CHANGES_KEY));
  } catch {
    return {};
  }
}

export async function saveClubChanges(changes: ClubChanges): Promise<void> {
  const kv = await getKv();
  if (!kv) throw new Error("Storage isn't set up");
  await kv.set(CHANGES_KEY, cleanChanges(changes));
}

async function getCrestInfo(): Promise<Omit<StoredCrest, "data"> | null> {
  const kv = await getKv();
  if (!kv) return null;
  try {
    return (await kv.get<Omit<StoredCrest, "data">>(CREST_INFO_KEY)) ?? null;
  } catch {
    return null;
  }
}

export async function getCrest(): Promise<StoredCrest | null> {
  const kv = await getKv();
  if (!kv) return null;
  try {
    return (await kv.get<StoredCrest>(CREST_KEY)) ?? null;
  } catch {
    return null;
  }
}

export async function saveCrest(crest: StoredCrest | null): Promise<void> {
  const kv = await getKv();
  if (!kv) throw new Error("Storage isn't set up");
  if (crest) {
    const { type, width, height, updatedAt } = crest;
    await kv.set(CREST_KEY, crest);
    await kv.set(CREST_INFO_KEY, { type, width, height, updatedAt });
  } else {
    await kv.del(CREST_KEY, CREST_INFO_KEY);
  }
}

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

export const getClubWithIcons = cache(async (): Promise<{ club: Club; icons: ClubIcons }> => {
  const [changes, crest] = await Promise.all([getClubChanges(), getCrestInfo()]);
  const club: Club = { ...DEFAULT_CLUB, ...changes, crest: { ...DEFAULT_CLUB.crest } };
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
});

/** Every team, archived ones included: the saved list, or club.config.ts's. */
export const getAllTeams = cache(async (): Promise<Team[]> => {
  const kv = await getKv();
  if (!kv) return DEFAULT_TEAMS;
  try {
    return cleanTeams(await kv.get(TEAMS_KEY)) ?? DEFAULT_TEAMS;
  } catch {
    return DEFAULT_TEAMS;
  }
});

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
