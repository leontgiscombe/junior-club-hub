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
  /** The picture of the kit on the home page and kit pages. */
  kitImage: { src: string; width: number; height: number };
  publicResults: boolean;
  kitSeason: string;
  faClubName: string;
  storagePrefix: string;
  /** Which parts of the hub the club uses (results have their own switch). */
  features: Features;
  /** The club's main colour (#rrggbb); none keeps the hub green. */
  colour?: string;
  /** Kit items beyond shirt, shorts and socks that parents send sizes for. */
  kitExtras: KitExtra[];
};

/** The kit items a club can add to the kit form (Coach Admin → Settings → Kit). */
export const KIT_EXTRAS = {
  jacket: { label: "Long Sleeve Jacket", short: "Jacket", emoji: "🧥" },
  rainJacket: { label: "Waterproof Rain Jacket", short: "Rain Jacket", emoji: "🌧️" },
} as const;
export type KitExtra = keyof typeof KIT_EXTRAS;
export const isKitExtra = (v: unknown): v is KitExtra => typeof v === "string" && v in KIT_EXTRAS;
/** What a parent picks for an extra their child won't have. */
export const NOT_NEEDED = "Not needed";

/** The parts of the hub a club can switch off on Coach Admin → Settings. */
export const FEATURES = {
  trainingHub: { label: "Player Training Hub", hint: "The players' tactics guide, quiz and skill challenges." },
  kitSizes: { label: "Kit Sizes", hint: "Parents send their child's kit sizes; coaches see the responses." },
  financialAdmin: { label: "Finances", hint: "Each team's subs, payments and spending." },
  playerOfMonth: { label: "Player of the Month", hint: "The monthly winner from the awards, with a poster." },
  trainingPlans: { label: "Training Plans", hint: "Weekly session plans from a shared drill library." },
  cameraRegister: { label: "Camera Register", hint: "Who films each home game, and whether it's uploaded." },
} as const;
export type Feature = keyof typeof FEATURES;
export type Features = Record<Feature, boolean>;

const ALL_ON = Object.fromEntries(Object.keys(FEATURES).map((f) => [f, true])) as Features;

export const DEFAULT_KIT_IMAGE = { src: "/kit-generic.jpg", width: 1024, height: 557 };

/**
 * The shape of the box the kit picture sits in: the picture's own, kept
 * between square and wide, so a tall photo doesn't fill the page (it's shown
 * whole inside the box).
 */
export const kitAspect = ({ width, height }: { width: number; height: number }) =>
  `${Math.min(Math.max(width / height, 1), 2.2).toFixed(3)}`;

export const DEFAULT_CLUB: Club = {
  ...DEFAULTS,
  crest: { ...DEFAULTS.crest },
  kitImage: { ...DEFAULT_KIT_IMAGE },
  features: { ...ALL_ON },
  kitExtras: [],
};

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
export type ClubChanges = Partial<Record<EditableText, string>> & {
  publicResults?: boolean;
  features?: Partial<Features>;
  colour?: string;
  kitExtras?: KitExtra[];
};

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
  if (typeof src.colour === "string" && /^#[0-9a-f]{6}$/i.test(src.colour)) out.colour = src.colour.toLowerCase();
  if (Array.isArray(src.kitExtras)) {
    out.kitExtras = (Object.keys(KIT_EXTRAS) as KitExtra[]).filter((e) => (src.kitExtras as unknown[]).includes(e));
  }
  if (src.features && typeof src.features === "object") {
    const features: Partial<Features> = {};
    for (const f of Object.keys(FEATURES) as Feature[]) {
      const v = (src.features as Record<string, unknown>)[f];
      if (typeof v === "boolean") features[f] = v;
    }
    if (Object.keys(features).length) out.features = features;
  }
  return out;
}

/**
 * A team. Its slug names it in links and stored data, so it never changes;
 * everything else can. A removed team is only archived: its data stays, and
 * it can be brought back.
 */
/** The match formats the Training Hub has content for, youngest first. */
export const GAME_FORMATS = ["5v5", "7v7", "9v9", "11v11"] as const;
export type GameFormat = (typeof GAME_FORMATS)[number];
export const isGameFormat = (v: unknown): v is GameFormat => GAME_FORMATS.includes(v as GameFormat);
/** The 7v7 shapes the Training Hub teaches: a 7v7 team plays 2-3-1 unless Settings says otherwise. */
export const FORMATIONS_7V7 = ["2-3-1", "3-2-1"] as const;
export type Formation7v7 = (typeof FORMATIONS_7V7)[number];
export const isFormation7v7 = (v: unknown): v is Formation7v7 => FORMATIONS_7V7.includes(v as Formation7v7);
/** Each format's age group, as clubs say it: "Under 9s & 10s". */
export const FORMAT_AGES: Record<GameFormat, string> = {
  "5v5": "Under 7s & 8s",
  "7v7": "Under 9s & 10s",
  "9v9": "Under 11s & 12s",
  "11v11": "Under 13s and up",
};

/**
 * A team's match format: the one set in Settings, else worked out from an age
 * in its name ("U8 Blues" → 5v5, "Under 12s" → 9v9), else 7v7. The FA's
 * formats: U7–U8 5v5, U9–U10 7v7, U11–U12 9v9, U13 and up 11v11.
 */
export function teamFormat(team: Pick<Team, "name" | "format">): GameFormat {
  if (team.format) return team.format;
  const age = Number(/\b(?:u|under)[\s-]*(\d{1,2})/i.exec(team.name)?.[1] ?? NaN);
  if (!Number.isFinite(age)) return "7v7";
  return age <= 8 ? "5v5" : age <= 10 ? "7v7" : age <= 12 ? "9v9" : "11v11";
}

export type Team = {
  slug: string;
  name: string;
  accent: string;
  /** set in Settings for the Training Hub; unset means worked out (teamFormat) */
  format?: GameFormat;
  /** a 7v7 team's shape, set in Settings: the Training Hub teaches its players this one (unset: 2-3-1) */
  formation?: Formation7v7;
  squadName?: string;
  faSnippet?: string;
  opponents?: string[];
  /** When the team trains each week; unset means Mondays (DEFAULT_TRAINING), [] means no regular training. */
  training?: TrainingSlot[];
  /**
   * The days the team trained on before a change, oldest first: each entry's
   * sessions are used for dates before its `until`. So moving a team from
   * Monday to Tuesday changes its sessions from that day on, not the ones
   * already past (set by the server when teams are saved: withTrainingHistory).
   */
  trainingHistory?: { until: string; training: TrainingSlot[] }[];
  archived?: boolean;
};

/** One weekly session: the day (0 Sunday … 6 Saturday) and, if known, its times as "HH:MM". */
export type TrainingSlot = { day: number; start?: string; end?: string };

/** Before a team's days are set, it trains on a Monday — as every team did before teams had their own. */
export const DEFAULT_TRAINING: TrainingSlot[] = [{ day: 1 }];
export const MAX_TRAINING_DAYS = 4;
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** A team's weekly sessions, in week order (Monday first). */
export function trainingOf(team: Pick<Team, "training"> | undefined): TrainingSlot[] {
  return [...(team?.training ?? DEFAULT_TRAINING)].sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7));
}

/** The weekly sessions a team had on `date` (YYYY-MM-DD), allowing for changes since. */
export function trainingOn(team: Pick<Team, "training" | "trainingHistory"> | undefined, date: string): TrainingSlot[] {
  const past = team?.trainingHistory?.find((h) => date < h.until);
  return past ? trainingOf(past) : trainingOf(team);
}

/** A team without its training days and times, for pages anyone can open. */
export function withoutTraining(team: Team): Team {
  const t = { ...team };
  delete t.training;
  delete t.trainingHistory;
  return t;
}

/**
 * The teams about to be saved, with each one's training history carried over
 * from what was saved before (never taken from the request), and a new entry
 * for any team whose days or times change, so the change applies from `today` on.
 */
export function withTrainingHistory(next: Team[], prev: Team[], today: string): Team[] {
  return next.map((team) => {
    const rest: Team = { ...team };
    delete rest.trainingHistory;
    const old = prev.find((t) => t.slug === team.slug);
    if (!old) return rest;
    const history = [...(old.trainingHistory ?? [])];
    const changed = JSON.stringify(trainingOf(old)) !== JSON.stringify(trainingOf(team));
    // changed twice in a day: the entry already made today holds the days before today
    if (changed && !history.some((h) => h.until === today)) history.push({ until: today, training: trainingOf(old) });
    return history.length ? { ...rest, trainingHistory: history } : rest;
  });
}

/** "18:00" as "6pm", "18:30" as "6:30pm". */
export function clockLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}

/** A session's times, e.g. "6pm–7pm", "6pm", or "" when none are set. */
export function timesLabel(slot: { start?: string; end?: string }): string {
  if (!slot.start) return "";
  return slot.end ? `${clockLabel(slot.start)}–${clockLabel(slot.end)}` : clockLabel(slot.start);
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Keep only well-formed sessions, one per day, in week order; null if none was given. */
export function cleanTraining(input: unknown): TrainingSlot[] | null {
  if (!Array.isArray(input)) return null;
  const out: TrainingSlot[] = [];
  for (const raw of input.slice(0, MAX_TRAINING_DAYS)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const day = Number(r.day);
    if (!Number.isInteger(day) || day < 0 || day > 6 || out.some((s) => s.day === day)) continue;
    const slot: TrainingSlot = { day };
    if (typeof r.start === "string" && TIME.test(r.start)) slot.start = r.start;
    if (slot.start && typeof r.end === "string" && TIME.test(r.end) && r.end > slot.start) slot.end = r.end;
    out.push(slot);
  }
  return trainingOf({ training: out });
}

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
    if (isGameFormat(r.format)) team.format = r.format;
    if (isFormation7v7(r.formation)) team.formation = r.formation;
    const faSnippet = text(r.faSnippet, 15);
    if (/^\d+$/.test(faSnippet)) team.faSnippet = faSnippet;
    if (Array.isArray(r.opponents)) {
      const opponents = r.opponents.map((o) => text(o, 80)).filter(Boolean).slice(0, 40);
      if (opponents.length) team.opponents = opponents;
    }
    const training = cleanTraining(r.training);
    if (training) team.training = training;
    if (Array.isArray(r.trainingHistory)) {
      const history = r.trainingHistory
        .slice(-20)
        .map((h) => (h && typeof h === "object" ? (h as Record<string, unknown>) : {}))
        .filter((h) => typeof h.until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(h.until))
        .map((h) => ({ until: h.until as string, training: cleanTraining(h.training) ?? DEFAULT_TRAINING }))
        .sort((a, b) => a.until.localeCompare(b.until));
      if (history.length) team.trainingHistory = history;
    }
    if (r.archived === true) team.archived = true;
    out.push(team);
  }
  return out.some((t) => !t.archived) ? out : null;
}
