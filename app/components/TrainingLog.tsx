"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTeams } from "./ClubProvider";
import { useMyTeam } from "@/lib/myTeam";
import {
  DRILL_KINDS,
  scheduleWeeks,
  type Drill,
  type PlanWeek,
  type TrainingPlan,
} from "@/lib/trainingPlanTypes";
import { DrillDetails, KindBadge } from "./DrillDetails";

interface Player {
  id: string;
  team: string;
  name: string;
  bestTrainer: number;
}

interface TrainingSession {
  team: string;
  date: string;
  bestTrainerId: string;
  cancelled: boolean;
}

function formatDate(date: string) {
  const d = new Date(`${date}T00:00`);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function monthLabel(date: string) {
  const d = new Date(`${date}T00:00`);
  if (isNaN(d.getTime())) return date.slice(0, 7);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** Sessions grouped by month, keeping the order they came in. */
function byMonth(sessions: TrainingSession[]) {
  const groups: { month: string; sessions: TrainingSession[] }[] = [];
  for (const s of sessions) {
    const month = monthLabel(s.date);
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.sessions.push(s);
    else groups.push({ month, sessions: [s] });
  }
  return groups;
}

/** A plan week's theme and drills, each opening up to the full drill. */
function PlanWeekCard({
  label,
  week,
  weekNumber,
  drills,
  adminKey,
  team,
  onPlan,
}: {
  adminKey: string;
  team: string;
  // the plan as saved after a tick, so the log shows it straight away
  onPlan: (plan: TrainingPlan) => void;
  label: string;
  week: PlanWeek;
  weekNumber: number;
  drills: Map<string, Drill>;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [ticking, setTicking] = useState<string | null>(null);
  const [tickError, setTickError] = useState<string | null>(null);

  // Tick a drill off as done — the same ticks as on the training plans page.
  async function tick(drillId: string, done: boolean) {
    setTicking(drillId);
    setTickError(null);
    try {
      const res = await fetch(`/api/training/plans?key=${encodeURIComponent(adminKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "tick-drill", team, weekId: week.id, drillId, done }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "That didn't save");
      onPlan(data.plan);
    } catch (err) {
      setTickError(err instanceof Error ? err.message : "That didn't save");
    } finally {
      setTicking(null);
    }
  }

  const weekDrills = week.drillIds
    .map((id) => drills.get(id))
    .filter((d): d is Drill => !!d)
    // warm-up, technical, game — the order every session runs in
    .sort(
      (a, b) =>
        DRILL_KINDS.findIndex((k) => k.slug === a.kind) -
        DRILL_KINDS.findIndex((k) => k.slug === b.kind)
    );
  const minutes = weekDrills.reduce((sum, d) => sum + d.minutes, 0);
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-green-200 p-4 mb-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-green-700">{label}</p>
      <p className="mt-1 text-base font-extrabold text-gray-900">
        Week {weekNumber}
        {week.theme ? `: ${week.theme}` : ""}
      </p>
      {weekDrills.length === 0 ? (
        <p className="mt-2 text-xs text-gray-400">No drills picked for this week yet.</p>
      ) : (
        <ol className="mt-3 flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-100">
          {weekDrills.map((drill) => {
            const isOpen = open === drill.id;
            return (
              <li key={drill.id} className="px-3 py-2">
                <button
                  onClick={() => setOpen(isOpen ? null : drill.id)}
                  aria-expanded={isOpen}
                  className="flex w-full cursor-pointer items-center gap-2 text-left"
                >
                  <KindBadge kind={drill.kind} />
                  <span className="min-w-0 flex-1 text-sm font-semibold text-gray-900">
                    {drill.title}
                  </span>
                  {drill.minutes > 0 && (
                    <span className="shrink-0 text-xs text-gray-400">{drill.minutes}′</span>
                  )}
                  <span className="shrink-0 text-xs text-gray-400">{isOpen ? "▲" : "▼"}</span>
                </button>
                {(() => {
                  const ticked = week.doneIds.includes(drill.id);
                  return (
                    <button
                      onClick={() => tick(drill.id, !ticked)}
                      disabled={ticking === drill.id}
                      aria-pressed={ticked}
                      className={`mt-2 cursor-pointer rounded-full border px-2.5 py-0.5 text-xs font-bold disabled:opacity-40 ${
                        ticked
                          ? "border-green-600 bg-green-600 text-white"
                          : "border-gray-200 bg-white text-gray-500 hover:border-green-400 hover:text-green-700"
                      }`}
                    >
                      {ticked ? "✓ Done" : "Mark Done"}
                    </button>
                  );
                })()}
                {isOpen && (
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <DrillDetails drill={drill} adminKey={adminKey} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {tickError && <p className="mt-2 text-xs text-red-600">{tickError}</p>}
      {minutes > 0 && <p className="mt-2 text-right text-xs font-semibold text-gray-500">⏱ {minutes} min</p>}
    </div>
  );
}

export default function TrainingLog() {
  const { TEAMS, teamName } = useTeams();
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  // opens on the team last picked on this device (see lib/myTeam.ts)
  const [team, setTeam] = useMyTeam();
  const [busy, setBusy] = useState<string | null>(null);
  // the rest of the season stays tucked away until it's wanted
  const [showAhead, setShowAhead] = useState(false);
  // past months opened or folded by hand (the latest month starts open)
  const [monthToggles, setMonthToggles] = useState<Record<string, boolean>>({});

  const load = useCallback(async (adminKey: string) => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, trainingRes, plansRes] = await Promise.all([
        fetch(`/api/stats?key=${encodeURIComponent(adminKey)}`),
        fetch(`/api/stats/training?key=${encodeURIComponent(adminKey)}`),
        fetch(`/api/training/plans?key=${encodeURIComponent(adminKey)}`),
      ]);
      if (statsRes.status === 401 || trainingRes.status === 401) {
        setError("Incorrect password");
        setAuthed(false);
        return;
      }
      if (!statsRes.ok || !trainingRes.ok) throw new Error("Failed to load");
      setPlayers((await statsRes.json()).players ?? []);
      setSessions((await trainingRes.json()).sessions ?? []);
      // The plans are extra: the log still works if they don't load.
      if (plansRes.ok) {
        const data = await plansRes.json();
        setPlans(data.plans ?? []);
        setDrills(data.drills ?? []);
      }
      setAuthed(true);
    } catch {
      setError("Could not load the training log. Please try again.");
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

  async function patch(session: TrainingSession, body: Record<string, unknown>) {
    const id = `${session.team}:${session.date}`;
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/stats/training?key=${encodeURIComponent(key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team: session.team, date: session.date, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "That didn't save");
      setSessions((prev) =>
        prev.map((s) =>
          s.team === session.team && s.date === session.date ? data.session : s
        )
      );
      if (data.players) setPlayers(data.players);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save");
    } finally {
      setBusy(null);
    }
  }

  if (!authed) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-green-700 to-green-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="text-3xl mb-2">🏃</div>
            <h1 className="text-xl font-extrabold text-gray-900">Training Log</h1>
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
            {loading ? "Loading…" : "Open Training Log"}
          </button>
          <Link
            href="/admin/stats"
            className="mt-4 block text-center text-sm font-medium text-gray-500 hover:text-green-700"
          >
            ← Back to Stats
          </Link>
        </div>
      </main>
    );
  }

  const squad = players
    .filter((p) => p.team === team)
    .sort((a, b) => a.name.localeCompare(b.name));
  const playerName = (id: string) =>
    players.find((p) => p.id === id)?.name ?? "Removed player";

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now.getDate()).padStart(2, "0")}`;

  const shown = sessions.filter((s) => s.team === team);
  // Today's session counts as done, so the award can go in straight after.
  const done = shown
    .filter((s) => s.date <= todayStr)
    .sort((a, b) => b.date.localeCompare(a.date));
  const ahead = shown
    .filter((s) => s.date > todayStr)
    .sort((a, b) => a.date.localeCompare(b.date));
  const next = ahead.find((s) => !s.cancelled);
  const unawarded = done.filter((s) => !s.cancelled && !s.bestTrainerId).length;

  // The team's plan, pinned to its Mondays (see lib/trainingPlanTypes.ts).
  const plan = plans.find((p) => p.team === team);
  const planWeeks = plan ? scheduleWeeks(plan, shown) : new Map<string, number>();
  const drillById = new Map(drills.map((d) => [d.id, d]));
  // Today's session if it's on, otherwise the next one.
  const today = done[0]?.date === todayStr && !done[0].cancelled ? done[0] : undefined;
  const focus = today ?? next;
  const focusWeek = focus ? planWeeks.get(focus.date) : undefined;

  function weekLabel(s: TrainingSession) {
    const i = planWeeks.get(s.date);
    if (i === undefined || !plan) return null;
    const week = plan.weeks[i];
    const total = week.drillIds.filter((id) => drillById.has(id)).length;
    const done = week.doneIds.filter((id) => drillById.has(id)).length;
    return (
      <span className="ml-2 text-xs font-medium text-green-700">
        📝 Week {i + 1}
        {week.theme ? ` · ${week.theme}` : ""}
        {total > 0 && done === total ? " ✓" : ""}
      </span>
    );
  }

  const leaders = squad
    .filter((p) => (p.bestTrainer ?? 0) > 0)
    .sort((a, b) => b.bestTrainer - a.bestTrainer || a.name.localeCompare(b.name))
    .slice(0, 5);

  function cancelButton(s: TrainingSession) {
    const id = `${s.team}:${s.date}`;
    return (
      <button
        onClick={() => {
          if (
            !s.cancelled &&
            s.bestTrainerId &&
            !confirm(
              `Mark ${formatDate(s.date)} as no training?\n\n` +
                `${playerName(s.bestTrainerId)}'s best trainer award will be taken back.`
            )
          ) {
            return;
          }
          patch(s, { action: "set-cancelled", cancelled: !s.cancelled });
        }}
        disabled={busy === id}
        className={`shrink-0 cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold disabled:opacity-40 ${
          s.cancelled
            ? "border-gray-300 bg-gray-100 text-gray-600 hover:border-green-400 hover:text-green-700"
            : "border-gray-200 bg-white text-gray-500 hover:border-red-300 hover:text-red-600"
        }`}
        title={s.cancelled ? "Training is back on" : "Training called off this week"}
      >
        {s.cancelled ? "Back On" : "No Training"}
      </button>
    );
  }

  // One past session: its date, plan week, no-training toggle and best trainer.
  function sessionCard(s: TrainingSession) {
    const id = `${s.team}:${s.date}`;
    return (
      <div
        key={id}
        className={`rounded-2xl border p-3 shadow-sm ${
          s.cancelled ? "border-gray-100 bg-gray-50" : "border-gray-100 bg-white"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm">
            <span
              className={`font-bold ${
                s.cancelled ? "text-gray-400 line-through" : "text-gray-900"
              }`}
            >
              {formatDate(s.date)}
            </span>
            {s.cancelled && (
              <span className="ml-2 text-xs text-gray-400">No Training</span>
            )}
            {weekLabel(s)}
          </span>
          {cancelButton(s)}
        </div>
        {!s.cancelled && (
          <label className="mt-2 flex items-center gap-2">
            <span className="shrink-0 text-xs font-medium text-gray-500">
              💪 Best Trainer
            </span>
            <select
              value={s.bestTrainerId}
              onChange={(e) =>
                patch(s, { action: "set-best-trainer", playerId: e.target.value })
              }
              disabled={busy === id}
              aria-label={`Best trainer on ${formatDate(s.date)}`}
              className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              <option value="">— Not Awarded —</option>
              {/* someone since removed from the squad still shows */}
              {s.bestTrainerId && !squad.some((p) => p.id === s.bestTrainerId) && (
                <option value={s.bestTrainerId}>{playerName(s.bestTrainerId)}</option>
              )}
              {squad.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-green-700 px-4 py-6 text-white">
        <Link
          href={`/admin/stats?key=${encodeURIComponent(key)}`}
          className="text-sm font-medium text-green-200 hover:text-white"
        >
          ← Stats Tracker
        </Link>
        <h1 className="text-xl font-extrabold mt-2">🏃 Training Log</h1>
        <p className="text-green-200 text-sm mt-0.5">
          Every Monday&apos;s session — pick the best trainer and season totals update
          automatically
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Team tabs */}
        <div className="flex gap-2 mb-5">
          {TEAMS.map((t) => (
            <button
              key={t.slug}
              onClick={() => setTeam(t.slug)}
              className={`flex-1 py-2 px-2 rounded-xl text-sm font-bold border-2 transition-all cursor-pointer ${
                team === t.slug
                  ? "bg-green-600 border-green-600 text-white shadow"
                  : "bg-white border-gray-200 text-gray-700 hover:border-green-400 hover:text-green-700"
              }`}
            >
              {t.accent} {t.name}
            </button>
          ))}
        </div>

        {error && (
          <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {/* Where the team stands */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
          <p className="text-sm font-semibold text-gray-600">
            💪 {teamName(team)} Best Trainer
          </p>
          {leaders.length === 0 ? (
            <p className="mt-2 text-xs text-gray-400">
              No awards yet — pick a best trainer against a session below and the
              leaders show here.
            </p>
          ) : (
            <ol className="mt-2 flex flex-col gap-1">
              {leaders.map((p, i) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-900">
                    <span className="mr-2 text-xs font-bold text-gray-400">{i + 1}</span>
                    {p.name}
                  </span>
                  <span className="font-extrabold text-green-700 tabular-nums">
                    {p.bestTrainer}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-xs text-gray-500">
            {next ? (
              <>
                Next Session:{" "}
                <span className="font-semibold text-gray-700">{formatDate(next.date)}</span>
              </>
            ) : (
              "No more sessions scheduled this season."
            )}
          </p>
          {unawarded > 0 && (
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {unawarded} session{unawarded === 1 ? " has" : "s have"} no best trainer
              yet — pick one, or mark it as no training.
            </p>
          )}
        </div>

        {focus && plan && focusWeek !== undefined ? (
          <PlanWeekCard
            key={`${team}:${focus.date}`}
            label={`${today ? "Today" : "Next Session"} · ${formatDate(focus.date)}`}
            week={plan.weeks[focusWeek]}
            weekNumber={focusWeek + 1}
            drills={drillById}
            adminKey={key}
            team={team}
            onPlan={(saved) =>
              setPlans((prev) => prev.map((p) => (p.team === saved.team ? saved : p)))
            }
          />
        ) : (
          <p className="mb-4 text-xs text-gray-500">
            {plan?.startDate
              ? `${teamName(team)}'s training plan has no week for the next session.`
              : `${teamName(team)} has no training plan scheduled.`}{" "}
            <Link
              href={`/admin/training/plans?key=${encodeURIComponent(key)}`}
              className="font-semibold text-green-700 hover:underline"
            >
              Training Plans →
            </Link>
          </p>
        )}

        {squad.length === 0 && (
          <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            No players in {teamName(team)} yet — add the squad on the{" "}
            <Link
              href={`/admin/stats?key=${encodeURIComponent(key)}`}
              className="font-semibold underline"
            >
              Stats Tracker
            </Link>{" "}
            first.
          </p>
        )}

        {/* Sessions so far, most recent first */}
        {done.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
              Sessions so far
            </h2>
            <div className="flex flex-col gap-3">
              {byMonth(done).map((group, gi) => {
                // the latest month opens by itself; older ones fold up
                const isOpen = monthToggles[group.month] ?? gi === 0;
                const needs = group.sessions.filter((s) => !s.cancelled && !s.bestTrainerId).length;
                return (
                  <div key={group.month}>
                    <button
                      onClick={() =>
                        setMonthToggles((t) => ({ ...t, [group.month]: !isOpen }))
                      }
                      aria-expanded={isOpen}
                      className="mb-1 flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-1 py-1 text-left hover:text-green-700"
                    >
                      <span className="text-sm font-bold text-gray-700">{group.month}</span>
                      <span className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500">
                          {group.sessions.length} session{group.sessions.length === 1 ? "" : "s"}
                        </span>
                        {needs > 0 && (
                          <span className="font-semibold text-amber-700">{needs} to award</span>
                        )}
                        <span className="text-gray-400">{isOpen ? "▲" : "▼"}</span>
                      </span>
                    </button>
                    {isOpen && (
                      <div className="flex flex-col gap-2">
                        {group.sessions.map((s) => sessionCard(s))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* The rest of the season */}
        {ahead.length > 0 && (
          <section>
            <button
              onClick={() => setShowAhead((v) => !v)}
              className="mb-2 flex w-full cursor-pointer items-center justify-between text-xs font-semibold uppercase tracking-widest text-gray-500 hover:text-green-700"
              aria-expanded={showAhead}
            >
              <span>
                Coming up · {ahead.length} session{ahead.length === 1 ? "" : "s"}
              </span>
              <span>{showAhead ? "Hide ▲" : "Show ▼"}</span>
            </button>
            {showAhead && (
              <div className="flex flex-col gap-4">
                {byMonth(ahead).map((group) => (
                  <div key={group.month}>
                    <p className="mb-1 text-sm font-bold text-gray-700">{group.month}</p>
                    <div className="flex flex-col divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white shadow-sm">
                      {group.sessions.map((s) => (
                        <div
                          key={s.date}
                          className="flex items-center justify-between gap-2 px-3 py-2"
                        >
                          <span
                            className={`text-sm ${
                              s.cancelled ? "text-gray-400 line-through" : "text-gray-900"
                            }`}
                          >
                            {formatDate(s.date)}
                            {weekLabel(s)}
                          </span>
                          {cancelButton(s)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
