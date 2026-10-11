"use client";

// Coach Admin → Settings: the club's name, initials, slogan, season, crest,
// kit picture, whether results are public, and its teams. Saved to the database and shown on
// every page straight away; an empty box goes back to the default in
// club.config.ts.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Club, ClubChanges, EditableText, Team } from "@/lib/clubSettings";
import { removeBackground } from "@/lib/crestBackground";
import { DEFAULT_TRAINING, EDITABLE, FEATURES, KIT_EXTRAS, MAX_TRAINING_DAYS, WEEKDAYS, kitAspect, slugFor, type Feature, type KitExtra, type TrainingSlot } from "@/lib/clubSettings";
import { DEFAULT_COLOUR_VARS, PRESET_COLOURS, clubColourVars } from "@/lib/palette";
import FinancePasswords from "./FinancePasswords";
import { accountKey, keyQuery, rememberCoachKey } from "./coachKey";
import { ToolSkeleton } from "./Skeleton";
import { Group, ICONS, Row, TopBar, useScreens } from "./SettingsUI";

type Snapshot = {
  club: Club;
  defaults: Club;
  changes: ClubChanges;
  crest: { width: number; height: number; updatedAt: string } | null;
  kitImage: { width: number; height: number; updatedAt: string } | null;
  teams: Team[];
  /** The club's own sign-in details on the platform (none on a single-club hub). */
  account: { email: string } | null;
};

/** A team being edited: its opponents as one per line, and no slug until it's first saved. */
type TeamDraft = Omit<Team, "opponents"> & { opponentsText: string };

const toDraft = (t: Team): TeamDraft => {
  const { opponents, ...rest } = t;
  return { ...rest, opponentsText: (opponents ?? []).join("\n") };
};

/** The drafts as teams to save, giving each new team a slug from its name. */
function fromDrafts(drafts: TeamDraft[]): Team[] {
  const out: Team[] = [];
  for (const d of drafts) {
    const { opponentsText, ...rest } = d;
    const team: Team = {
      ...rest,
      name: d.name.trim(),
      accent: d.accent.trim() || "⚽",
      squadName: d.squadName?.trim() || undefined,
      faSnippet: d.faSnippet?.trim() || undefined,
      opponents: opponentsText.split("\n").map((o) => o.trim()).filter(Boolean),
    };
    if (!team.opponents?.length) delete team.opponents;
    if (!team.squadName) delete team.squadName;
    if (!team.faSnippet) delete team.faSnippet;
    if (!team.archived) delete team.archived;
    if (!team.slug) team.slug = slugFor(team.name, [...drafts.filter((x) => x.slug) as Team[], ...out]);
    out.push(team);
  }
  return out;
}

const FIELDS: { field: EditableText; label: string; hint: string }[] = [
  { field: "name", label: "Club name", hint: "The short name, in headers and page titles." },
  { field: "fullName", label: "Full name", hint: "In footers and descriptions." },
  { field: "initials", label: "Initials", hint: "For tight spaces, like the poster's team label." },
  { field: "slogan", label: "Slogan", hint: "Shown in every footer and on posters." },
  { field: "kitSeason", label: "Season", hint: "The season the kit forms collect sizes for, e.g. 2026/27." },
];

/** Shrink an image file to fit within `max` pixels and turn it into a PNG data URL. */
/** The picture as a data: URL no bigger than `max` pixels a side: a PNG (keeps a see-through background) or a JPEG (for photos). */
type Picture = { image: string; width: number; height: number };
const pictureOf = (canvas: HTMLCanvasElement, type = "image/png"): Picture => ({
  image: canvas.toDataURL(type, 0.85),
  width: canvas.width,
  height: canvas.height,
});

/** A see-through kit picture has to be a PNG: made smaller until it's within the upload limit. */
const KIT_PNG_BYTES = 560 * 1024;
function pngWithin(canvas: HTMLCanvasElement, maxBytes: number): Picture {
  let pic = pictureOf(canvas);
  for (let scale = 0.85; (pic.image.length * 3) / 4 > maxBytes && scale > 0.2; scale -= 0.15) {
    const smaller = document.createElement("canvas");
    smaller.width = Math.max(1, Math.round(canvas.width * scale));
    smaller.height = Math.max(1, Math.round(canvas.height * scale));
    smaller.getContext("2d")!.drawImage(canvas, 0, 0, smaller.width, smaller.height);
    pic = pictureOf(smaller);
  }
  return pic;
}

async function shrinkImage(
  file: File,
  { max = 512, type = "image/png" }: { max?: number; type?: "image/png" | "image/jpeg" } = {},
): Promise<Picture> {
  return pictureOf(await shrinkToCanvas(file, { max, type }), type);
}

async function shrinkToCanvas(
  file: File,
  { max = 512, type = "image/png" }: { max?: number; type?: "image/png" | "image/jpeg" } = {},
): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That file doesn't look like an image"));
      el.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    if (type === "image/jpeg") {
      // a JPEG can't be see-through, so anything see-through becomes white
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(img, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ClubSettings() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  // working out who this is (an account, or a password given earlier) before showing the password box
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [draft, setDraft] = useState<ClubChanges>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"crest" | "kit" | null>(null);
  const [teams, setTeams] = useState<TeamDraft[]>([]);
  // coaches can look; only club admins can change Settings
  const [canAdmin, setCanAdmin] = useState(true);
  // which setting is open (its own screen), or "" for the list
  const { screen, open, close: closeScreen } = useScreens("/admin/settings");

  // keepEdits: after uploading a picture, so changes not yet saved stay as they are
  const take = useCallback((data: Snapshot, keepEdits = false) => {
    setSnap(data);
    if (keepEdits) return;
    setDraft(data.changes);
    setTeams(data.teams.map(toDraft));
  }, []);

  const load = useCallback(
    async (adminKey: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/settings?key=${encodeURIComponent(adminKey)}`);
        if (res.status === 401) {
          setError("Incorrect password");
          setAuthed(false);
          return;
        }
        if (!res.ok) throw new Error();
        const data = await res.json();
        take(data);
        setCanAdmin(data.canAdmin !== false);
        setAuthed(true);
      } catch {
        setError("Could not load the settings. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [take],
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const urlKey = new URLSearchParams(window.location.search).get("key");
    if (urlKey) {
      setKey(urlKey);
      Promise.resolve(load(urlKey)).finally(() => setChecking(false));
    } else {
      // signed in with an account, or the coach password given earlier: no password box
      accountKey()
        .then(async (k) => {
          if (k) {
            setKey(k);
            await load(k);
          }
        })
        .finally(() => setChecking(false));
    }
  }, [load]);
  // a coach password that worked here opens every other tool too
  useEffect(() => {
    if (authed) rememberCoachKey(key);
  }, [authed, key]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function send(method: string, body?: unknown, done?: string, opts: { slot?: string; keepEdits?: boolean } = {}) {
    setError(null);
    setNotice(null);
    const slot = opts.slot ? `&slot=${opts.slot}` : "";
    const res = await fetch(`/api/settings?key=${encodeURIComponent(key)}${slot}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "That didn't save");
    take(data, opts.keepEdits);
    if (done) setNotice(done);
    // every page picks the new settings up
    router.refresh();
  }

  async function save() {
    const unnamed = teams.find((t) => !t.name.trim());
    if (unnamed) {
      setError("Give every team a name before saving.");
      return;
    }
    setSaving(true);
    try {
      await send(
        "PUT",
        { changes: draft, teams: fromDrafts(teams) },
        "Saved — every page now shows the new details.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't save");
    } finally {
      setSaving(false);
    }
  }

  // the pictures save straight away, without touching changes not yet saved
  const PICTURES = {
    crest: { name: "crest", shrink: { max: 512, type: "image/png" } },
    kit: { name: "kit picture", shrink: { max: 1600, type: "image/jpeg" } },
  } as const;

  // a crest or kit picture with a plain background: both versions, for the coach to pick from
  const [bgPick, setBgPick] = useState<{ slot: keyof typeof PICTURES; original: Picture; cleaned: Picture } | null>(null);

  async function uploadPicture(slot: keyof typeof PICTURES, file: File | undefined, ready?: Picture) {
    if (!file && !ready) return;
    const { name, shrink } = PICTURES[slot];
    setUploading(slot);
    try {
      let picture = ready;
      if (!picture && slot === "crest") {
        const canvas = await shrinkToCanvas(file!, shrink);
        const cleaned = removeBackground(canvas);
        if (cleaned) {
          setBgPick({ slot, original: pictureOf(canvas), cleaned: pictureOf(cleaned) });
          return;
        }
        picture = pictureOf(canvas);
      }
      if (!picture && slot === "kit") {
        // worked on as a PNG, so a see-through version keeps its see-through parts
        const canvas = await shrinkToCanvas(file!, { max: shrink.max, type: "image/png" });
        const cleaned = removeBackground(canvas, { shaded: true });
        if (cleaned) {
          setBgPick({ slot, original: await shrinkImage(file!, shrink), cleaned: pngWithin(cleaned, KIT_PNG_BYTES) });
          return;
        }
      }
      setBgPick(null);
      const body = { ...(picture ?? (await shrinkImage(file!, shrink))), slot };
      await send("POST", body, `New ${name} saved.`, { keepEdits: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : `Could not upload that ${name}`);
    } finally {
      setUploading(null);
    }
  }

  async function resetPicture(slot: keyof typeof PICTURES) {
    const { name } = PICTURES[slot];
    if (!confirm(`Go back to the default ${name}?`)) return;
    setUploading(slot);
    try {
      await send("DELETE", undefined, `Back to the default ${name}.`, { slot, keepEdits: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : `Could not reset the ${name}`);
    } finally {
      setUploading(null);
    }
  }

  if (!authed || !snap) {
    if (checking) return <ToolSkeleton />;
    return (
      <main className="themed flex min-h-screen items-center justify-center bg-gradient-to-b from-green-700 to-green-900 px-4">
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl dark:bg-[#1c1c1e]">
          <div className="mb-6 text-center">
            <div className="mb-2 text-3xl">⚙️</div>
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-gray-50">Settings</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Coaches only</p>
          </div>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(key)}
            placeholder="Enter password"
            className="mb-3 w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15"
          />
          {error && <p className="mb-3 text-center text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            onClick={() => load(key)}
            disabled={loading || !key}
            className="w-full cursor-pointer rounded-xl bg-green-600 py-3 font-bold text-white hover:bg-green-700 disabled:opacity-40"
          >
            {loading ? "Loading…" : "Open Settings"}
          </button>
          <Link href="/" className="mt-4 block text-center text-sm font-medium text-gray-500 hover:text-green-700 dark:text-gray-400">
            ← Back to Team Hub
          </Link>
        </div>
      </main>
    );
  }

  const { defaults, club } = snap;
  const value = (f: EditableText) => draft[f] ?? "";
  const shown = (f: EditableText) => (draft[f]?.trim() ? draft[f]!.trim() : defaults[f]);
  const publicResults = draft.publicResults ?? defaults.publicResults;
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(snap.changes) ||
    JSON.stringify(fromDrafts(teams)) !== JSON.stringify(fromDrafts(snap.teams.map(toDraft)));

  // the settings that open on their own screen, by their # (useScreens)
  const SCREENS: Record<string, string> = {
    share: "Share Your Hub",
    details: "Club Details",
    colour: "Club Colour",
    crest: "Club Crest",
    kit: "Kit",
    teams: "Teams",
    parts: "Parts of the Hub",
    ...(canAdmin && snap.club.features.financialAdmin ? { finance: "Financial Admin Passwords" } : {}),
    ...(canAdmin && snap.account ? { signin: "Sign-In" } : {}),
  };
  // screens whose changes wait for Save Changes (pictures and passwords save as they go)
  const EDITS = ["details", "colour", "teams", "parts", "kit"];
  const kitExtras = draft.kitExtras ?? defaults.kitExtras ?? [];
  const liveTeams = teams.filter((t) => !t.archived).length;

  return (
    // the page previews the colour being picked, before it's saved
    <main
      className="themed min-h-screen bg-gray-100 dark:bg-black dark:text-gray-50 pb-16"
      style={(draft.colour ? clubColourVars(draft.colour) : DEFAULT_COLOUR_VARS) as React.CSSProperties}
    >
      {screen && SCREENS[screen] ? (
        <>
          <TopBar title={SCREENS[screen]} onBack={closeScreen} />
          <div className="mx-auto max-w-xl px-4">
            {!canAdmin && (
              <div className="mt-4">
                <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
                  👀 You can look, but only a <strong>club admin</strong> can change Settings.
                </p>
              </div>
            )}
            {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-300">{error}</p>}
            {notice && <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-400/10 dark:text-green-300">{notice}</p>}
            {["details", "colour", "crest"].includes(screen) && (
              <>
                {/* Preview: the home page's banner with the details as they'll show */}
                <div className="relative mt-4 overflow-hidden rounded-3xl bg-[var(--club-night)] px-6 py-8 text-center text-white shadow-lg">
                  <div
                    className="absolute inset-0 bg-cover bg-top opacity-70"
                    style={{ backgroundImage: "url(/poster/brush-background.jpg)", filter: "var(--club-brush-filter)" }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-green-950/30 via-transparent to-green-950/80" />
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={club.crest.src} alt={club.crest.alt} className="mx-auto mb-3 h-24 w-auto" />
                    <p className="text-3xl font-black uppercase tracking-wide">{shown("name")}</p>
                    <p className="mt-1 text-sm font-bold uppercase tracking-widest text-[var(--club-bright)]">Team Hub</p>
                    <p className="mt-3 inline-block rounded-full border border-white/25 bg-black/30 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-green-100">
                      {shown("kitSeason")} season
                    </p>
                    <p className="mt-4 text-sm font-bold uppercase text-[var(--club-bright)]">{shown("slogan")}</p>
                    <p className="mt-1 text-xs text-gray-400">{shown("fullName")}</p>
                  </div>
                </div>
                <p className="mt-2 text-center text-xs text-gray-400">Preview of the top of the home page</p>
              </>
            )}
            {screen === "share" && <ShareHub clubName={shown("name")} />}
            {screen === "colour" && (
              <>
                {/* Colour */}
                <section className="mt-4 rounded-3xl bg-white p-5 shadow-sm dark:bg-[#1c1c1e]">
                  <h2 className="font-extrabold text-gray-900 dark:text-gray-50">🎨 Club Colour</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    The hub&apos;s buttons, banners and highlights take this colour. This page shows it as
                    you pick.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        setDraft((d) => {
                          const next = { ...d };
                          delete next.colour;
                          return next;
                        })
                      }
                      className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${
                        !draft.colour ? "border-gray-900 ring-2 ring-gray-900" : "border-gray-200 dark:border-white/15"
                      }`}
                    >
                      <span className="h-5 w-5 rounded-full" style={{ background: "#16a34a" }} />
                      Hub green
                    </button>
                    {PRESET_COLOURS.filter((p) => p.name !== "Green").map((p) => (
                      <button
                        key={p.hex}
                        onClick={() => setDraft((d) => ({ ...d, colour: p.hex }))}
                        className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${
                          draft.colour === p.hex ? "border-gray-900 ring-2 ring-gray-900" : "border-gray-200 dark:border-white/15"
                        }`}
                      >
                        <span className="h-5 w-5 rounded-full" style={{ background: p.hex }} />
                        {p.name}
                      </button>
                    ))}
                    <label className="flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-sm font-semibold dark:border-white/15">
                      <input
                        type="color"
                        value={draft.colour ?? "#16a34a"}
                        onChange={(e) => setDraft((d) => ({ ...d, colour: e.target.value }))}
                        className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
                      />
                      Your own
                    </label>
                  </div>
                </section>
              </>
            )}
            {screen === "crest" && (
              <>
                {/* Crest */}
                <section className="mt-4 rounded-3xl bg-white p-5 shadow-sm dark:bg-[#1c1c1e]">
                  <h2 className="font-extrabold text-gray-900 dark:text-gray-50">🛡️ Club Crest</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    A PNG with a see-through background looks best; if yours has a plain background, the
                    hub offers to take it off. It&apos;s also used for the home-screen icon when someone
                    saves the hub to their phone.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={club.crest.src}
                      alt=""
                      className="h-20 w-20 rounded-2xl border border-gray-100 bg-gray-50 object-contain p-1.5 dark:bg-white/5 dark:border-white/10"
                    />
                    <label className="cursor-pointer rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700">
                      {uploading === "crest" ? "Uploading…" : snap.crest ? "Change Crest" : "Upload Crest"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        disabled={!!uploading}
                        onChange={(e) => {
                          uploadPicture("crest", e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {snap.crest && bgPick?.slot !== "crest" && (
                      <button
                        onClick={() => resetPicture("crest")}
                        disabled={!!uploading}
                        className="cursor-pointer text-sm font-semibold text-gray-500 hover:text-red-600 disabled:opacity-40 dark:text-gray-400"
                      >
                        Use Default Crest
                      </button>
                    )}
                  </div>
                  {/* the crest had a plain background: with it taken off, or as it was */}
                  {bgPick?.slot === "crest" && (
                    <BackgroundChoice
                      what="crest"
                      pick={bgPick}
                      busy={!!uploading}
                      onPick={(pic) => uploadPicture("crest", undefined, pic)}
                      onCancel={() => setBgPick(null)}
                    />
                  )}
                </section>
              </>
            )}
            {screen === "kit" && (
              <>
                {/* Kit picture */}
                <section className="mt-4 rounded-3xl bg-white p-5 shadow-sm dark:bg-[#1c1c1e]">
                  <h2 className="font-extrabold text-gray-900 dark:text-gray-50">👕 Kit Picture</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Shown on the Kit page, so parents can see the kit they&apos;re choosing sizes for. A wide
                    design works best; if it&apos;s on a plain or shaded background, the hub offers to take that off.
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={club.kitImage.src}
                    alt=""
                    className="mt-4 w-full max-w-sm rounded-2xl border border-gray-100 bg-[var(--club-night)] object-contain dark:border-white/10"
                    style={{ aspectRatio: kitAspect(club.kitImage) }}
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <label className="cursor-pointer rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700">
                      {uploading === "kit" ? "Uploading…" : snap.kitImage ? "Change Kit Picture" : "Upload Kit Picture"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        disabled={!!uploading}
                        onChange={(e) => {
                          uploadPicture("kit", e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {snap.kitImage && bgPick?.slot !== "kit" && (
                      <button
                        onClick={() => resetPicture("kit")}
                        disabled={!!uploading}
                        className="cursor-pointer text-sm font-semibold text-gray-500 hover:text-red-600 disabled:opacity-40 dark:text-gray-400"
                      >
                        Use Default Picture
                      </button>
                    )}
                  </div>
                  {/* the kit picture had a plain or shaded background: with it taken off, or as it was */}
                  {bgPick?.slot === "kit" && (
                    <BackgroundChoice
                      what="kit picture"
                      pick={bgPick}
                      wide
                      busy={!!uploading}
                      onPick={(pic) => uploadPicture("kit", undefined, pic)}
                      onCancel={() => setBgPick(null)}
                    />
                  )}
                </section>
                {/* the kit form's items beyond shirt, shorts and socks */}
                <section className="mt-4 rounded-3xl bg-white p-5 shadow-sm dark:bg-[#1c1c1e]">
                  <h2 className="font-extrabold text-gray-900 dark:text-gray-50">🧥 Kit Items</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Every kit form asks for a shirt, shorts and socks. Switch on anything else parents should
                    send a size for; they can also choose &ldquo;Not needed&rdquo;.
                  </p>
                  <div className="mt-2 flex flex-col divide-y divide-gray-100 dark:divide-white/10">
                    {(Object.keys(KIT_EXTRAS) as KitExtra[]).map((e) => (
                      <Toggle
                        key={e}
                        label={`${KIT_EXTRAS[e].emoji} ${KIT_EXTRAS[e].label}`}
                        hint="Sizes 4XS to S, as for the shirt."
                        on={kitExtras.includes(e)}
                        onChange={(on) =>
                          setDraft((d) => {
                            const now = d.kitExtras ?? defaults.kitExtras ?? [];
                            const next = (Object.keys(KIT_EXTRAS) as KitExtra[]).filter((x) => (x === e ? on : now.includes(x)));
                            return { ...d, kitExtras: next };
                          })
                        }
                      />
                    ))}
                  </div>
                </section>
              </>
            )}
            {screen === "details" && (
              <>
                {/* Identity */}
                <section className="mt-4 rounded-3xl bg-white p-5 shadow-sm dark:bg-[#1c1c1e]">
                  <h2 className="font-extrabold text-gray-900 dark:text-gray-50">🏷️ Club Details</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Leave a box empty to use the default shown in it.</p>
                  <div className="mt-4 flex flex-col gap-4">
                    {FIELDS.map(({ field, label, hint }) => (
                      <label key={field} className="block">
                        <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{label}</span>
                        <input
                          value={value(field)}
                          maxLength={EDITABLE[field]}
                          placeholder={defaults[field]}
                          onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}
                          className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15"
                        />
                        <span className="mt-1 block text-xs text-gray-400">{hint}</span>
                      </label>
                    ))}
                  </div>
                </section>
              </>
            )}
            {screen === "parts" && (
              <>
                {/* Which parts of the hub the club uses */}
                <section className="mt-4 rounded-3xl bg-white p-5 shadow-sm dark:bg-[#1c1c1e]">
                  <h2 className="font-extrabold text-gray-900 dark:text-gray-50">🧩 Parts of the Hub</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Switch off anything the club doesn&apos;t use: it leaves the home page and Coach Admin,
                    and nothing saved in it is lost.
                  </p>
                  <div className="mt-4 flex flex-col divide-y divide-gray-100 dark:divide-white/10">
                    <Toggle
                      label="Results for Parents"
                      hint="Scores, league tables and top scorers. Turn off for non-competitive football; coaches still log every game."
                      on={publicResults}
                      onChange={(on) => setDraft((d) => ({ ...d, publicResults: on }))}
                    />
                    {(Object.keys(FEATURES) as Feature[]).map((f) => (
                      <Toggle
                        key={f}
                        label={FEATURES[f].label}
                        hint={FEATURES[f].hint}
                        on={draft.features?.[f] ?? defaults.features[f]}
                        onChange={(on) => setDraft((d) => ({ ...d, features: { ...d.features, [f]: on } }))}
                      />
                    ))}
                  </div>
                </section>
              </>
            )}
            {screen === "teams" && (
              <>
                <TeamsEditor teams={teams} setTeams={setTeams} initials={shown("initials")} />
              </>
            )}
            {screen === "finance" && (
              <>
                {canAdmin && snap.club.features.financialAdmin && (
                  <FinancePasswords adminKey={key} teams={snap.teams.filter((t) => !t.archived)} />
                )}
              </>
            )}
            {screen === "signin" && (
              <>
                {canAdmin && snap.account && (
                  <AccountSection
                    email={snap.account.email}
                    adminKey={key}
                    onPasswordChanged={(next) => {
                      // stay signed in with the new password
                      setKey(next);
                      const url = new URL(window.location.href);
                      url.searchParams.set("key", next);
                      window.history.replaceState(null, "", url);
                    }}
                  />
                )}
              </>
            )}
            {EDITS.includes(screen) && (
              <>
                {canAdmin && <div className="sticky bottom-4 mt-6">
                  <button
                    onClick={save}
                    disabled={saving || !dirty}
                    className="w-full cursor-pointer rounded-2xl bg-green-600 py-3.5 font-bold text-white shadow-lg hover:bg-green-700 disabled:cursor-default disabled:opacity-50"
                  >
                    {saving ? "Saving…" : dirty ? "Save Changes" : "All Changes Saved"}
                  </button>
                </div>}
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <TopBar title="Club Settings" href={`/admin${keyQuery(key)}`} />
          <div className="mx-auto max-w-xl px-4">
            <div className="flex flex-col items-center pb-4 pt-2 text-center">
              <span className="grid h-32 w-32 place-items-center rounded-3xl bg-[var(--club-night)] p-3 shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={club.crest.src} alt={club.crest.alt} className="max-h-full max-w-full object-contain" />
              </span>
              <h1 className="mt-4 text-3xl font-semibold text-gray-900 dark:text-gray-50">{shown("name")}</h1>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{shown("fullName")}</p>
            </div>
            {!canAdmin && (
              <div className="mt-4">
                <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
                  👀 You can look, but only a <strong>club admin</strong> can change Settings.
                </p>
              </div>
            )}
            {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-300">{error}</p>}
            {notice && <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-400/10 dark:text-green-300">{notice}</p>}

            <Group>
              <Row icon={ICONS.share} label="Share Your Hub" onClick={() => open("share")} />
            </Group>

            <Group>
              <Row icon={ICONS.tag} label="Club Details" detail={shown("name")} onClick={() => open("details")} />
              <Row icon={ICONS.palette} label="Club Colour" onClick={() => open("colour")} />
              <Row icon={ICONS.crest} label="Club Crest" onClick={() => open("crest")} />
              <Row icon={ICONS.shirt} label="Kit" onClick={() => open("kit")} />
            </Group>

            <Group>
              <Row icon={ICONS.team} label="Teams" detail={String(liveTeams)} onClick={() => open("teams")} />
              <Row icon={ICONS.grid} label="Parts of the Hub" onClick={() => open("parts")} />
            </Group>

            {(SCREENS.finance || SCREENS.signin) && (
              <Group>
                {SCREENS.finance && <Row icon={ICONS.money} label="Financial Admin Passwords" onClick={() => open("finance")} />}
                {SCREENS.signin && <Row icon={ICONS.lock} label="Sign-In" onClick={() => open("signin")} />}
              </Group>
            )}

            {/* changes made on a screen and not saved yet */}
            {dirty && (
              <>
                {canAdmin && <div className="sticky bottom-4 mt-6">
                  <button
                    onClick={save}
                    disabled={saving || !dirty}
                    className="w-full cursor-pointer rounded-2xl bg-green-600 py-3.5 font-bold text-white shadow-lg hover:bg-green-700 disabled:cursor-default disabled:opacity-50"
                  >
                    {saving ? "Saving…" : dirty ? "Save Changes" : "All Changes Saved"}
                  </button>
                </div>}
              </>
            )}
          </div>
        </>
      )}
    </main>
  );
}

// The teams: each one's name, emoji, poster name, FA Full-Time code and league
// opponents. A team can be archived (hidden everywhere, its data kept) and
// brought back, but never deleted.
/** A team's training: each day it trains, with start and end times. */
/** Offer a picture with its background taken off, or as it was uploaded; the coach taps one to save it. */
function BackgroundChoice({
  what,
  pick,
  wide = false,
  busy,
  onPick,
  onCancel,
}: {
  what: string;
  pick: { original: Picture; cleaned: Picture };
  /** a wide picture (the kit): the two one above the other */
  wide?: boolean;
  busy: boolean;
  onPick: (picture: Picture) => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-5 border-t border-gray-100 pt-4 dark:border-white/10">
      <p className="text-sm font-bold text-gray-900 dark:text-gray-50">Take the background off?</p>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        Your {what} has a plain background. Here it is with that taken off, and as you uploaded it.
      </p>
      <div className={`mt-3 grid gap-3 ${wide ? "grid-cols-1" : "grid-cols-2"}`}>
        {(
          [
            ["cleaned", "Background Off", pick.cleaned],
            ["original", "As Uploaded", pick.original],
          ] as const
        ).map(([key, label, pic]) => (
          <button
            key={key}
            onClick={() => onPick(pic)}
            disabled={busy}
            className={`cursor-pointer rounded-2xl border-2 p-2 text-sm font-bold disabled:opacity-50 ${
              key === "cleaned"
                ? "border-green-600 text-green-700 dark:text-green-400"
                : "border-gray-200 text-gray-700 dark:border-white/15 dark:text-gray-200"
            }`}
          >
            {/* on the dark colour it's shown on, so any leftover background shows */}
            <span
              className={`grid place-items-center rounded-xl p-3 ${
                wide ? "bg-[var(--club-night)]" : "aspect-square bg-[radial-gradient(circle_at_50%_46%,#1f5c2c_0%,#0b2412_55%,#060906_100%)]"
              }`}
              style={wide ? { aspectRatio: kitAspect(pick.original) } : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pic.image} alt="" className="max-h-full max-w-full object-contain" />
            </span>
            <span className="mt-2 block">Use {label}</span>
          </button>
        ))}
      </div>
      <button
        onClick={onCancel}
        className="mt-3 w-full cursor-pointer text-sm font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400"
      >
        Cancel
      </button>
    </div>
  );
}

function TrainingDays({
  training,
  onChange,
  input,
}: {
  training: TrainingSlot[];
  onChange: (training: TrainingSlot[]) => void;
  input: string;
}) {
  const set = (n: number, patch: Partial<TrainingSlot>) =>
    onChange(training.map((s, k) => (k === n ? { ...s, ...patch } : s)));
  // the next day not taken, Monday first
  const free = [1, 2, 3, 4, 5, 6, 0].find((d) => !training.some((s) => s.day === d));
  const small = input.replace("mt-1 w-full", "w-full").replace("px-3", "px-2");
  // iOS Safari gives time boxes a width of their own, wider than half the row: drop its styling so they fit
  const timeBox = "block min-w-0 max-w-full appearance-none min-h-11 text-left [&::-webkit-date-and-time-value]:text-left";
  return (
    <div>
      <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Training</span>
      <div className="mt-1 flex flex-col gap-2">
        {training.map((s, n) => (
          <div key={n} className="rounded-xl bg-gray-50 p-2.5 dark:bg-white/5">
            <div className="flex items-center gap-2">
              <select
                value={s.day}
                aria-label="Day"
                onChange={(e) => set(n, { day: Number(e.target.value) })}
                className={`${small} min-w-0 flex-1 bg-white font-semibold dark:bg-[#1c1c1e]`}
              >
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <option key={d} value={d} disabled={d !== s.day && training.some((o) => o.day === d)}>
                    {WEEKDAYS[d]}
                  </option>
                ))}
              </select>
              <button
                onClick={() => onChange(training.filter((_, k) => k !== n))}
                aria-label={`Remove ${WEEKDAYS[s.day]}`}
                className="h-9 w-9 shrink-0 cursor-pointer rounded-lg text-lg text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-white/10"
              >
                ×
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="min-w-0">
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Starts</span>
                <input
                  type="time"
                  value={s.start ?? ""}
                  onChange={(e) => set(n, { start: e.target.value || undefined, ...(e.target.value ? {} : { end: undefined }) })}
                  className={`${small} ${timeBox} bg-white dark:bg-[#1c1c1e]`}
                />
              </label>
              <label className="min-w-0">
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Ends</span>
                <input
                  type="time"
                  value={s.end ?? ""}
                  disabled={!s.start}
                  onChange={(e) => set(n, { end: e.target.value || undefined })}
                  className={`${small} ${timeBox} bg-white disabled:opacity-40 dark:bg-[#1c1c1e]`}
                />
              </label>
            </div>
          </div>
        ))}
        {training.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No regular training.</p>}
      </div>
      {training.length < MAX_TRAINING_DAYS && free !== undefined && (
        <button
          onClick={() => onChange([...training, { day: free }])}
          className="mt-2 cursor-pointer text-sm font-semibold text-green-700 hover:underline dark:text-green-400"
        >
          + Add a training day
        </button>
      )}
      <span className="mt-1 block text-xs text-gray-400">
        The Training Log, training plans and everyone&apos;s Up next follow these. A change applies from today;
        sessions already past stay as they were.
      </span>
    </div>
  );
}

function TeamsEditor({
  teams,
  setTeams,
  initials,
}: {
  teams: TeamDraft[];
  setTeams: (update: (teams: TeamDraft[]) => TeamDraft[]) => void;
  initials: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const active = teams.map((t, i) => ({ t, i })).filter(({ t }) => !t.archived);
  const archived = teams.map((t, i) => ({ t, i })).filter(({ t }) => t.archived);

  const change = (i: number, patch: Partial<TeamDraft>) =>
    setTeams((all) => all.map((t, n) => (n === i ? { ...t, ...patch } : t)));
  const move = (i: number, by: number) =>
    setTeams((all) => {
      const order = all.map((t, n) => ({ t, n })).filter(({ t }) => !t.archived).map(({ n }) => n);
      const at = order.indexOf(i);
      const other = order[at + by];
      if (other === undefined) return all;
      const next = [...all];
      [next[i], next[other]] = [next[other], next[i]];
      return next;
    });
  const add = () => {
    setTeams((all) => [...all, { slug: "", name: "", accent: "⚽", opponentsText: "" }]);
    setOpen(teams.length);
  };

  const input =
    "mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15";

  return (
    <section className="mt-4 rounded-3xl bg-white p-5 shadow-sm dark:bg-[#1c1c1e]">
      <h2 className="font-extrabold text-gray-900 dark:text-gray-50">👥 Teams</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Each team gets its own kit form, stats, match and training logs, training plan and subs.
        Archiving a team hides it everywhere but keeps all its data.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {active.map(({ t, i }, pos) => (
          <div key={t.slug || `new-${i}`} className="rounded-2xl border border-gray-200 dark:border-white/15">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className="text-2xl">{t.accent || "⚽"}</span>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="min-w-0 flex-1 cursor-pointer truncate text-left font-bold text-gray-900 dark:text-gray-50"
              >
                {t.name.trim() || "New team"}
                {!t.slug && (
                  <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800 dark:text-green-300 dark:bg-green-400/15">
                    New
                  </span>
                )}
              </button>
              <button
                onClick={() => move(i, -1)}
                disabled={pos === 0}
                aria-label={`Move ${t.name} up`}
                className="h-8 w-8 cursor-pointer rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-white/10"
              >
                ↑
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={pos === active.length - 1}
                aria-label={`Move ${t.name} down`}
                className="h-8 w-8 cursor-pointer rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-white/10"
              >
                ↓
              </button>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="cursor-pointer rounded-lg px-2 py-1 text-sm font-semibold text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-400/15"
              >
                {open === i ? "Done" : "Edit"}
              </button>
            </div>

            {open === i && (
              <div className="flex flex-col gap-3 border-t border-gray-100 px-3 pb-4 pt-3 dark:border-white/10">
                <div className="flex gap-3">
                  <label className="w-20 shrink-0">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Emoji</span>
                    <input
                      value={t.accent}
                      maxLength={8}
                      onChange={(e) => change(i, { accent: e.target.value })}
                      className={`${input} text-center text-xl`}
                    />
                  </label>
                  <label className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Team name</span>
                    <input
                      value={t.name}
                      maxLength={30}
                      placeholder="e.g. Under 9s Reds"
                      onChange={(e) => change(i, { name: e.target.value })}
                      className={input}
                    />
                  </label>
                </div>
                <label>
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Name on posters</span>
                  <input
                    value={t.squadName ?? ""}
                    maxLength={30}
                    placeholder={t.name || "e.g. U9s Reds"}
                    onChange={(e) => change(i, { squadName: e.target.value })}
                    className={input}
                  />
                  <span className="mt-1 block text-xs text-gray-400">
                    Shown after the initials: “{initials} {t.squadName?.trim() || t.name.trim() || "U9s Reds"}”.
                  </span>
                </label>
                <TrainingDays training={t.training ?? DEFAULT_TRAINING} onChange={(training) => change(i, { training })} input={input} />
                <label>
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-200">FA Full-Time code (optional)</span>
                  <input
                    value={t.faSnippet ?? ""}
                    inputMode="numeric"
                    maxLength={15}
                    placeholder="e.g. 460765991"
                    onChange={(e) => change(i, { faSnippet: e.target.value.replace(/\D/g, "") })}
                    className={input}
                  />
                  <span className="mt-1 block text-xs text-gray-400">
                    From Full-Time admin → Media → Code Snippets → team fixtures: the number in
                    <code className="mx-1">lrcode</code>. Fixtures then arrive in the Match Log by themselves.
                  </span>
                </label>
                <label>
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-200">League opponents (optional)</span>
                  <textarea
                    value={t.opponentsText}
                    rows={4}
                    placeholder={"One team per line, exactly as Full-Time names them"}
                    onChange={(e) => change(i, { opponentsText: e.target.value })}
                    className={input}
                  />
                  <span className="mt-1 block text-xs text-gray-400">
                    So fixtures can be picked from a list. Leave empty for a free-text box.
                  </span>
                </label>
                <div className="flex justify-end">
                  {t.slug ? (
                    <button
                      onClick={() => {
                        if (active.length === 1) return alert("Keep at least one team.");
                        if (confirm(`Archive ${t.name}? It disappears from every page, but its data is kept and you can bring it back.`)) {
                          change(i, { archived: true });
                          setOpen(null);
                        }
                      }}
                      className="cursor-pointer text-sm font-semibold text-gray-500 hover:text-red-600 dark:text-gray-400"
                    >
                      Archive Team
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setTeams((all) => all.filter((_, n) => n !== i));
                        setOpen(null);
                      }}
                      className="cursor-pointer text-sm font-semibold text-gray-500 hover:text-red-600 dark:text-gray-400"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={add}
        className="mt-3 w-full cursor-pointer rounded-2xl border-2 border-dashed border-gray-300 py-3 text-sm font-bold text-gray-600 hover:border-green-400 hover:text-green-700 dark:text-gray-300 dark:border-white/20"
      >
        + Add Team
      </button>

      {archived.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Archived</p>
          <div className="mt-2 flex flex-col gap-2">
            {archived.map(({ t, i }) => (
              <div key={t.slug} className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-white/5">
                <span className="text-xl opacity-60">{t.accent}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-500 dark:text-gray-400">{t.name}</span>
                <button
                  onClick={() => change(i, { archived: false })}
                  className="cursor-pointer text-sm font-semibold text-green-700 hover:text-green-800 dark:text-green-400"
                >
                  Bring Back
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// One on/off row in Parts of the Hub.
function Toggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-3">
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-gray-900 dark:text-gray-50">{label}</span>
        <span className="mt-0.5 block text-sm text-gray-500 dark:text-gray-400">{hint}</span>
      </span>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className="relative mt-1 h-7 w-12 shrink-0 rounded-full bg-gray-300 transition-colors after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-green-600 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-green-400 dark:bg-white/20"
      />
    </label>
  );
}

// The club's contact email (where password resets go) and its coach password.
// Saved on their own, so they don't touch unsaved changes above.
function AccountSection({
  email,
  adminKey,
  onPasswordChanged,
}: {
  email: string;
  adminKey: string;
  onPasswordChanged: (password: string) => void;
}) {
  const [newEmail, setNewEmail] = useState(email);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState<"email" | "password" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(kind: "email" | "password") {
    setMessage(null);
    if (kind === "password" && password !== password2) {
      return setMessage({ ok: false, text: "The two passwords don't match." });
    }
    setBusy(kind);
    try {
      const res = await fetch(`/api/settings?key=${encodeURIComponent(adminKey)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: kind === "email" ? { email: newEmail } : { password } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "That didn't save");
      if (kind === "password") {
        onPasswordChanged(password);
        setPassword("");
        setPassword2("");
        setMessage({ ok: true, text: "Password changed. Share the new one with your coaches." });
      } else {
        setMessage({ ok: true, text: "Email saved." });
      }
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "That didn't save" });
    } finally {
      setBusy(null);
    }
  }

  const input =
    "mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15";
  const button =
    "mt-2 cursor-pointer rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-black disabled:opacity-40 dark:hover:bg-gray-200 dark:bg-white dark:text-gray-900";
  return (
    <section className="mt-4 rounded-3xl bg-white p-5 shadow-sm dark:bg-[#1c1c1e]">
      <h2 className="font-extrabold text-gray-900 dark:text-gray-50">🔑 Sign-In</h2>
      <label className="mt-4 block">
        <span className="text-sm font-bold text-gray-800 dark:text-gray-100">Club email</span>
        <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={input} />
        <span className="mt-1 block text-xs text-gray-400">Password reset links are sent here.</span>
      </label>
      <button onClick={() => save("email")} disabled={busy !== null || newEmail.trim() === email} className={button}>
        {busy === "email" ? "Saving…" : "Save Email"}
      </button>
      <div className="mt-5 border-t border-gray-100 pt-4 dark:border-white/10">
        <span className="text-sm font-bold text-gray-800 dark:text-gray-100">Change the coach password</span>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password (8+ characters)" autoComplete="new-password" className={input} />
        <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="New password again" autoComplete="new-password" className={`${input} mt-2`} />
        <button onClick={() => save("password")} disabled={busy !== null || password.length < 8} className={button}>
          {busy === "password" ? "Changing…" : "Change Password"}
        </button>
      </div>
      {message && (
        <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${message.ok ? "bg-green-50 text-green-800 dark:bg-green-400/10 dark:text-green-300" : "bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}

/** The hub's own link, to send to parents and coaches: clubs aren't listed anywhere, so this is how people find it. */
function ShareHub({ clubName }: { clubName: string }) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");
  const [canShare, setCanShare] = useState(false);
  // the address the coach is using now, and whether the phone can share it
  // (after the first render, as the server knows neither)
  useEffect(() => {
    const t = setTimeout(() => {
      setUrl(window.location.origin);
      setCanShare("share" in navigator);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <section className="mt-4 rounded-3xl bg-white p-5 shadow-sm dark:bg-[#1c1c1e]">
      <h2 className="font-extrabold text-gray-900 dark:text-gray-50">📣 Share Your Hub</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Your hub isn&apos;t listed anywhere, so send this link to your parents and coaches — by
        WhatsApp, email or your club&apos;s app. They can save it to their phone&apos;s home screen.
        Your club code, and who&apos;s allowed in, are in{" "}
        <Link href="/admin/members" className="font-semibold text-green-700 underline dark:text-green-400">Coach Admin → Members</Link>.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-800 dark:bg-white/5 dark:text-gray-100">{url || "…"}</code>
        <button
          onClick={copy}
          disabled={!url}
          className="cursor-pointer rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:hover:bg-white/5 dark:text-gray-200 dark:border-white/15"
        >
          {copied ? "Copied ✓" : "Copy Link"}
        </button>
        {canShare && (
          <button
            onClick={() => navigator.share({ title: `${clubName} Team Hub`, url }).catch(() => {})}
            disabled={!url}
            className="cursor-pointer rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-40"
          >
            Share
          </button>
        )}
      </div>
    </section>
  );
}
