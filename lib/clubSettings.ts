// The club's identity as the app uses it: club.config.ts gives the defaults,
// and whatever a coach saves on Coach Admin → Settings is laid over them
// (lib/settings.ts). Safe to import anywhere, on the server or in the browser.
import { CLUB as DEFAULTS, TEAMS as DEFAULT_TEAM_LIST } from "@/club.config";

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

/**
 * A team. Its slug names it in links and stored data, so it never changes;
 * everything else can. A removed team is only archived: its data stays, and
 * it can be brought back.
 */
export type Team = {
  slug: string;
  name: string;
  accent: string;
  squadName?: string;
  faSnippet?: string;
  opponents?: string[];
  archived?: boolean;
};

export const DEFAULT_TEAMS: Team[] = DEFAULT_TEAM_LIST.map((t) => ({
  ...t,
  opponents: t.opponents ? [...t.opponents] : undefined,
}));

/** A slug for a new team's name, not clashing with any team, archived or not. */
export function slugFor(name: string, teams: Team[]): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "team";
  let slug = base;
  for (let n = 2; teams.some((t) => t.slug === slug); n++) slug = `${base}-${n}`;
  return slug;
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Keep only well-formed teams, each slug once; null if nothing usable is left. */
export function cleanTeams(input: unknown): Team[] | null {
  if (!Array.isArray(input)) return null;
  const out: Team[] = [];
  for (const raw of input.slice(0, 30)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const slug = text(r.slug, 40);
    const name = text(r.name, 30);
    if (!SLUG.test(slug) || !name || out.some((t) => t.slug === slug)) continue;
    const team: Team = { slug, name, accent: text(r.accent, 8) || "⚽" };
    const squadName = text(r.squadName, 30);
    if (squadName) team.squadName = squadName;
    const faSnippet = text(r.faSnippet, 15);
    if (/^\d+$/.test(faSnippet)) team.faSnippet = faSnippet;
    if (Array.isArray(r.opponents)) {
      const opponents = r.opponents.map((o) => text(o, 80)).filter(Boolean).slice(0, 40);
      if (opponents.length) team.opponents = opponents;
    }
    if (r.archived === true) team.archived = true;
    out.push(team);
  }
  return out.some((t) => !t.archived) ? out : null;
}
