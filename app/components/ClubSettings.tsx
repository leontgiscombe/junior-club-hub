"use client";

// Coach Admin → Settings: the club's name, initials, slogan, season, crest and
// whether results are public. Saved to the database and shown on every page
// straight away; an empty box goes back to the default in club.config.ts.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Club, ClubChanges, EditableText } from "@/lib/clubSettings";
import { EDITABLE } from "@/lib/clubSettings";

type Snapshot = {
  club: Club;
  defaults: Club;
  changes: ClubChanges;
  crest: { width: number; height: number; updatedAt: string } | null;
};

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

  const take = useCallback((data: Snapshot) => {
    setSnap(data);
    setDraft(data.changes);
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
    setSaving(true);
    try {
      await send("PUT", { changes: draft }, "Saved — every page now shows the new details.");
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
  const dirty = JSON.stringify(draft) !== JSON.stringify(snap.changes);

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
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
        <div className="relative mt-4 overflow-hidden rounded-3xl bg-[#060906] px-6 py-8 text-center text-white shadow-lg">
          <div
            className="absolute inset-0 bg-cover bg-top opacity-70"
            style={{ backgroundImage: "url(/poster/brush-background.jpg)" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-green-950/30 via-transparent to-green-950/80" />
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={club.crest.src} alt={club.crest.alt} className="mx-auto mb-3 h-24 w-auto" />
            <p className="text-3xl font-black uppercase tracking-wide">{shown("name")}</p>
            <p className="mt-1 text-sm font-bold uppercase tracking-widest text-[#3ee04f]">Team Hub</p>
            <p className="mt-3 inline-block rounded-full border border-white/25 bg-black/30 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-green-100">
              {shown("kitSeason")} season
            </p>
            <p className="mt-4 text-sm font-bold uppercase text-[#3ee04f]">{shown("slogan")}</p>
            <p className="mt-1 text-xs text-gray-400">{shown("fullName")}</p>
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-gray-400">Preview of the top of the home page</p>

        {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {notice && <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</p>}

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

        {/* Results */}
        <section className="mt-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={publicResults}
              onChange={(e) => setDraft((d) => ({ ...d, publicResults: e.target.checked }))}
              className="mt-1 h-5 w-5 accent-green-600"
            />
            <span>
              <span className="block font-extrabold text-gray-900">⚽ Show Results to Parents</span>
              <span className="mt-0.5 block text-sm text-gray-500">
                Scores, league tables and top scorers on the home page. Turn it off for
                non-competitive football; coaches still log every game.
              </span>
            </span>
          </label>
        </section>

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
