"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { useTeams } from "./ClubProvider";
import type { TeamSlug } from "@/lib/teams";
import { useMyTeam } from "@/lib/myTeam";
import {
  DRILL_KINDS,
  DRILL_TOPICS,
  topicName,
  scheduleWeeks,
  type Drill,
  type DrillKind,
  type DrillTopic,
  type TrainingPlan,
} from "@/lib/trainingPlanTypes";
import { DrillDetails, KindBadge } from "./DrillDetails";
import { accountKey, keyQuery } from "./coachKey";

type View = "plan" | "library";

interface Session {
  team: string;
  date: string;
  cancelled: boolean;
}

function formatDate(date: string) {
  const d = new Date(`${date}T00:00`);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

// What the drill form edits: the lists are typed one item per line.
interface DrillDraft {
  id: string;
  title: string;
  kind: DrillKind;
  topic: DrillTopic | "";
  ageGroup: string;
  minutes: string;
  players: string;
  equipment: string;
  setup: string;
  howItWorks: string;
  coachingPoints: string;
  progressions: string;
  videoUrl: string;
}

const BLANK_DRILL: DrillDraft = {
  id: "",
  title: "",
  kind: "technical",
  topic: "",
  ageGroup: "",
  minutes: "",
  players: "",
  equipment: "",
  setup: "",
  howItWorks: "",
  coachingPoints: "",
  progressions: "",
  videoUrl: "",
};

function toDraft(d: Drill): DrillDraft {
  return {
    ...d,
    minutes: d.minutes ? String(d.minutes) : "",
    coachingPoints: d.coachingPoints.join("\n"),
    progressions: d.progressions.join("\n"),
  };
}

/** "Lions" → "Lions'", "Under 10s" → "Under 10s'", "Rovers" → "Rovers'"; otherwise "Name's". */
function possessive(name: string) {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

function newId() {
  return crypto.randomUUID();
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400";

function iconButton(label: string, onClick: () => void, disabled = false, title?: string) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:border-green-400 hover:text-green-700 disabled:cursor-default disabled:opacity-30"
    >
      {label}
    </button>
  );
}

/**
 * Drills grouped by topic for a week's "Add a drill" list — the topic matching
 * the week's theme first (a "Passing" week opens on the passing drills), then
 * the rest, with untopiced drills last.
 */
function topicGroups(drills: Drill[], theme: string) {
  const wanted = theme.trim().toLowerCase();
  const groups = [...DRILL_TOPICS, { slug: "", name: "No topic" }]
    .map((t) => ({ ...t, drills: drills.filter((d) => d.topic === t.slug) }))
    .filter((g) => g.drills.length > 0);
  const first = groups.findIndex((g) => g.slug && wanted.includes(g.slug));
  return first > 0 ? [groups[first], ...groups.filter((_, i) => i !== first)] : groups;
}

function move<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function TrainingPlans() {
  const { TEAMS, teamName } = useTeams();
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  // opens on the team last picked on this device (see lib/myTeam.ts)
  const [team, setTeam] = useMyTeam();
  const [view, setView] = useState<View>("plan");
  // The plan being edited for the chosen team, saved with one button.
  const [draft, setDraft] = useState<TrainingPlan | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  // "week:drill" or a drill id — whichever row is opened up to read
  const [open, setOpen] = useState<string | null>(null);
  const [drillForm, setDrillForm] = useState<DrillDraft | null>(null);
  const [kindFilter, setKindFilter] = useState<DrillKind | "">("");
  const [topicFilter, setTopicFilter] = useState<DrillTopic | "">("");
  const [search, setSearch] = useState("");
  // Weeks opened or closed by hand; the rest follow the default (see weekOpen).
  const [weekToggles, setWeekToggles] = useState<Record<string, boolean>>({});
  const [ticking, setTicking] = useState<string | null>(null);
  // Only the owner changes plans: their password, once checked, unlocks editing.
  const [ownerKey, setOwnerKey] = useState("");
  const [ownerKeySet, setOwnerKeySet] = useState(true);
  // no owner password in play: the club's coaches edit the drills themselves
  const [coachesEditDrills, setCoachesEditDrills] = useState(false);
  // the drill pack's season plan (if any), to fill a team's plan from in one go
  const [seasonPlan, setSeasonPlan] = useState<{ topic: DrillTopic; drillIds: string[] }[]>([]);
  const [seasonPlanTitle, setSeasonPlanTitle] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [ownerInput, setOwnerInput] = useState("");
  // Every team's Mondays from the training log, to pin a plan's weeks to dates.
  const [sessions, setSessions] = useState<Session[]>([]);

  const load = useCallback(async (adminKey: string) => {
    setLoading(true);
    setError(null);
    try {
      const [res, trainingRes] = await Promise.all([
        fetch(`/api/training/plans?key=${encodeURIComponent(adminKey)}`),
        fetch(`/api/stats/training?key=${encodeURIComponent(adminKey)}`),
      ]);
      if (res.status === 401 || trainingRes.status === 401) {
        setError("Incorrect password");
        setAuthed(false);
        return;
      }
      if (!res.ok || !trainingRes.ok) throw new Error("Failed to load");
      const data = await res.json();
      setDrills(data.drills ?? []);
      setPlans(data.plans ?? []);
      setOwnerKeySet(data.ownerKeySet ?? false);
      setCoachesEditDrills(data.coachesEditDrills ?? false);
      setSeasonPlan(data.seasonPlan ?? []);
      setSeasonPlanTitle(data.seasonPlanTitle ?? "");
      setSessions((await trainingRes.json()).sessions ?? []);
      setAuthed(true);
    } catch {
      setError("Could not load the training plans. Please try again.");
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
    } else {
      // signed in with an account: no password needed
      accountKey().then((k) => {
        if (k) {
          setKey(k);
          load(k);
        }
      });
    }
  }, [load]);

  // A fresh copy of the team's saved plan whenever the team (or what's saved)
  // changes and there's nothing unsaved to keep.
  useEffect(() => {
    if (dirty) return;
    const saved = plans.find((p) => p.team === team);
    setDraft(saved ? structuredClone(saved) : null);
  }, [plans, team, dirty]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function post(body: Record<string, unknown>) {
    const res = await fetch(`/api/training/plans?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, ownerKey }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "That didn't save");
    return data;
  }

  async function unlock() {
    if (!ownerInput) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/training/plans?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check-owner", ownerKey: ownerInput }),
      });
      if (!res.ok) throw new Error("That isn't the owner password");
      setOwnerKey(ownerInput);
      setUnlocking(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That isn't the owner password");
    } finally {
      setOwnerInput("");
      setSaving(false);
    }
  }

  // Replace the team's weeks with the season plan's — unsaved until Save plan.
  function applySeasonPlan() {
    if (!draft) return;
    if (
      draft.weeks.length > 0 &&
      !confirm(
        `Replace ${possessive(teamName(team))} ${draft.weeks.length} week${draft.weeks.length === 1 ? "" : "s"} with the ${seasonPlan.length}-week season plan?`
      )
    ) {
      return;
    }
    const known = new Set(drills.map((d) => d.id));
    editPlan((p) => ({
      ...p,
      title: p.title || seasonPlanTitle,
      weeks: seasonPlan.map((w) => ({
        id: newId(),
        theme: topicName(w.topic),
        drillIds: w.drillIds.filter((id) => known.has(id)),
        doneIds: [],
      })),
    }));
  }

  // Tick a drill off as done in a week: saved at once, not with Save plan.
  async function tick(weekId: string, drillId: string, done: boolean) {
    setTicking(`${weekId}:${drillId}`);
    setError(null);
    try {
      const res = await fetch(`/api/training/plans?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "tick-drill", team, weekId, drillId, done }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "That didn't save");
      const saved: TrainingPlan = data.plan;
      setPlans((prev) => prev.map((p) => (p.team === team ? saved : p)));
      // keep unsaved edits, just bring the ticks across
      const ticks = new Map(saved.weeks.map((w) => [w.id, w.doneIds]));
      setDraft((prev) =>
        prev
          ? {
              ...prev,
              weeks: prev.weeks.map((w) => ({ ...w, doneIds: ticks.get(w.id) ?? w.doneIds })),
            }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save");
    } finally {
      setTicking(null);
    }
  }

  function editPlan(change: (plan: TrainingPlan) => TrainingPlan) {
    setDraft((prev) => (prev ? change(prev) : prev));
    setDirty(true);
  }

  async function savePlan() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const data = await post({ action: "save-plan", team, plan: draft });
      setPlans((prev) => prev.map((p) => (p.team === team ? data.plan : p)));
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save");
    } finally {
      setSaving(false);
    }
  }

  function discardPlan() {
    if (!confirm("Throw away the changes to this plan?")) return;
    setDirty(false);
  }

  function switchTeam(slug: TeamSlug) {
    if (slug === team) return;
    if (dirty && !confirm(`${teamName(team)}'s plan has unsaved changes. Throw them away?`)) {
      return;
    }
    setDirty(false);
    setOpen(null);
    setTeam(slug);
  }

  async function saveDrill() {
    if (!drillForm) return;
    if (!drillForm.title.trim()) {
      setError("Give the drill a name");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data = await post({
        action: "save-drill",
        drill: { ...drillForm, minutes: Number(drillForm.minutes) || 0 },
      });
      const saved: Drill = data.drill;
      setDrills((prev) =>
        [...prev.filter((d) => d.id !== saved.id), saved].sort((a, b) =>
          a.title.localeCompare(b.title)
        )
      );
      setDrillForm(null);
      setOpen(saved.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDrill(drill: Drill) {
    const uses = usesOf(drill.id);
    const warning =
      uses.length > 0
        ? `\n\nIt will also come out of: ${uses.join(", ")}.`
        : "";
    if (!confirm(`Delete "${drill.title}" from the drill library?${warning}`)) return;
    setSaving(true);
    setError(null);
    try {
      const data = await post({ action: "delete-drill", id: drill.id });
      setDrills((prev) => prev.filter((d) => d.id !== drill.id));
      setPlans(data.plans ?? []);
      // keep any unsaved edits, minus the drill that's gone
      setDraft((prev) =>
        prev
          ? {
              ...prev,
              weeks: prev.weeks.map((w) => ({
                ...w,
                drillIds: w.drillIds.filter((id) => id !== drill.id),
              })),
            }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't delete");
    } finally {
      setSaving(false);
    }
  }

  /** Where a drill is used, as "Lions week 2" — from the saved plans. */
  function usesOf(drillId: string): string[] {
    const uses: string[] = [];
    for (const plan of plans) {
      plan.weeks.forEach((w, i) => {
        if (w.drillIds.includes(drillId)) uses.push(`${teamName(plan.team)} week ${i + 1}`);
      });
    }
    return uses;
  }

  if (!authed) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-green-700 to-green-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="text-3xl mb-2">📝</div>
            <h1 className="text-xl font-extrabold text-gray-900">Training Plans</h1>
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
            {loading ? "Loading…" : "Open training plans"}
          </button>
          <Link
            href="/admin"
            className="mt-4 block text-center text-sm font-medium text-gray-500 hover:text-green-700"
          >
            ← Back to Coach Admin
          </Link>
        </div>
      </main>
    );
  }

  // plans are every coach's to edit; so is the drill library, unless an owner password guards it
  const canEdit = coachesEditDrills || !!ownerKey;
  const drillById = new Map(drills.map((d) => [d.id, d]));
  const matchesSearch = (d: Drill) =>
    !search.trim() || d.title.toLowerCase().includes(search.trim().toLowerCase());
  const shownDrills = drills.filter(
    (d) =>
      (!kindFilter || d.kind === kindFilter) &&
      (!topicFilter || d.topic === topicFilter) &&
      matchesSearch(d)
  );
  // How many drills each chip would show, given the other filters and the search.
  const kindCount = (kind: string) =>
    drills.filter(
      (d) => (!kind || d.kind === kind) && (!topicFilter || d.topic === topicFilter) && matchesSearch(d)
    ).length;
  const topicCount = (topic: string) =>
    drills.filter(
      (d) => (!topic || d.topic === topic) && (!kindFilter || d.kind === kindFilter) && matchesSearch(d)
    ).length;

  function planView() {
    if (!draft) return null;
    const mondays = sessions
      .filter((s) => s.team === team)
      .sort((a, b) => a.date.localeCompare(b.date));
    const weekDates = new Map<number, string>();
    for (const [date, week] of scheduleWeeks(draft, mondays)) weekDates.set(week, date);
    const unplaced = draft.startDate ? draft.weeks.length - weekDates.size : 0;
    // A long plan opens folded up, apart from the week coming up next (or, with
    // no dates, the first week not yet ticked off) — tap a week to open it.
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const savedPlan = plans.find((p) => p.team === team);
    const doneCount = (w: TrainingPlan["weeks"][number]) =>
      w.doneIds.filter((id) => w.drillIds.includes(id) && drillById.has(id)).length;
    const drillCount = (w: TrainingPlan["weeks"][number]) =>
      w.drillIds.filter((id) => drillById.has(id)).length;
    const currentIdx = draft.startDate
      ? draft.weeks.findIndex((_, i) => (weekDates.get(i) ?? "") >= today)
      : draft.weeks.findIndex((w) => drillCount(w) === 0 || doneCount(w) < drillCount(w));
    const weekOpen = (w: TrainingPlan["weeks"][number], i: number) =>
      weekToggles[w.id] ??
      (draft.weeks.length <= 3 ||
        i === currentIdx ||
        // a week just added, still to be filled in
        (drillCount(w) === 0 && !savedPlan?.weeks.some((sw) => sw.id === w.id)));
    const allWeeks = (open: boolean) =>
      setWeekToggles(Object.fromEntries(draft.weeks.map((w) => [w.id, open])));
    return (
      <>
        <label className="mb-4 block">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            {teamName(team)} plan
          </span>
          <input
            value={draft.title}
            onChange={(e) => editPlan((p) => ({ ...p, title: e.target.value }))}
            placeholder="Name this plan, e.g. Autumn block"
            maxLength={120}
            className={`${inputClass} mt-1`}
          />
        </label>

        <label className="mb-4 block">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Week 1 is on
          </span>
          <select
            value={draft.startDate}
            onChange={(e) => editPlan((p) => ({ ...p, startDate: e.target.value }))}
            className={`${inputClass} mt-1`}
          >
            <option value="">Not scheduled yet</option>
            {/* a start date the schedule no longer covers still shows */}
            {draft.startDate && !mondays.some((s) => s.date === draft.startDate) && (
              <option value={draft.startDate}>{formatDate(draft.startDate)}</option>
            )}
            {mondays.map((s) => (
              <option key={s.date} value={s.date}>
                {formatDate(s.date)}
                {s.cancelled ? " — no training" : ""}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] text-gray-400">
            Each week goes on the next Monday, and shows in the Training Log. A Monday
            marked as no training is skipped, so the plan moves back a week.
          </span>
        </label>

        {unplaced > 0 && (
          <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {unplaced === 1 ? "The last week doesn't" : `The last ${unplaced} weeks don't`} fit
            before training ends for the season — start the plan earlier, or take some weeks
            out.
          </p>
        )}

        {drills.length === 0 && (
          <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            The drill library is empty — add some drills in the{" "}
            <button
              onClick={() => setView("library")}
              className="cursor-pointer font-semibold underline"
            >
              drill library
            </button>{" "}
            first, then pick them for each week here.
          </p>
        )}

        {draft.weeks.length === 0 && (
          <p className="mb-4 rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-500">
            No weeks yet. Add a week, pick its topic, then its warm-up, technical and game
            {seasonPlan.length > 0 ? ` — or start from the ${seasonPlan.length}-week season plan` : ""}.
          </p>
        )}

        {seasonPlan.length > 0 && (
          <button
            onClick={applySeasonPlan}
            className="mb-4 w-full cursor-pointer rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-left text-sm hover:border-green-400"
          >
            <span className="font-bold text-green-800">📋 Use the {seasonPlan.length}-Week Season Plan</span>
            <span className="mt-0.5 block text-xs text-green-700">
              Fills {possessive(teamName(team))} weeks with the
              {seasonPlanTitle ? ` ${seasonPlanTitle}` : " season plan"}&apos;s topics and drills, in
              order. You can change any week afterwards.
            </span>
          </button>
        )}

        {draft.weeks.length > 3 && (
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-gray-500">
              {draft.weeks.filter((w) => drillCount(w) > 0 && doneCount(w) === drillCount(w)).length} of{" "}
              {draft.weeks.length} weeks done
            </span>
            <span className="flex gap-3">
              <button onClick={() => allWeeks(true)} className="cursor-pointer font-semibold text-gray-600 hover:text-green-700">
                Open All
              </button>
              <button onClick={() => allWeeks(false)} className="cursor-pointer font-semibold text-gray-600 hover:text-green-700">
                Close All
              </button>
            </span>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {draft.weeks.map((week, wi) => {
            const weekDrills = week.drillIds
              .map((id) => drillById.get(id))
              .filter((d): d is Drill => !!d);
            const minutes = weekDrills.reduce((sum, d) => sum + d.minutes, 0);
            // Every week runs warm-up, technical, game — one drill in each slot.
            const inSlot = (kind: DrillKind) => weekDrills.find((d) => d.kind === kind);
            const setWeek = (change: (w: typeof week) => typeof week) =>
              editPlan((p) => ({
                ...p,
                weeks: p.weeks.map((w) => (w.id === week.id ? change(w) : w)),
              }));
            const setSlot = (kind: DrillKind, drillId: string) =>
              setWeek((w) => ({
                ...w,
                drillIds: DRILL_KINDS.map((k) =>
                  k.slug === kind ? drillId : inSlot(k.slug)?.id ?? ""
                ).filter(Boolean),
              }));
            // The week's topic, once one is picked, narrows each slot to its drills.
            const weekTopic = DRILL_TOPICS.find((t) => t.name === week.theme);
            const knownTheme = !!weekTopic;
            const isWeekOpen = weekOpen(week, wi);
            const done = doneCount(week);
            const total = drillCount(week);
            const allDone = total > 0 && done === total;
            const toggleWeek = () => setWeekToggles((t) => ({ ...t, [week.id]: !isWeekOpen }));
            const saved = savedPlan?.weeks.find((w) => w.id === week.id);
            if (!isWeekOpen) {
              return (
                <button
                  key={week.id}
                  onClick={toggleWeek}
                  aria-expanded={false}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-2xl border px-4 py-3 text-left shadow-sm ${
                    allDone ? "border-green-200 bg-green-50" : "border-gray-100 bg-white"
                  }`}
                >
                  <span className="shrink-0 text-sm font-extrabold text-green-700">Week {wi + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
                    {week.theme || "No topic yet"}
                    {draft.startDate && weekDates.has(wi) && (
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        {formatDate(weekDates.get(wi)!)}
                      </span>
                    )}
                  </span>
                  {total > 0 && (
                    <span
                      className={`shrink-0 text-xs font-bold ${allDone ? "text-green-700" : "text-gray-400"}`}
                    >
                      {allDone ? "✓ Done" : `${done}/${total}`}
                    </span>
                  )}
                  <span className="shrink-0 text-xs text-gray-400">▼</span>
                </button>
              );
            }
            return (
              <section
                key={week.id}
                className={`rounded-2xl border p-4 shadow-sm ${
                  allDone ? "border-green-200 bg-green-50" : "border-gray-100 bg-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleWeek}
                    aria-expanded={true}
                    title="Fold this week up"
                    className="shrink-0 cursor-pointer text-sm font-extrabold text-green-700"
                  >
                    Week {wi + 1} ▲
                  </button>
                  <select
                    value={week.theme}
                    onChange={(e) => setWeek((w) => ({ ...w, theme: e.target.value }))}
                    aria-label={`Week ${wi + 1} theme`}
                    className={`${inputClass} min-w-0 flex-1 font-semibold`}
                  >
                    <option value="">Pick a topic…</option>
                    {/* a theme typed in before the topics existed still shows */}
                    {week.theme && !knownTheme && <option value={week.theme}>{week.theme}</option>}
                    {DRILL_TOPICS.map((t) => (
                      <option key={t.slug} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {iconButton(
                    "↑",
                    () => editPlan((p) => ({ ...p, weeks: move(p.weeks, wi, wi - 1) })),
                    wi === 0,
                    "Move week earlier"
                  )}
                  {iconButton(
                    "↓",
                    () => editPlan((p) => ({ ...p, weeks: move(p.weeks, wi, wi + 1) })),
                    wi === draft.weeks.length - 1,
                    "Move week later"
                  )}
                  {iconButton(
                    "✕",
                    () => {
                      if (
                        week.drillIds.length > 0 &&
                        !confirm(`Remove week ${wi + 1}${week.theme ? ` (${week.theme})` : ""}?`)
                      ) {
                        return;
                      }
                      editPlan((p) => ({ ...p, weeks: p.weeks.filter((w) => w.id !== week.id) }));
                    },
                    false,
                    "Remove week"
                  )}
                </div>
                {draft.startDate && (
                  <p className="mt-1.5 text-xs text-gray-500">
                    📅{" "}
                    {weekDates.has(wi)
                      ? formatDate(weekDates.get(wi)!)
                      : "After the last session of the season"}
                  </p>
                )}

                <ol className="mt-3 flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-100">
                  {DRILL_KINDS.map((k) => {
                    const drill = inSlot(k.slug);
                    const ofKind = drills.filter((d) => d.kind === k.slug);
                    const onTopic = weekTopic
                      ? ofKind.filter((d) => d.topic === weekTopic.slug)
                      : [];
                    const rowId = `${week.id}:${k.slug}`;
                    const isOpen = open === rowId && !!drill;
                    return (
                      <li key={k.slug} className="px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <KindBadge kind={k.slug} />
                          {drill && (() => {
                            const ticked = week.doneIds.includes(drill.id);
                            const tickable = !!saved?.drillIds.includes(drill.id);
                            return (
                              <button
                                onClick={() => tick(week.id, drill.id, !ticked)}
                                disabled={!tickable || ticking === `${week.id}:${drill.id}`}
                                title={tickable ? undefined : "Save the plan first, then tick it off"}
                                aria-pressed={ticked}
                                className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-xs font-bold disabled:cursor-default disabled:opacity-40 ${
                                  ticked
                                    ? "border-green-600 bg-green-600 text-white"
                                    : "border-gray-200 bg-white text-gray-500 hover:border-green-400 hover:text-green-700"
                                }`}
                              >
                                {ticked ? "✓ Done" : "Mark Done"}
                              </button>
                            );
                          })()}
                        </div>
                        {/* the dropdown gets its own line so drill names aren't cut short on a phone */}
                        <div className="mt-1.5 flex items-center gap-2">
                          <select
                            value={drill?.id ?? ""}
                            onChange={(e) => setSlot(k.slug, e.target.value)}
                            aria-label={`Week ${wi + 1} ${k.name.toLowerCase()}`}
                            className={`${inputClass} min-w-0 flex-1`}
                          >
                            <option value="">
                              {!weekTopic
                                ? ofKind.length > 0
                                  ? `Pick a ${k.name.toLowerCase()}…`
                                  : "None in the library yet"
                                : onTopic.length > 0
                                  ? `Pick a ${k.name.toLowerCase()}…`
                                  : `No ${weekTopic.name.toLowerCase()} ${k.name.toLowerCase()}s yet`}
                            </option>
                            {weekTopic ? (
                              <>
                                {onTopic.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.title}
                                  </option>
                                ))}
                                {/* a drill picked before the topic changed still shows */}
                                {drill && drill.topic !== weekTopic.slug && (
                                  <option value={drill.id}>{drill.title} (not {weekTopic.name})</option>
                                )}
                              </>
                            ) : (
                              topicGroups(ofKind, week.theme).map((g) => (
                                <optgroup key={g.slug} label={g.name}>
                                  {g.drills.map((d) => (
                                    <option key={d.id} value={d.id}>
                                      {d.title}
                                    </option>
                                  ))}
                                </optgroup>
                              ))
                            )}
                          </select>
                          {drill &&
                            iconButton(
                              isOpen ? "▲" : "▼",
                              () => setOpen(isOpen ? null : rowId),
                              false,
                              isOpen ? "Hide the drill" : "Show the drill"
                            )}
                        </div>
                        {isOpen && drill && (
                          <div className="mt-3 border-t border-gray-100 pt-3">
                            <DrillDetails drill={drill} adminKey={key} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>

                {minutes > 0 && (
                  <p className="mt-2 text-right text-xs font-semibold text-gray-500">
                    ⏱ {minutes} min
                  </p>
                )}
              </section>
            );
          })}
        </div>

        <button
          onClick={() =>
            editPlan((p) => ({
              ...p,
              weeks: [...p.weeks, { id: newId(), theme: "", drillIds: [], doneIds: [] }],
            }))
          }
          className="mt-4 w-full cursor-pointer rounded-2xl border-2 border-dashed border-gray-300 py-3 text-sm font-bold text-gray-600 hover:border-green-400 hover:text-green-700"
        >
          + Add Week
        </button>
      </>
    );
  }

  function drillFormView(form: DrillDraft) {
    const set = (field: keyof DrillDraft) => (
      e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => setDrillForm({ ...form, [field]: e.target.value });
    const field = (label: string, input: ReactNode, hint?: string) => (
      <label className="block">
        <span className="text-xs font-semibold text-gray-600">{label}</span>
        <div className="mt-1">{input}</div>
        {hint && <span className="mt-0.5 block text-[11px] text-gray-400">{hint}</span>}
      </label>
    );
    return (
      <section className="rounded-2xl border border-green-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-extrabold text-gray-900">
          {form.id ? "Edit drill" : "New drill"}
        </h2>
        <div className="flex flex-col gap-3">
          {field(
            "Name",
            <input value={form.title} onChange={set("title")} maxLength={120} className={inputClass} />
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {field(
              "Topic",
              <select value={form.topic} onChange={set("topic")} className={inputClass}>
                <option value="">—</option>
                {DRILL_TOPICS.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            {field(
              "Type",
              <select value={form.kind} onChange={set("kind")} className={inputClass}>
                {DRILL_KINDS.map((k) => (
                  <option key={k.slug} value={k.slug}>
                    {k.name}
                  </option>
                ))}
              </select>
            )}
            {field(
              "Minutes",
              <input
                value={form.minutes}
                onChange={set("minutes")}
                inputMode="numeric"
                placeholder="15"
                className={inputClass}
              />
            )}
            {field(
              "Players",
              <input
                value={form.players}
                onChange={set("players")}
                placeholder="8–12"
                maxLength={40}
                className={inputClass}
              />
            )}
            {field(
              "Age group",
              <input
                value={form.ageGroup}
                onChange={set("ageGroup")}
                placeholder="U9–U11"
                maxLength={40}
                className={inputClass}
              />
            )}
          </div>
          {field(
            "Equipment",
            <input
              value={form.equipment}
              onChange={set("equipment")}
              placeholder="Cones, bibs in two colours, 6 balls"
              maxLength={500}
              className={inputClass}
            />
          )}
          {field(
            "Setup",
            <textarea
              value={form.setup}
              onChange={set("setup")}
              rows={3}
              placeholder="Area size, where the cones and players go"
              className={inputClass}
            />
          )}
          {field(
            "How it works",
            <textarea value={form.howItWorks} onChange={set("howItWorks")} rows={4} className={inputClass} />
          )}
          {field(
            "Coaching points",
            <textarea
              value={form.coachingPoints}
              onChange={set("coachingPoints")}
              rows={3}
              className={inputClass}
            />,
            "One per line"
          )}
          {field(
            "Progressions",
            <textarea
              value={form.progressions}
              onChange={set("progressions")}
              rows={3}
              className={inputClass}
            />,
            "One per line — ways to make it harder or easier"
          )}
          {field(
            "Video link",
            <input
              value={form.videoUrl}
              onChange={set("videoUrl")}
              type="url"
              placeholder="https://www.youtube.com/watch?v=…"
              className={inputClass}
            />,
            "Optional — a clip you've filmed, or a public video"
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setDrillForm(null)}
            className="cursor-pointer rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:border-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={saveDrill}
            disabled={saving || !form.title.trim()}
            className="cursor-pointer rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save drill"}
          </button>
        </div>
      </section>
    );
  }

  function libraryView() {
    if (drillForm && canEdit) return drillFormView(drillForm);
    return (
      <>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search drills"
            aria-label="Search drills"
            className={`${inputClass} min-w-0 flex-1`}
          />
          {canEdit && (
            <button
              onClick={() => setDrillForm({ ...BLANK_DRILL })}
              className="shrink-0 cursor-pointer rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700"
            >
              + New drill
            </button>
          )}
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {[{ slug: "" as const, name: "All types" }, ...DRILL_KINDS].map((k) => (
            <button
              key={k.slug}
              onClick={() => setKindFilter(k.slug)}
              className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold ${
                kindFilter === k.slug
                  ? "border-green-600 bg-green-600 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-green-400"
              }`}
            >
              {k.name} <span className="opacity-70">{kindCount(k.slug)}</span>
            </button>
          ))}
        </div>

        <div className="-mt-2 mb-4 flex flex-wrap gap-2">
          {[{ slug: "" as const, name: "All topics" }, ...DRILL_TOPICS].map((t) => (
            <button
              key={t.slug}
              onClick={() => setTopicFilter(t.slug)}
              className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold ${
                topicFilter === t.slug
                  ? "border-green-700 bg-green-700 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-green-400"
              }`}
            >
              {t.name} <span className="opacity-70">{topicCount(t.slug)}</span>
            </button>
          ))}
        </div>

        {drills.length > 0 && (
          <p className="mb-2 text-xs font-semibold text-gray-500">
            {shownDrills.length === drills.length
              ? `All ${drills.length} drills`
              : `Showing ${shownDrills.length} of ${drills.length} drills`}
          </p>
        )}

        {drills.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-500">
            No drills yet. Every team&apos;s plan picks from this one library, so a drill
            only has to be written once.
          </p>
        ) : shownDrills.length === 0 ? (
          <p className="text-center text-sm text-gray-500">No drills match.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {shownDrills.map((drill) => {
              const isOpen = open === drill.id;
              const uses = usesOf(drill.id);
              return (
                <div
                  key={drill.id}
                  className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm"
                >
                  <button
                    onClick={() => setOpen(isOpen ? null : drill.id)}
                    aria-expanded={isOpen}
                    className="flex w-full cursor-pointer items-center gap-2 text-left"
                  >
                    <KindBadge kind={drill.kind} />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-900">
                      {drill.title}
                    </span>
                    {drill.topic && (
                      <span className="shrink-0 text-xs text-gray-400">
                        {topicName(drill.topic)}
                      </span>
                    )}
                    {drill.minutes > 0 && (
                      <span className="shrink-0 text-xs text-gray-400">{drill.minutes}′</span>
                    )}
                    <span className="shrink-0 text-xs text-gray-400">{isOpen ? "▲" : "▼"}</span>
                  </button>
                  {isOpen && (
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      <DrillDetails drill={drill} adminKey={key} />
                      <p className="mt-3 text-xs text-gray-400">
                        {uses.length > 0 ? `Used in ${uses.join(", ")}` : "Not in any plan yet"}
                      </p>
                      {canEdit && (
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => setDrillForm(toDraft(drill))}
                            className="cursor-pointer rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:border-green-400 hover:text-green-700"
                          >
                            ✏️ Edit
                          </button>
                          {!drill.builtIn && (
                            <button
                              onClick={() => deleteDrill(drill)}
                              disabled={saving}
                              className="cursor-pointer rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-500 hover:border-red-300 hover:text-red-600 disabled:opacity-40"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-green-700 px-4 py-6 text-white">
        <Link
          href={`/admin${keyQuery(key)}`}
          className="text-sm font-medium text-green-200 hover:text-white"
        >
          ← Coach Admin
        </Link>
        <h1 className="text-xl font-extrabold mt-2">📝 Training Plans</h1>
        <p className="text-green-200 text-sm mt-0.5">
          Each team&apos;s weeks, themes and drills — picked from one shared drill library
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Plan / library switch */}
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-gray-200 p-1">
          {(
            [
              ["plan", "📅 Team Plans"],
              ["library", `📚 Drill Library (${drills.length})`],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => {
                setView(v);
                setOpen(null);
              }}
              className={`cursor-pointer rounded-lg py-2 text-sm font-bold ${
                view === v ? "bg-white text-green-700 shadow" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Team tabs — plans only; the library is shared */}
        {view === "plan" && (
          <div className="flex gap-2 mb-5">
            {TEAMS.map((t) => (
              <button
                key={t.slug}
                onClick={() => switchTeam(t.slug)}
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
        )}

        {error && (
          <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {/* The library is the owner's: they unlock editing it with their own password */}
        {view === "library" && !coachesEditDrills && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-xs text-gray-500 shadow-sm">
            {canEdit ? (
              <>
                <span className="font-semibold text-green-700">✏️ Editing drills as the owner</span>
                <button
                  onClick={() => {
                    setDrillForm(null);
                    setOwnerKey("");
                  }}
                  className="cursor-pointer font-semibold text-gray-600 hover:text-green-700"
                >
                  Done
                </button>
              </>
            ) : unlocking ? (
              <span className="flex w-full items-center gap-2">
                <input
                  type="password"
                  value={ownerInput}
                  onChange={(e) => setOwnerInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && unlock()}
                  placeholder="Owner password"
                  aria-label="Owner password"
                  autoFocus
                  className={`${inputClass} min-w-0 flex-1`}
                />
                <button
                  onClick={unlock}
                  disabled={saving || !ownerInput}
                  className="shrink-0 cursor-pointer rounded-lg bg-green-600 px-3 py-2 font-bold text-white disabled:opacity-40"
                >
                  Unlock
                </button>
              </span>
            ) : (
              <>
                <span>👀 Drills are set by the owner</span>
                {ownerKeySet && (
                  <button
                    onClick={() => setUnlocking(true)}
                    className="cursor-pointer font-semibold text-gray-600 hover:text-green-700"
                  >
                    🔒 Owner
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {view === "plan" ? planView() : libraryView()}
      </div>

      {/* Unsaved plan changes follow the coach down the page */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <span className="text-sm font-semibold text-amber-700">
              {teamName(team)} plan has unsaved changes
            </span>
            <div className="flex gap-2">
              <button
                onClick={discardPlan}
                disabled={saving}
                className="cursor-pointer rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:border-gray-300 disabled:opacity-40"
              >
                Discard
              </button>
              <button
                onClick={savePlan}
                disabled={saving}
                className="cursor-pointer rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save Plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
