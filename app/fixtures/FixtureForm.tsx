"use client";

// A fixture's details, for a coach to add or change: the team (one of the
// club's), the opponent (from the team's league, or typed), home or away, the
// date, meet and kick-off times, where it is, and a note for the families.
// Venues used before fill in their address when picked.
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "@/lib/dialog";
import { haptic } from "@/lib/haptics";

type TeamOption = { slug: string; name: string; opponents: string[] };
export type Venue = { team: string; venue: string; address: string; home: boolean };
export type FixtureValues = {
  team: string;
  type: "league" | "cup" | "friendly";
  opponent: string;
  home: boolean;
  date: string;
  time: string;
  meetTime: string;
  venue: string;
  address: string;
  notes: string;
};

const field =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[15px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 dark:border-white/15 dark:bg-[#2c2c2e] dark:text-gray-50";
const labelText = "mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400";

/** "HH:MM" less `minutes`, for a suggested meet time. */
function before(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  const t = (h * 60 + m - minutes + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export default function FixtureForm({
  teams,
  venues,
  initial,
  matchId,
  sent,
}: {
  teams: TeamOption[];
  venues: Venue[];
  initial: FixtureValues;
  /** editing this game; a new one without */
  matchId?: string;
  /** already sent to the families */
  sent?: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState<FixtureValues>(initial);
  const [tell, setTell] = useState(true);
  const [busy, setBusy] = useState<"" | "save" | "send">("");
  const [error, setError] = useState("");
  const set = <K extends keyof FixtureValues>(k: K, value: FixtureValues[K]) => setV((x) => ({ ...x, [k]: value }));

  const team = teams.find((t) => t.slug === v.team);
  const leagueOpponents = v.type === "league" ? team?.opponents ?? [] : [];
  // venues this team (then the club) has played at, home ones first for a home game
  const known = useMemo(() => {
    const seen = new Map<string, Venue>();
    for (const x of [...venues.filter((x) => x.team === v.team), ...venues]) {
      const k = x.venue.trim().toLowerCase();
      if (k && !seen.has(k)) seen.set(k, x);
    }
    return [...seen.values()].sort((a, b) => Number(b.home === v.home) - Number(a.home === v.home));
  }, [venues, v.team, v.home]);

  function pickVenue(name: string) {
    set("venue", name);
    const hit = known.find((x) => x.venue.trim().toLowerCase() === name.trim().toLowerCase());
    if (hit && !v.address.trim()) set("address", hit.address);
  }

  async function submit(send: boolean) {
    setError("");
    if (!v.team) return setError("Pick the team");
    if (!v.opponent.trim()) return setError("Who are you playing?");
    if (!v.date) return setError("Pick the date");
    setBusy(send ? "send" : "save");
    try {
      const res = await fetch("/api/fixtures", {
        method: matchId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(matchId ? { matchId, action: "edit", ...v, tell: sent && tell } : { ...v, send }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "That didn't save — try again");
        setBusy("");
        return;
      }
      haptic();
      const told = Number(data.told ?? 0);
      toast(told ? `Saved and sent to ${told} ${told === 1 ? "family" : "families"}` : "Saved");
      router.replace(`/fixtures/${matchId ?? data.match.id}`);
    } catch {
      setError("No connection — try again");
      setBusy("");
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
      className="flex flex-col gap-5"
    >
      <section className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm dark:bg-[#1c1c1e]">
        <label>
          <span className={labelText}>Team</span>
          <select value={v.team} onChange={(e) => set("team", e.target.value)} className={field} disabled={!!matchId}>
            <option value="">Choose a team…</option>
            {teams.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className={labelText}>Competition</span>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-white/10" role="radiogroup" aria-label="Competition">
            {(["league", "cup", "friendly"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={v.type === t}
                onClick={() => set("type", t)}
                className={`rounded-lg py-2 text-sm font-bold capitalize ${v.type === t ? "bg-white shadow-sm dark:bg-[#3a3a3c]" : "text-gray-600 dark:text-gray-300"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <label>
          <span className={labelText}>Opponent</span>
          {leagueOpponents.length > 0 ? (
            <select value={leagueOpponents.includes(v.opponent) ? v.opponent : v.opponent ? "__other" : ""} onChange={(e) => set("opponent", e.target.value === "__other" ? " " : e.target.value)} className={field}>
              <option value="">Choose the opponent…</option>
              {leagueOpponents.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
              <option value="__other">Someone else…</option>
            </select>
          ) : null}
          {(leagueOpponents.length === 0 || (v.opponent && !leagueOpponents.includes(v.opponent))) && (
            <input
              value={v.opponent.trimStart()}
              onChange={(e) => set("opponent", e.target.value)}
              placeholder="e.g. Riverside Juniors U10 Blues"
              className={`${field} ${leagueOpponents.length ? "mt-2" : ""}`}
              autoComplete="off"
            />
          )}
        </label>

        <div>
          <span className={labelText}>Venue</span>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-white/10" role="radiogroup" aria-label="Home or away">
            {[true, false].map((h) => (
              <button
                key={String(h)}
                type="button"
                role="radio"
                aria-checked={v.home === h}
                onClick={() => set("home", h)}
                className={`rounded-lg py-2 text-sm font-bold ${v.home === h ? "bg-white shadow-sm dark:bg-[#3a3a3c]" : "text-gray-600 dark:text-gray-300"}`}
              >
                {h ? "Home" : "Away"}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm dark:bg-[#1c1c1e]">
        <label>
          <span className={labelText}>Date</span>
          <input type="date" value={v.date} onChange={(e) => set("date", e.target.value)} className={field} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className={labelText}>Kick-off</span>
            <input
              type="time"
              value={v.time}
              onChange={(e) => {
                const time = e.target.value;
                // a meet time half an hour before, until one's chosen
                setV((x) => ({ ...x, time, meetTime: x.meetTime && x.meetTime !== before(x.time, 30) ? x.meetTime : time ? before(time, 30) : "" }));
              }}
              className={field}
            />
          </label>
          <label>
            <span className={labelText}>Meet</span>
            <input type="time" value={v.meetTime} onChange={(e) => set("meetTime", e.target.value)} className={field} />
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm dark:bg-[#1c1c1e]">
        <label>
          <span className={labelText}>Ground</span>
          <input list="fixture-venues" value={v.venue} onChange={(e) => pickVenue(e.target.value)} placeholder="e.g. Woodhall Sports Hub, pitch 1C" className={field} autoComplete="off" />
          <datalist id="fixture-venues">
            {known.map((x) => (
              <option key={x.venue} value={x.venue} />
            ))}
          </datalist>
        </label>
        <label>
          <span className={labelText}>Address</span>
          <textarea value={v.address} onChange={(e) => set("address", e.target.value)} rows={2} placeholder="Street and postcode — shown on an Apple map" className={field} />
        </label>
      </section>

      <section className="rounded-3xl bg-white p-4 shadow-sm dark:bg-[#1c1c1e]">
        <label>
          <span className={labelText}>Notes for families</span>
          <textarea value={v.notes} onChange={(e) => set("notes", e.target.value)} rows={4} placeholder="Kit colour, parking, pitch markings, who's bringing the oranges…" className={field} />
        </label>
      </section>

      {matchId && sent && (
        <label className="flex items-center gap-3 rounded-3xl bg-white px-4 py-3.5 shadow-sm dark:bg-[#1c1c1e]">
          <input type="checkbox" checked={tell} onChange={(e) => setTell(e.target.checked)} className="h-5 w-5 accent-green-700" />
          <span className="text-[15px] font-semibold">Let the families know it&apos;s changed</span>
        </label>
      )}

      {error && <p className="px-1 text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex flex-col gap-2">
        {!matchId && (
          <button type="button" disabled={!!busy} onClick={() => submit(true)} className="press rounded-2xl bg-green-700 py-3.5 font-bold text-white disabled:opacity-50">
            {busy === "send" ? "Sending…" : "Save and send to families"}
          </button>
        )}
        <button
          type="submit"
          disabled={!!busy}
          className={`press rounded-2xl py-3.5 font-bold disabled:opacity-50 ${matchId ? "bg-green-700 text-white" : "bg-white text-gray-900 shadow-sm dark:bg-[#1c1c1e] dark:text-gray-50"}`}
        >
          {busy === "save" ? "Saving…" : matchId ? "Save changes" : "Save without sending"}
        </button>
      </div>
    </form>
  );
}
