// The club's identity as the app uses it: club.config.ts gives the defaults,
// and whatever a coach saves on Coach Admin → Settings is laid over them
// (lib/settings.ts). Safe to import anywhere, on the server or in the browser.
import { CLUB as DEFAULTS } from "@/club.config";

export type Club = {
  name: string;
  initials: string;
  fullName: string;
  slogan: string;
  crest: { src: string; alt: string; width: number; height: number };
  publicResults: boolean;
  kitSeason: string;
  faClubName: string;
  storagePrefix: string;
};

export const DEFAULT_CLUB: Club = { ...DEFAULTS, crest: { ...DEFAULTS.crest } };

/** What a coach can change on the Settings page, with each field's limit. */
export const EDITABLE = {
  name: 40,
  initials: 4,
  fullName: 60,
  slogan: 80,
  kitSeason: 20,
} as const;
export type EditableText = keyof typeof EDITABLE;

/** The saved changes: any of the text fields, and whether results are public. */
export type ClubChanges = Partial<Record<EditableText, string>> & { publicResults?: boolean };

/** Keep only well-formed, trimmed fields within their limits. */
export function cleanChanges(input: unknown): ClubChanges {
  const out: ClubChanges = {};
  if (!input || typeof input !== "object") return out;
  const src = input as Record<string, unknown>;
  for (const field of Object.keys(EDITABLE) as EditableText[]) {
    const v = src[field];
    if (typeof v === "string" && v.trim()) out[field] = v.trim().slice(0, EDITABLE[field]);
  }
  if (typeof src.publicResults === "boolean") out.publicResults = src.publicResults;
  return out;
}
