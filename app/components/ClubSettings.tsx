"use client";

// Coach Admin → Settings: the club's name, initials, slogan, season, crest,
// whether results are public, and its teams. Saved to the database and shown on
// every page straight away; an empty box goes back to the default in
// club.config.ts.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Club, ClubChanges, EditableText, Team } from "@/lib/clubSettings";
import { EDITABLE, FEATURES, slugFor, type Feature } from "@/lib/clubSettings";
import { DEFAULT_COLOUR_VARS, PRESET_COLOURS, clubColourVars } from "@/lib/palette";

type Snapshot = {
  club: Club;
  defaults: Club;
  changes: ClubChanges;
  crest: { width: number; height: number; updatedAt: string } | null;
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
async function shrinkImage(file: File, max = 512): Promise<{ image: string; width: number; height: number }> {
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
    canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
    return { image: canvas.toDataURL("image/png"), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ClubSettings() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [draft, setDraft] = useState<ClubChanges>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [teams, setTeams] = useState<TeamDraft[]>([]);

  const take = useCallback((data: Snapshot) => {
    setSnap(data);
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
        take(await res.json());
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
      load(urlKey);
    }
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function send(method: string, body?: unknown, done?: string) {
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/settings?key=${encodeURIComponent(key)}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "That didn't save");
    take(data);
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

  async function uploadCrest(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      await send("POST", await shrinkImage(file), "New crest saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload that crest");
    } finally {
      setUploading(false);
    }
  }

  async function resetCrest() {
    if (!confirm("Go back to the default crest?")) return;
    setUploading(true);
    try {
      await send("DELETE", undefined, "Back to the default crest.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reset the crest");
    } finally {
      setUploading(false);
    }
  }

  if (!authed || !snap) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-green-700 to-green-900 px-4">
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl">
          <div className="mb-6 text-center">
            <div className="mb-2 text-3xl">⚙️</div>
            <h1 className="text-xl font-extrabold text-gray-900">Settings</h1>
            <p className="mt-1 text-sm text-gray-500">Coaches only</p>
          </div>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(key)}
            placeholder="Enter password"
            className="mb-3 w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          {error && <p className="mb-3 text-center text-sm text-red-600">{error}</p>}
          <button
            onClick={() => load(key)}
            disabled={loading || !key}
            className="w-full cursor-pointer rounded-xl bg-green-600 py-3 font-bold text-white hover:bg-green-700 disabled:opacity-40"
          >
            {loading ? "Loading…" : "Open Settings"}
          </button>
          <Link href="/" className="mt-4 block text-center text-sm font-medium text-gray-500 hover:text-green-700">
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

  return (
    // the page previews the colour being picked, before it's saved
    <main
      className="min-h-screen bg-gray-50 pb-16"
      style={(draft.colour ? clubColourVars(draft.colour) : DEFAULT_COLOUR_VARS) as React.CSSProperties}
    >
      <div className="bg-green-700 px-4 py-6 text-white">
        <div className="mx-auto max-w-2xl">
          <Link
            href={`/admin?key=${encodeURIComponent(key)}`}
            className="text-sm font-medium text-green-200 hover:text-white"
          >
            ← Coach Admin
          </Link>
          <h1 className="mt-2 text-xl font-extrabold">⚙️ Settings</h1>
          <p className="mt-0.5 text-sm text-green-200">
            Your club&apos;s name, crest and slogan, everywhere in the hub
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4">
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

        {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {notice && <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</p>}

        {/* Colour */}
        <section className="mt-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="font-extrabold text-gray-900">🎨 Club Colour</h2>
          <p className="mt-1 text-sm text-gray-500">
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
                !draft.colour ? "border-gray-900 ring-2 ring-gray-900" : "border-gray-200"
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
                  draft.colour === p.hex ? "border-gray-900 ring-2 ring-gray-900" : "border-gray-200"
                }`}
              >
                <span className="h-5 w-5 rounded-full" style={{ background: p.hex }} />
                {p.name}
              </button>
            ))}
            <label className="flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-sm font-semibold">
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

        {/* Crest */}
        <section className="mt-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="font-extrabold text-gray-900">🛡️ Club Crest</h2>
          <p className="mt-1 text-sm text-gray-500">
            A PNG with a see-through background looks best. It&apos;s also used for the home-screen
            icon when someone saves the hub to their phone.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={club.crest.src}
              alt=""
              className="h-20 w-20 rounded-2xl border border-gray-100 bg-gray-50 object-contain p-1.5"
            />
            <label className="cursor-pointer rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700">
              {uploading ? "Uploading…" : snap.crest ? "Change Crest" : "Upload Crest"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  uploadCrest(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            {snap.crest && (
              <button
                onClick={resetCrest}
                disabled={uploading}
                className="cursor-pointer text-sm font-semibold text-gray-500 hover:text-red-600 disabled:opacity-40"
              >
                Use Default Crest
              </button>
            )}
          </div>
        </section>

        {/* Identity */}
        <section className="mt-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="font-extrabold text-gray-900">🏷️ Club Details</h2>
          <p className="mt-1 text-sm text-gray-500">Leave a box empty to use the default shown in it.</p>
          <div className="mt-4 flex flex-col gap-4">
            {FIELDS.map(({ field, label, hint }) => (
              <label key={field} className="block">
                <span className="text-sm font-bold text-gray-800">{label}</span>
                <input
                  value={value(field)}
                  maxLength={EDITABLE[field]}
                  placeholder={defaults[field]}
                  onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400"
                />
                <span className="mt-1 block text-xs text-gray-400">{hint}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Which parts of the hub the club uses */}
        <section className="mt-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="font-extrabold text-gray-900">🧩 Parts of the Hub</h2>
          <p className="mt-1 text-sm text-gray-500">
            Switch off anything the club doesn&apos;t use: it leaves the home page and Coach Admin,
            and nothing saved in it is lost.
          </p>
          <div className="mt-4 flex flex-col divide-y divide-gray-100">
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

        <TeamsEditor teams={teams} setTeams={setTeams} initials={shown("initials")} />

        {snap.account && (
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

        <div className="sticky bottom-4 mt-6">
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="w-full cursor-pointer rounded-2xl bg-green-600 py-3.5 font-bold text-white shadow-lg hover:bg-green-700 disabled:cursor-default disabled:opacity-50"
          >
            {saving ? "Saving…" : dirty ? "Save Changes" : "All Changes Saved"}
          </button>
        </div>
      </div>
    </main>
  );
}

// The teams: each one's name, emoji, poster name, FA Full-Time code and league
// opponents. A team can be archived (hidden everywhere, its data kept) and
// brought back, but never deleted.
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
    "mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400";

  return (
    <section className="mt-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="font-extrabold text-gray-900">👥 Teams</h2>
      <p className="mt-1 text-sm text-gray-500">
        Each team gets its own kit form, stats, match and training logs, training plan and subs.
        Archiving a team hides it everywhere but keeps all its data.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {active.map(({ t, i }, pos) => (
          <div key={t.slug || `new-${i}`} className="rounded-2xl border border-gray-200">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className="text-2xl">{t.accent || "⚽"}</span>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="min-w-0 flex-1 cursor-pointer truncate text-left font-bold text-gray-900"
              >
                {t.name.trim() || "New team"}
                {!t.slug && (
                  <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">
                    New
                  </span>
                )}
              </button>
              <button
                onClick={() => move(i, -1)}
                disabled={pos === 0}
                aria-label={`Move ${t.name} up`}
                className="h-8 w-8 cursor-pointer rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={pos === active.length - 1}
                aria-label={`Move ${t.name} down`}
                className="h-8 w-8 cursor-pointer rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"
              >
                ↓
              </button>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="cursor-pointer rounded-lg px-2 py-1 text-sm font-semibold text-green-700 hover:bg-green-50"
              >
                {open === i ? "Done" : "Edit"}
              </button>
            </div>

            {open === i && (
              <div className="flex flex-col gap-3 border-t border-gray-100 px-3 pb-4 pt-3">
                <div className="flex gap-3">
                  <label className="w-20 shrink-0">
                    <span className="text-xs font-bold text-gray-700">Emoji</span>
                    <input
                      value={t.accent}
                      maxLength={8}
                      onChange={(e) => change(i, { accent: e.target.value })}
                      className={`${input} text-center text-xl`}
                    />
                  </label>
                  <label className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-gray-700">Team name</span>
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
                  <span className="text-xs font-bold text-gray-700">Name on posters</span>
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
                <label>
                  <span className="text-xs font-bold text-gray-700">FA Full-Time code (optional)</span>
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
                  <span className="text-xs font-bold text-gray-700">League opponents (optional)</span>
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
                      className="cursor-pointer text-sm font-semibold text-gray-500 hover:text-red-600"
                    >
                      Archive Team
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setTeams((all) => all.filter((_, n) => n !== i));
                        setOpen(null);
                      }}
                      className="cursor-pointer text-sm font-semibold text-gray-500 hover:text-red-600"
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
        className="mt-3 w-full cursor-pointer rounded-2xl border-2 border-dashed border-gray-300 py-3 text-sm font-bold text-gray-600 hover:border-green-400 hover:text-green-700"
      >
        + Add Team
      </button>

      {archived.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Archived</p>
          <div className="mt-2 flex flex-col gap-2">
            {archived.map(({ t, i }) => (
              <div key={t.slug} className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
                <span className="text-xl opacity-60">{t.accent}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-500">{t.name}</span>
                <button
                  onClick={() => change(i, { archived: false })}
                  className="cursor-pointer text-sm font-semibold text-green-700 hover:text-green-800"
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
        <span className="block font-bold text-gray-900">{label}</span>
        <span className="mt-0.5 block text-sm text-gray-500">{hint}</span>
      </span>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className="relative mt-1 h-7 w-12 shrink-0 rounded-full bg-gray-300 transition-colors after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-green-600 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-green-400"
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
    "mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400";
  const button =
    "mt-2 cursor-pointer rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-black disabled:opacity-40";
  return (
    <section className="mt-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="font-extrabold text-gray-900">🔑 Sign-In</h2>
      <label className="mt-4 block">
        <span className="text-sm font-bold text-gray-800">Club email</span>
        <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={input} />
        <span className="mt-1 block text-xs text-gray-400">Password reset links are sent here.</span>
      </label>
      <button onClick={() => save("email")} disabled={busy !== null || newEmail.trim() === email} className={button}>
        {busy === "email" ? "Saving…" : "Save Email"}
      </button>
      <div className="mt-5 border-t border-gray-100 pt-4">
        <span className="text-sm font-bold text-gray-800">Change the coach password</span>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password (8+ characters)" autoComplete="new-password" className={input} />
        <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="New password again" autoComplete="new-password" className={`${input} mt-2`} />
        <button onClick={() => save("password")} disabled={busy !== null || password.length < 8} className={button}>
          {busy === "password" ? "Changing…" : "Change Password"}
        </button>
      </div>
      {message && (
        <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${message.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
