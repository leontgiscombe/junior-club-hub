"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toBlob, toPng } from "html-to-image";
import { CLUB, TEAMS as CLUB_TEAMS } from "@/club.config";
import { TEAMS, teamName } from "@/lib/teams";
import { useMyTeam } from "@/lib/myTeam";
import { defaultSeasonName } from "@/lib/season";
import {
  MONTH_AWARD_KINDS,
  decidedByTieBreak,
  monthAwards,
  monthName,
  monthStandings,
  monthsWithAwards,
  posterDate,
  posterName,
  type MonthAward,
  type MonthAwardKind,
  type MonthStanding,
} from "@/lib/playerOfMonth";

interface Player {
  id: string;
  team: string;
  name: string;
}

interface Match {
  team: string;
  date: string;
  potmId: string;
  mostImprovedId: string;
}

interface TrainingSession {
  team: string;
  date: string;
  bestTrainerId: string;
  cancelled: boolean;
}

// What the coach changed for one team's month: kept on this device so the
// poster can be finished later.
interface PosterEdits {
  winnerId?: string;
  headline?: string;
  body?: string;
  slogan?: string;
  photoY?: number; // where the photo sits in its frame, 0 (top) to 100 (bottom)
}

const POSTER_W = 1080;
const POSTER_H = 1600;
const DEFAULT_SLOGAN = CLUB.slogan;

const editsKey = (team: string, month: string) => `${CLUB.storagePrefix}:potm:${team}:${month}`;

function readEdits(team: string, month: string): PosterEdits {
  try {
    return JSON.parse(window.localStorage.getItem(editsKey(team, month)) ?? "{}");
  } catch {
    return {};
  }
}

function writeEdits(team: string, month: string, edits: PosterEdits) {
  try {
    window.localStorage.setItem(editsKey(team, month), JSON.stringify(edits));
  } catch {
    // private browsing: the edits just aren't remembered
  }
}

// The winner's photo stays on this device: shrunk to a small JPEG and kept
// alongside the edits, never sent to the hub's server.
const photoKey = (team: string, month: string) => `${editsKey(team, month)}:photo`;

function readPhoto(team: string, month: string): string | null {
  try {
    return window.localStorage.getItem(photoKey(team, month));
  } catch {
    return null;
  }
}

function writePhoto(team: string, month: string, photo: string | null) {
  try {
    if (photo) window.localStorage.setItem(photoKey(team, month), photo);
    else window.localStorage.removeItem(photoKey(team, month));
  } catch {
    // too big or private browsing: it's used for now, just not remembered
  }
}

/** A picked photo, shrunk to at most 900px along its longer side. */
async function shrinkPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const ratio = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * ratio);
    canvas.height = Math.round(img.naturalHeight * ratio);
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** "2 best trainer awards and a most improved award" */
function awardPhrase(counts: Record<MonthAwardKind, number>): string {
  const parts = MONTH_AWARD_KINDS.filter((k) => counts[k.kind] > 0).map((k) =>
    counts[k.kind] === 1 ? `a ${k.plural.replace(/s$/, "")}` : `${counts[k.kind]} ${k.plural}`
  );
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** The month that should open first: last month once it has ended, else the latest with awards. */
function defaultMonth(months: string[]): string {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return months.find((m) => m < thisMonth) ?? months[0] ?? "";
}

export default function PlayerOfMonth({ posterFont }: { posterFont: string }) {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  // opens on the team last picked on this device (see lib/myTeam.ts)
  const [team, setTeam] = useMyTeam();
  const [pickedMonth, setPickedMonth] = useState("");
  const [edits, setEdits] = useState<PosterEdits>({});
  const [photo, setPhoto] = useState<string | null>(null);
  const [image, setImage] = useState<{ url: string; file: File } | null>(null);
  const [making, setMaking] = useState(false);

  const posterRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);

  const load = useCallback(async (adminKey: string) => {
    setLoading(true);
    setError(null);
    try {
      const q = `key=${encodeURIComponent(adminKey)}`;
      const [statsRes, matchRes, trainingRes] = await Promise.all([
        fetch(`/api/stats?${q}`),
        fetch(`/api/stats/matches?${q}`),
        fetch(`/api/stats/training?${q}`),
      ]);
      if ([statsRes, matchRes, trainingRes].some((r) => r.status === 401)) {
        setError("Incorrect password");
        setAuthed(false);
        return;
      }
      if (!statsRes.ok || !matchRes.ok || !trainingRes.ok) throw new Error("Failed to load");
      setPlayers((await statsRes.json()).players ?? []);
      setMatches((await matchRes.json()).matches ?? []);
      setSessions((await trainingRes.json()).sessions ?? []);
      setAuthed(true);
    } catch {
      setError("Could not load the awards. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const urlKey = new URLSearchParams(window.location.search).get("key");
    if (urlKey) {
      setKey(urlKey);
      load(urlKey);
    }
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const months = useMemo(() => monthsWithAwards(team, matches, sessions), [team, matches, sessions]);
  const month = months.includes(pickedMonth) ? pickedMonth : defaultMonth(months);

  // the coach's edits for this team and month, read back from the device
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (month) {
      setEdits(readEdits(team, month));
      setPhoto(readPhoto(team, month));
    }
    setImage(null);
  }, [team, month]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // scale the full-size poster down to fit the screen
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const fit = () => setScale(frame.clientWidth / POSTER_W);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [authed, month]);

  function edit(change: PosterEdits) {
    const next = { ...edits, ...change };
    setEdits(next);
    setImage(null);
    writeEdits(team, month, next);
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const shrunk = await shrinkPhoto(file);
      setPhoto(shrunk);
      setImage(null);
      writePhoto(team, month, shrunk);
    } catch {
      setError("Could not open that photo. Please try another.");
    }
  }

  function removePhoto() {
    setPhoto(null);
    setImage(null);
    writePhoto(team, month, null);
  }

  async function makeImage() {
    const node = posterRef.current;
    if (!node) return;
    setMaking(true);
    setError(null);
    try {
      const options = { width: POSTER_W, height: POSTER_H, pixelRatio: 1, cacheBust: true };
      // Safari sometimes leaves fonts and the crest out of the first capture
      await toPng(node, options);
      const blob = await toBlob(node, options);
      if (!blob) throw new Error("No image");
      const file = new File([blob], `player-of-the-month-${team}-${month}.png`, {
        type: "image/png",
      });
      setImage({ url: URL.createObjectURL(blob), file });
    } catch {
      setError("Could not make the image. Please try again.");
    } finally {
      setMaking(false);
    }
  }

  async function shareImage() {
    if (!image) return;
    try {
      await navigator.share({ files: [image.file], title: "Player of the Month" });
    } catch {
      // cancelled — nothing to do
    }
  }

  if (!authed) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-green-700 to-green-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="text-3xl mb-2">🌟</div>
            <h1 className="text-xl font-extrabold text-gray-900">Player of the Month</h1>
            <p className="text-sm text-gray-500 mt-1">Coaches only</p>
          </div>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(key)}
            placeholder="Enter password"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 mb-3"
          />
          {error && <p className="text-sm text-red-600 mb-3 text-center">{error}</p>}
          <button
            onClick={() => load(key)}
            disabled={loading || !key}
            className="w-full py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 disabled:opacity-40 cursor-pointer"
          >
            {loading ? "Loading…" : "Open player of the month"}
          </button>
          <Link
            href="/admin"
            className="mt-4 block text-center text-sm font-medium text-gray-500 hover:text-green-700"
          >
            ← Coach Admin
          </Link>
        </div>
      </main>
    );
  }

  const squad = players.filter((p) => p.team === team);
  const awards = month ? monthAwards(team, month, matches, sessions) : [];
  // players since removed can't be named on a poster
  const standings = monthStandings(awards).filter((s) => squad.some((p) => p.id === s.playerId));
  const winner =
    standings.find((s) => s.playerId === edits.winnerId) ?? (standings[0] as MonthStanding | undefined);
  const nameOf = (id: string) => {
    const p = squad.find((x) => x.id === id);
    return p ? posterName(p, squad) : "";
  };
  const fullNameOf = (id: string) => squad.find((x) => x.id === id)?.name ?? "Removed player";
  const winnerName = winner ? nameOf(winner.playerId) : "";
  const mName = month ? monthName(month) : "";
  const headline = edits.headline ?? `A thoroughly deserved award for ${winnerName}! 👏💚`;
  const body =
    edits.body ??
    (winner
      ? `${winnerName} picked up ${awardPhrase(winner.counts)} during ${mName}. Brilliant effort, ${winnerName} — keep it up! 💪⚽`
      : "");
  const slogan = edits.slogan ?? DEFAULT_SLOGAN;
  const clubTeam = CLUB_TEAMS.find((t) => t.slug === team);
  const squadLabel = `${CLUB.initials} ${clubTeam?.squadName ?? teamName(team)}`;
  const season = month ? defaultSeasonName(new Date(`${month}-01T00:00`)).replace(/^20(\d\d)\/(\d\d)$/, "$1/$2") : "";
  const canShare =
    image !== null &&
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [image.file] });

  return (
    <main className="min-h-screen bg-gray-50 pb-12">
      <div className="bg-gradient-to-br from-green-800 to-green-600 px-4 pt-6 pb-5 text-white">
        <Link
          href={`/admin?key=${encodeURIComponent(key)}`}
          className="text-sm font-medium text-green-100 hover:text-white"
        >
          ← Coach Admin
        </Link>
        <h1 className="text-xl font-extrabold mt-2">🌟 Player of the Month</h1>
        <p className="text-green-100 text-sm mt-0.5">
          Worked out from the month&apos;s best trainer, most improved and player of the match
          awards, with a poster to share.
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5">
        <div className="mb-4 grid grid-cols-3 gap-2">
          {TEAMS.map((t) => (
            <button
              key={t.slug}
              onClick={() => setTeam(t.slug)}
              className={`rounded-xl border px-2 py-2 text-sm font-bold cursor-pointer ${
                team === t.slug
                  ? "border-green-600 bg-green-600 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-green-400"
              }`}
            >
              {t.accent} {t.name}
            </button>
          ))}
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        {months.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
            No awards logged for {teamName(team)} yet. Pick a best trainer in the Training Log and a
            player of the match or most improved in the match log, and each month&apos;s winner
            shows here.
          </div>
        ) : (
          <>
            <label className="mb-4 block text-sm font-semibold text-gray-600">
              Month
              <select
                value={month}
                onChange={(e) => setPickedMonth(e.target.value)}
                className="ml-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400"
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {monthName(m)} {m.slice(0, 4)}
                  </option>
                ))}
              </select>
            </label>

            {/* The standings */}
            <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="mb-1 text-sm font-semibold text-gray-600">
                🏅 {mName} standings — {teamName(team)}
              </p>
              <p className="mb-3 text-xs text-gray-400">
                One point per award. Level on points goes to more kinds of award, then more player
                of the match, then the latest award. Tap a player to make them the winner instead.
              </p>
              <div className="flex flex-col gap-1.5">
                {standings.map((s, i) => {
                  const chosen = winner?.playerId === s.playerId;
                  return (
                    <button
                      key={s.playerId}
                      onClick={() => edit({ winnerId: s.playerId })}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left cursor-pointer ${
                        chosen
                          ? "border-green-500 bg-green-50"
                          : "border-gray-100 bg-gray-50 hover:border-green-300"
                      }`}
                    >
                      <span className="w-5 shrink-0 text-xs font-bold text-gray-400">{i + 1}</span>
                      <span className="flex-1 min-w-0 truncate text-sm font-bold text-gray-900">
                        {fullNameOf(s.playerId)}
                        {chosen && <span className="ml-1 text-green-600" title="Winner">★</span>}
                      </span>
                      <span className="shrink-0 text-xs text-gray-500 tabular-nums">
                        {MONTH_AWARD_KINDS.filter((k) => s.counts[k.kind] > 0)
                          .map((k) => `${k.icon} ${s.counts[k.kind]}`)
                          .join("  ")}
                      </span>
                      <span className="w-12 shrink-0 text-right text-sm font-extrabold text-green-700 tabular-nums">
                        {s.points} pt{s.points === 1 ? "" : "s"}
                      </span>
                    </button>
                  );
                })}
              </div>
              {decidedByTieBreak(standings) && !edits.winnerId && (
                <p className="mt-2 text-xs text-amber-700">
                  {fullNameOf(standings[0].playerId)} and {fullNameOf(standings[1].playerId)} are
                  level on points — the tie-break picked {fullNameOf(standings[0].playerId)}.
                </p>
              )}
              {edits.winnerId && edits.winnerId !== standings[0]?.playerId && (
                <button
                  onClick={() => edit({ winnerId: undefined })}
                  className="mt-2 text-xs font-semibold text-green-700 hover:text-green-800 cursor-pointer"
                >
                  ↺ Go back to the top of the standings
                </button>
              )}
            </div>

            {/* The winner's photo */}
            <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="mb-1 text-sm font-semibold text-gray-600">📷 Winner&apos;s photo (optional)</p>
              <p className="mb-3 text-xs text-gray-400">
                Only add a photo if the child&apos;s parents are happy for it to be shared. It stays on
                this phone — it&apos;s only in the image you make, never saved to the hub.
              </p>
              {photo ? (
                <>
                  <label className="mb-2 block text-xs font-semibold text-gray-500">
                    Move the photo up or down
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={edits.photoY ?? 25}
                      onChange={(e) => edit({ photoY: Number(e.target.value) })}
                      className="mt-1 w-full accent-green-600"
                    />
                  </label>
                  <div className="flex gap-3">
                    <label className="cursor-pointer text-xs font-semibold text-green-700 hover:text-green-800">
                      Change photo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          pickPhoto(e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <button
                      onClick={removePhoto}
                      className="text-xs font-semibold text-red-600 hover:text-red-700 cursor-pointer"
                    >
                      Remove photo
                    </button>
                  </div>
                </>
              ) : (
                <label className="block w-full cursor-pointer rounded-xl border-2 border-dashed border-gray-200 py-3 text-center text-sm font-semibold text-green-700 hover:border-green-400">
                  + Add a Photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      pickPhoto(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>

            {/* The poster's words */}
            <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-gray-600">✏️ Poster Words</p>
              <label className="mb-2 block text-xs font-semibold text-gray-500">
                Headline
                <input
                  value={headline}
                  onChange={(e) => edit({ headline: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </label>
              <label className="mb-2 block text-xs font-semibold text-gray-500">
                Why they won
                <textarea
                  value={body}
                  rows={5}
                  onChange={(e) => edit({ body: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </label>
              <label className="block text-xs font-semibold text-gray-500">
                Slogan along the bottom
                <input
                  value={slogan}
                  onChange={(e) => edit({ slogan: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </label>
              {(edits.headline !== undefined || edits.body !== undefined || edits.slogan !== undefined) && (
                <button
                  onClick={() => edit({ headline: undefined, body: undefined, slogan: undefined })}
                  className="mt-2 text-xs font-semibold text-green-700 hover:text-green-800 cursor-pointer"
                >
                  ↺ Reset the words
                </button>
              )}
              <p className="mt-2 text-[11px] text-gray-400">
                Players appear by first name only. Your changes are kept on this device.
              </p>
            </div>

            {/* The poster */}
            <div ref={frameRef} className="w-full overflow-hidden rounded-xl shadow-lg" style={{ height: POSTER_H * scale }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: POSTER_W }}>
                <Poster
                  ref={posterRef}
                  font={posterFont}
                  monthName={mName}
                  squadLabel={squadLabel}
                  season={season}
                  awards={awards.filter((a) => squad.some((p) => p.id === a.playerId))}
                  nameOf={nameOf}
                  winnerName={winnerName}
                  winner={winner}
                  photo={photo}
                  photoY={edits.photoY ?? 25}
                  headline={headline}
                  body={body}
                  slogan={slogan}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={makeImage}
                disabled={making || !winner}
                className="w-full rounded-xl bg-green-600 py-3 font-bold text-white hover:bg-green-700 disabled:opacity-40 cursor-pointer"
              >
                {making ? "Making the Image…" : image ? "↻ Make the Image Again" : "🖼️ Make the Image"}
              </button>
              {image && (
                <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <p className="mb-2 text-xs text-gray-500">
                    Here&apos;s the image — on a phone, press and hold it to save it to your photos.
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt={`${mName} player of the month poster`} className="w-full rounded-lg" />
                  <div className="mt-3 flex gap-2">
                    {canShare && (
                      <button
                        onClick={shareImage}
                        className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white hover:bg-green-700 cursor-pointer"
                      >
                        📤 Share
                      </button>
                    )}
                    <a
                      href={image.url}
                      download={image.file.name}
                      className="flex-1 rounded-xl border border-green-600 py-2.5 text-center text-sm font-bold text-green-700 hover:bg-green-50"
                    >
                      ⬇ Download
                    </a>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

// ── The poster ─────────────────────────────────────────────────────────────
// Drawn at full size (1080 × 1600) and scaled down to preview; the image is
// taken from this element.

const NEON = "#3ee04f";
const INK = "#060906";
const GOLD = "#f8cc2c";

function Poster({
  ref,
  font,
  monthName,
  squadLabel,
  season,
  awards,
  nameOf,
  winnerName,
  winner,
  headline,
  body,
  slogan,
  photo,
  photoY,
}: {
  ref: React.Ref<HTMLDivElement>;
  font: string;
  monthName: string;
  squadLabel: string;
  season: string;
  awards: MonthAward[];
  nameOf: (id: string) => string;
  winnerName: string;
  winner: MonthStanding | undefined;
  headline: string;
  body: string;
  slogan: string;
  photo: string | null;
  photoY: number;
}) {
  const display: React.CSSProperties = { fontFamily: "var(--font-poster)", textTransform: "uppercase" };
  const month = monthName.toUpperCase();
  // a month with five Mondays or match days needs smaller rows to fit
  const mostRows = Math.max(...MONTH_AWARD_KINDS.map((k) => awards.filter((a) => a.kind === k.kind).length));
  const rowSize = mostRows > 6 ? 18 : mostRows > 4 ? 22 : 26;
  // the coach's note gets bigger text when it's short, so the card looks full
  const words = headline.length + body.length;
  const wordsSize = words < 140 ? 25 : words < 220 ? 22 : words < 320 ? 19 : 16;
  // the longer the name, the smaller it gets, so it always fits
  const bigName = (width: number, max: number) =>
    Math.min(max, Math.floor(width / (Math.max(winnerName.length, 3) * 0.56)));

  return (
    <div
      ref={ref}
      className={font}
      style={{
        position: "relative",
        width: POSTER_W,
        height: POSTER_H,
        overflow: "hidden",
        background: INK,
        color: "white",
        fontFamily: "var(--font-poster-body), system-ui, sans-serif",
      }}
    >
      {/* dry-brush paint strokes (drawn once, kept in public/poster/) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/poster/brush-background.jpg"
        alt=""
        style={{ position: "absolute", inset: 0, width: POSTER_W, height: POSTER_H }}
      />

      {/* header */}
      <div style={{ position: "absolute", top: 40, left: 48, right: 48, display: "flex", alignItems: "flex-start" }}>
        <div style={{ flex: 1, transform: "skewX(-6deg)", lineHeight: 0.92 }}>
          <div style={{ ...display, fontSize: month.length > 7 ? 120 : 140, color: "white", textShadow: "6px 6px 0 #000" }}>
            📰 {month}
          </div>
          <div style={{ ...display, fontSize: 140, color: NEON, textShadow: `6px 6px 0 #000, 0 0 40px rgba(62,224,79,0.55)` }}>
            Team News
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={CLUB.crest.src}
          alt=""
          width={190}
          style={{ height: "auto", filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.6))" }}
        />
      </div>

      {/* banner */}
      <div
        style={{
          position: "absolute",
          top: 300,
          left: 40,
          width: 760,
          padding: "22px 40px 20px",
          background: "white",
          transform: "rotate(-2deg)",
          clipPath:
            "polygon(0 8%, 4% 0, 30% 5%, 60% 0, 97% 4%, 100% 40%, 98% 100%, 60% 94%, 25% 100%, 2% 95%)",
        }}
      >
        <div style={{ fontSize: 46, fontWeight: 800, color: "#178a2a", lineHeight: 1.05 }}>
          {squadLabel} – {monthName}
        </div>
        <div style={{ ...display, fontSize: 64, color: "#111", lineHeight: 1.05, fontStyle: "italic" }}>
          Player of the Month! 🏆
        </div>
      </div>

      <div style={{ position: "absolute", top: 478, left: 56, width: 990, fontSize: 29, fontWeight: 700, lineHeight: 1.25 }}>
        The runners &amp; riders are in… and the {monthName} results are decided! 👀🔥
      </div>

      {/* the three award boxes */}
      <div style={{ position: "absolute", top: 560, left: 36, width: 600, display: "flex", flexDirection: "column", gap: 12 }}>
        {MONTH_AWARD_KINDS.map((k) => (
          <AwardBox
            key={k.kind}
            icon={k.kind === "bestTrainer" ? "👟" : k.kind === "mostImproved" ? "📈" : "🏆"}
            bullet={k.kind === "bestTrainer" ? "★" : k.kind === "mostImproved" ? "💪" : "🔥"}
            title={k.label}
            display={display}
            rowSize={rowSize}
            rows={awards
              .filter((a) => a.kind === k.kind)
              .map((a) => ({
                name: nameOf(a.playerId),
                date: posterDate(a.date),
                won: a.playerId === winner?.playerId,
              }))}
          />
        ))}
      </div>

      {/* the winner: their photo if the coach added one, else their award counts */}
      {photo ? (
        <div
          style={{
            position: "absolute",
            top: 560,
            left: 664,
            width: 380,
            height: 450,
            borderRadius: 24,
            border: `5px solid ${GOLD}`,
            boxShadow: `0 0 40px rgba(248,204,44,0.45)`,
            overflow: "hidden",
            background: "#0a2610",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: `50% ${photoY}%`,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: "70px 18px 16px",
              background: "linear-gradient(transparent, rgba(0,0,0,0.85) 55%)",
              textAlign: "center",
            }}
          >
            <div style={{ ...display, fontSize: 24, color: GOLD, letterSpacing: 2 }}>⭐ Star of the month ⭐</div>
            <div
              style={{
                ...display,
                fontSize: bigName(320, 84),
                lineHeight: 1,
                transform: "skewX(-6deg)",
                textShadow: "4px 4px 0 #000",
              }}
            >
              {winnerName}
            </div>
            <div style={{ ...display, fontSize: 24, marginTop: 4 }}>
              {winner ? `${winner.points} award${winner.points === 1 ? "" : "s"} in ${monthName}` : ""}
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            position: "absolute",
            top: 560,
            left: 664,
            width: 380,
            height: 450,
            borderRadius: 24,
            border: `5px solid ${GOLD}`,
            background: "radial-gradient(circle at 50% 30%, #1d6b29 0%, #0a2610 60%, #050b06 100%)",
            boxShadow: `0 0 40px rgba(248,204,44,0.45)`,
            overflow: "hidden",
            padding: "22px 22px 18px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* light rays and a faint crest behind the winner */}
          <div
            style={{
              position: "absolute",
              inset: -200,
              background:
                "repeating-conic-gradient(from 0deg at 50% 45%, rgba(248,204,44,0.10) 0deg 8deg, transparent 8deg 20deg)",
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={CLUB.crest.src}
            alt=""
            style={{
              position: "absolute",
              left: "50%",
              top: 120,
              width: 260,
              height: "auto",
              transform: "translateX(-50%)",
              opacity: 0.12,
            }}
          />
          <div
            style={{
              position: "relative",
              ...display,
              fontSize: 27,
              color: GOLD,
              letterSpacing: 1,
              whiteSpace: "nowrap",
              textAlign: "center",
            }}
          >
            ⭐ Star of the month ⭐
          </div>
          <div
            style={{
              position: "relative",
              ...display,
              fontSize: bigName(320, 100),
              lineHeight: 1,
              textAlign: "center",
              margin: "10px 0 14px",
              transform: "skewX(-6deg)",
              textShadow: "5px 5px 0 #000, 0 0 30px rgba(248,204,44,0.5)",
            }}
          >
            {winnerName}
          </div>
          {winner &&
            MONTH_AWARD_KINDS.filter((k) => winner.counts[k.kind] > 0).map((k) => (
              <div
                key={k.kind}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "6px 14px",
                  marginBottom: 8,
                  borderRadius: 14,
                  background: "rgba(0,0,0,0.45)",
                  fontSize: 24,
                  fontWeight: 700,
                }}
              >
                <span style={{ fontSize: 30 }}>{k.icon}</span>
                <span style={{ flex: 1 }}>{k.label}</span>
                <span style={{ ...display, fontSize: 40, color: GOLD }}>×{winner.counts[k.kind]}</span>
              </div>
            ))}
          <div
            style={{
              position: "relative",
              marginTop: "auto",
              textAlign: "center",
              ...display,
              fontSize: 30,
              color: "white",
            }}
          >
            {winner ? `${winner.points} award${winner.points === 1 ? "" : "s"} in ${monthName}` : ""}
          </div>
        </div>
      )}

      {/* the coach's words */}
      <div
        style={{
          position: "absolute",
          top: 1030,
          left: 664,
          width: 380,
          height: 238,
          overflow: "hidden",
          padding: "18px 20px",
          background: "white",
          color: "#111",
          borderRadius: 6,
          transform: "rotate(-1deg)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
          fontSize: wordsSize,
          lineHeight: 1.28,
          whiteSpace: "pre-line",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 8, fontSize: wordsSize + 1 }}>{headline}</div>
        <div style={{ fontWeight: 500 }}>{body}</div>
      </div>
      {/* a strip of tape holding the note on */}
      <div
        style={{
          position: "absolute",
          top: 1014,
          left: 800,
          width: 120,
          height: 34,
          background: "rgba(62,224,79,0.75)",
          transform: "rotate(-4deg)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
        }}
      />

      {/* trophy and the winner's name */}
      <div style={{ position: "absolute", top: 1284, left: 30, right: 40, display: "flex", alignItems: "center", gap: 16 }}>
        <Trophy month={month} season={season} display={display} />
        <div style={{ flex: 1, transform: "skewX(-6deg)" }}>
          <div style={{ ...display, fontSize: 44, lineHeight: 1.05 }}>{monthName} player of the month –</div>
          <div
            style={{
              ...display,
              fontSize: bigName(720, 90),
              lineHeight: 1.05,
              color: NEON,
              textShadow: "5px 5px 0 #000",
            }}
          >
            {winnerName}!
          </div>
        </div>
      </div>

      {/* slogan */}
      <div
        style={{
          position: "absolute",
          left: -20,
          right: -20,
          bottom: 14,
          padding: "12px 60px",
          background: NEON,
          transform: "rotate(-1.5deg)",
          textAlign: "center",
          clipPath: "polygon(0 15%, 3% 0, 50% 8%, 97% 0, 100% 30%, 99% 100%, 50% 90%, 1% 100%)",
        }}
      >
        <div style={{ ...display, fontSize: slogan.length > 44 ? 38 : 46, color: INK, fontStyle: "italic" }}>{slogan}</div>
      </div>
    </div>
  );
}

function AwardBox({
  icon,
  bullet,
  title,
  rows,
  rowSize,
  display,
}: {
  icon: string;
  bullet: string;
  title: string;
  rows: { name: string; date: string; won: boolean }[];
  rowSize: number;
  display: React.CSSProperties;
}) {
  return (
    <div
      style={{
        border: `4px solid ${NEON}`,
        borderRadius: 20,
        background: "rgba(0,0,0,0.78)",
        boxShadow: `0 0 18px rgba(62,224,79,0.3)`,
        padding: "12px 20px 12px",
        height: 228,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            border: `3px solid ${NEON}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 30,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div
          style={{
            ...display,
            fontSize: 34,
            color: INK,
            background: NEON,
            padding: "2px 22px 0",
            fontStyle: "italic",
            clipPath: "polygon(0 0, 100% 6%, 96% 100%, 2% 92%)",
          }}
        >
          {title}
        </div>
      </div>
      <div style={{ paddingLeft: 66, paddingRight: 6 }}>
        {rows.length === 0 ? (
          <div style={{ fontSize: 24, color: "#9ca3af" }}>None this month</div>
        ) : (
          // the month's winner stands out in gold wherever they appear
          rows.map((r, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "baseline", fontSize: rowSize, lineHeight: 1.3 }}
            >
              <span style={{ color: r.won ? GOLD : NEON, width: rowSize * 1.5, flexShrink: 0 }}>
                {bullet}
              </span>
              <span style={{ fontWeight: 800, color: r.won ? GOLD : "white" }}>{r.name}</span>
              <span
                style={{
                  flex: 1,
                  margin: "0 12px",
                  borderBottom: "2px dotted rgba(255,255,255,0.25)",
                  transform: "translateY(-6px)",
                }}
              />
              <span style={{ color: r.won ? GOLD : "#d1d5db", fontWeight: 600 }}>{r.date}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Trophy({ month, season, display }: { month: string; season: string; display: React.CSSProperties }) {
  return (
    <div style={{ position: "relative", width: 230, height: 250, flexShrink: 0, margin: "-32px -26px", transform: "scale(0.76)" }}>
      <svg width="230" height="250" viewBox="0 0 230 250" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fde68a" />
            <stop offset="0.45" stopColor="#f5c518" />
            <stop offset="1" stopColor="#b7791f" />
          </linearGradient>
        </defs>
        {/* crown */}
        <path d="M80 30 L92 6 L104 24 L115 0 L126 24 L138 6 L150 30 Z" fill="url(#gold)" />
        {/* handles */}
        <path d="M40 60 C0 60 0 130 55 140" stroke="url(#gold)" strokeWidth="12" fill="none" />
        <path d="M190 60 C230 60 230 130 175 140" stroke="url(#gold)" strokeWidth="12" fill="none" />
        {/* cup */}
        <path d="M35 36 H195 V100 C195 150 160 180 115 180 C70 180 35 150 35 100 Z" fill="url(#gold)" />
        <path d="M100 180 H130 V205 H100 Z" fill="url(#gold)" />
        <path d="M65 205 H165 L172 240 H58 Z" fill="url(#gold)" />
      </svg>
      <div
        style={{
          position: "absolute",
          top: 46,
          left: 40,
          width: 150,
          textAlign: "center",
          color: "#1f2937",
          ...display,
          lineHeight: 1.05,
        }}
      >
        <div style={{ fontSize: month.length > 7 ? 18 : 21 }}>{month}</div>
        <div style={{ fontSize: 19 }}>Player of the</div>
        <div style={{ fontSize: 30 }}>Month</div>
        <div style={{ fontSize: 22 }}>{season}</div>
      </div>
    </div>
  );
}
