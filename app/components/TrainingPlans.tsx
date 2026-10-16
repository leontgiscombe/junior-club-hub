"use client";

import Link from "next/link";
import { backOr } from "@/lib/back";
import { useCallback, useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { useTeams } from "./ClubProvider";
import type { TeamSlug } from "@/lib/teams";
import { useMyTeam } from "@/lib/myTeam";
import {
  DRILL_KINDS,
  DRILL_TOPICS,
  MAX_DRILL_UPLOADS,
  topicName,
  scheduleWeeks,
  type Drill,
  type DrillKind,
  type DrillTopic,
  type PlanWeek,
  type TrainingPlan,
} from "@/lib/trainingPlanTypes";
import { DrillDetails, KindBadge } from "./DrillDetails";
import { accountKey, keyQuery, rememberCoachKey } from "./coachKey";
import { ToolSkeleton } from "./Skeleton";
import { ToolTabs, TopBar } from "./SettingsUI";
import { useScrollLock } from "./useScrollLock";

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
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:bg-[#1c1c1e] dark:text-gray-50 dark:border-white/15";

// the colour down the side of a drill: warm-up, technical, game
const KIND_STRIPE: Record<DrillKind, string> = {
  "warm-up": "bg-amber-400",
  technical: "bg-sky-500",
  game: "bg-green-600",
};

function smallButton(label: ReactNode, onClick: () => void, disabled = false, danger = false) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`cursor-pointer rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold disabled:cursor-default disabled:opacity-30 dark:bg-white/10 ${
        danger ? "text-red-600 dark:text-red-400" : "text-gray-700 hover:text-green-700 dark:text-gray-200"
      }`}
    >
      {label}
    </button>
  );
}

/** A sheet up from the bottom of the screen (a box in the middle on a wide one). */
function Sheet({ title, badge, onClose, children }: { title: string; badge?: ReactNode; onClose: () => void; children: ReactNode }) {
  useScrollLock();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="themed fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[#f2f2f7] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 text-gray-900 shadow-2xl dark:bg-[#1c1c1e] dark:text-gray-50 sm:rounded-3xl"
      >
        <div className="mb-3 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {badge && <div className="mb-1">{badge}</div>}
            <h2 className="text-[19px] font-bold leading-tight">{title}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full bg-gray-200/80 text-gray-600 dark:bg-white/10 dark:text-gray-300"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// how a slot is named in a sentence: "a warm-up", "a technical drill", "a game"
const SLOT_WORD: Record<DrillKind, [string, string]> = {
  "warm-up": ["warm-up", "warm-ups"],
  technical: ["technical drill", "technical drills"],
  game: ["game", "games"],
};

/**
 * A photo or PDF chosen for a drill, as a data: URL ready to send. A photo is
 * shrunk to a JPEG no more than 1600px a side (and made smaller still if it's
 * over the limit), so even a phone camera's picture uploads quickly.
 */
async function fileForUpload(file: File): Promise<string> {
  const read = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("That file couldn't be read"));
      r.readAsDataURL(blob);
    });
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    if (file.size > 1024 * 1024) throw new Error(`${file.name} is over 1 MB — try a smaller PDF`);
    return (await read(file)).replace(/^data:[^;]*;/, "data:application/pdf;");
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`${file.name} doesn't look like a photo or a PDF`));
      el.src = url;
    });
    for (let max = 1600; ; max = Math.round(max * 0.8)) {
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff"; // a see-through picture gets a white background
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", 0.82);
      if ((data.length * 3) / 4 < 650 * 1024 || max < 500) return data;
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}

type SheetState =
  | { kind: "drill"; drillId: string; weekId?: string }
  | { kind: "pick"; weekId: string; slot: DrillKind }
  | { kind: "topic"; weekId: string }
  | { kind: "plan" }
  | null;

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
  // working out who this is (an account, or a password given earlier) before showing the password box
  const [checking, setChecking] = useState(true);
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
  // the sheet up over the page: a drill, a drill picker, a week's topic, or the plan's details
  const [sheet, setSheet] = useState<SheetState>(null);
  // weeks before the one coming up stay folded away until asked for
  const [showEarlier, setShowEarlier] = useState(false);
  const [drillForm, setDrillForm] = useState<DrillDraft | null>(null);
  // photos and PDFs picked for a drill not saved yet: they go up once it is
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [kindFilter, setKindFilter] = useState<DrillKind | "">("");
  const [topicFilter, setTopicFilter] = useState<DrillTopic | "">("");
  const [search, setSearch] = useState("");
  // Weeks opened or closed by hand; the rest stay folded.
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
  // Every team's training sessions from the training log, to pin a plan's weeks to dates.
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
    // opened from Search: the Drill Library, filtered to what was found
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") === "library") setView("library");
    if (params.get("q")) setSearch(params.get("q")!);
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
      if (!res.ok) {
        throw new Error(
          res.status === 429
            ? ((await res.json().catch(() => null))?.error ?? "Too many wrong passwords — try again later")
            : "That isn't the owner password"
        );
      }
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
    setSheet(null);
    setShowEarlier(false);
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
      let saved: Drill = data.drill;
      for (const file of pendingFiles) {
        try {
          saved = (await post({ action: "add-file", drillId: saved.id, label: file.name, data: await fileForUpload(file) })).drill;
        } catch (err) {
          setError(err instanceof Error ? err.message : `${file.name} didn't upload`);
        }
      }
      setPendingFiles([]);
      putDrill(saved);
      setDrillForm(null);
      setSheet({ kind: "drill", drillId: saved.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save");
    } finally {
      setSaving(false);
    }
  }

  function putDrill(saved: Drill) {
    setDrills((prev) => [...prev.filter((d) => d.id !== saved.id), saved].sort((a, b) => a.title.localeCompare(b.title)));
  }

  /** Adds photos or PDFs to the drill being edited — at once if it's saved, else when it is. */
  async function addFiles(drillId: string, files: File[], room: number) {
    if (files.length > room) setError(`A drill can have ${MAX_DRILL_UPLOADS} photos or PDFs`);
    const chosen = files.slice(0, Math.max(0, room));
    if (!drillId) {
      setPendingFiles((prev) => [...prev, ...chosen]);
      return;
    }
    setUploading(true);
    try {
      for (const file of chosen) {
        putDrill((await post({ action: "add-file", drillId, label: file.name, data: await fileForUpload(file) })).drill);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't upload");
    } finally {
      setUploading(false);
    }
  }

  async function removeFile(drillId: string, fileId: string, label: string) {
    if (!confirm(`Remove ${label} from this drill?`)) return;
    setUploading(true);
    try {
      putDrill((await post({ action: "remove-file", drillId, fileId })).drill);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save");
    } finally {
      setUploading(false);
    }
  }

  /** Deletes a drill (after asking): whether it went. */
  async function deleteDrill(drill: Drill): Promise<boolean> {
    const uses = usesOf(drill.id);
    const warning =
      uses.length > 0
        ? `\n\nIt will also come out of: ${uses.join(", ")}.`
        : "";
    if (!confirm(`Delete "${drill.title}" from the drill library?${warning}`)) return false;
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
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't delete");
      return false;
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
    if (checking) return <ToolSkeleton />;
    return (
      <main className="themed min-h-screen bg-gradient-to-b from-green-700 to-green-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm dark:bg-[#1c1c1e]">
          <div className="text-center mb-6">
            <div className="text-3xl mb-2">📝</div>
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-gray-50">Training Plans</h1>
            <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">Coaches only</p>
          </div>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(key)}
            placeholder="Enter password"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 mb-3 dark:text-gray-50 dark:border-white/15"
          />
          {error && <p className="text-sm text-red-600 mb-3 text-center dark:text-red-400">{error}</p>}
          <button
            onClick={() => load(key)}
            disabled={loading || !key}
            className="w-full py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 disabled:opacity-40 cursor-pointer"
          >
            {loading ? "Loading…" : "Open training plans"}
          </button>
          <Link
            href="/admin" onClick={backOr}
            className="mt-4 block text-center text-sm font-medium text-gray-500 hover:text-green-700 dark:text-gray-400"
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

  // A week's drills, its drill in each slot, and changes to one week of the draft.
  const weekDrillsOf = (w: PlanWeek) =>
    w.drillIds.map((id) => drillById.get(id)).filter((d): d is Drill => !!d);
  const inSlot = (w: PlanWeek, kind: DrillKind) => weekDrillsOf(w).find((d) => d.kind === kind);
  const setWeek = (weekId: string, change: (w: PlanWeek) => PlanWeek) =>
    editPlan((p) => ({ ...p, weeks: p.weeks.map((w) => (w.id === weekId ? change(w) : w)) }));
  // Every week runs warm-up, technical, game — one drill in each slot.
  const setSlot = (weekId: string, kind: DrillKind, drillId: string) =>
    setWeek(weekId, (w) => ({
      ...w,
      drillIds: DRILL_KINDS.map((k) => (k.slug === kind ? drillId : inSlot(w, k.slug)?.id ?? "")).filter(Boolean),
    }));
  const savedPlan = plans.find((p) => p.team === team);
  const doneCount = (w: PlanWeek) => w.doneIds.filter((id) => w.drillIds.includes(id) && drillById.has(id)).length;
  const drillCount = (w: PlanWeek) => w.drillIds.filter((id) => drillById.has(id)).length;
  const sessionsHere = sessions.filter((s) => s.team === team).sort((a, b) => a.date.localeCompare(b.date));

  /** One of a week's drills: tick it off, or tap it to read it (and swap it). */
  function drillRow(week: PlanWeek, kind: DrillKind) {
    const drill = inSlot(week, kind);
    const kindLabel = DRILL_KINDS.find((k) => k.slug === kind)!.name;
    if (!drill) {
      const word = SLOT_WORD[kind][0];
      return (
        <button
          key={kind}
          onClick={() => setSheet({ kind: "pick", weekId: week.id, slot: kind })}
          className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 px-3 py-3 text-left text-sm font-semibold text-gray-500 hover:border-green-400 hover:text-green-700 dark:border-white/15 dark:text-gray-400`}
        >
          <span className={`h-8 w-1 shrink-0 rounded-full ${KIND_STRIPE[kind]} opacity-40`} />
          + Add a {word}
        </button>
      );
    }
    const ticked = week.doneIds.includes(drill.id);
    const tickable = !!savedPlan?.weeks.find((w) => w.id === week.id)?.drillIds.includes(drill.id);
    return (
      <div key={kind} className="flex items-center gap-3 rounded-2xl bg-gray-50 px-3 py-2.5 dark:bg-white/5">
        <span className={`h-9 w-1 shrink-0 rounded-full ${KIND_STRIPE[kind]}`} />
        <button
          onClick={() => setSheet({ kind: "drill", drillId: drill.id, weekId: week.id })}
          className="min-w-0 flex-1 cursor-pointer text-left"
        >
          <span className={`block truncate text-[15px] font-semibold ${ticked ? "text-gray-400 line-through dark:text-gray-500" : "text-gray-900 dark:text-gray-50"}`}>
            {drill.title}
          </span>
          <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
            {[kindLabel, drill.minutes ? `${drill.minutes} min` : ""].filter(Boolean).join(" · ")}
          </span>
        </button>
        <button
          onClick={() => tick(week.id, drill.id, !ticked)}
          disabled={!tickable || ticking === `${week.id}:${drill.id}`}
          title={tickable ? (ticked ? "Done — tap to undo" : "Mark done") : "Save the plan first, then tick it off"}
          aria-label={ticked ? `${drill.title} done` : `Mark ${drill.title} done`}
          aria-pressed={ticked}
          className={`grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full border-2 disabled:cursor-default disabled:opacity-40 ${
            ticked
              ? "border-green-600 bg-green-600 text-white"
              : "border-gray-300 text-transparent hover:border-green-500 dark:border-white/25"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
        </button>
      </div>
    );
  }

  function weekDrills(week: PlanWeek) {
    const minutes = weekDrillsOf(week).reduce((sum, d) => sum + d.minutes, 0);
    return (
      <>
        <div className="flex flex-col gap-2">{DRILL_KINDS.map((k) => drillRow(week, k.slug))}</div>
        {minutes > 0 && (
          <p className="mt-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">{minutes} min in all</p>
        )}
      </>
    );
  }

  function planView() {
    if (!draft) return null;
    const weekDates = new Map<number, string>();
    for (const [date, week] of scheduleWeeks(draft, sessionsHere)) weekDates.set(week, date);
    const unplaced = draft.startDate ? draft.weeks.length - weekDates.size : 0;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    // The week coming up next — or, with no dates, the first week not yet ticked off.
    const currentIdx = draft.startDate
      ? draft.weeks.findIndex((_, i) => (weekDates.get(i) ?? "9999") >= today)
      : draft.weeks.findIndex((w) => drillCount(w) === 0 || doneCount(w) < drillCount(w));
    const weeksDone = draft.weeks.filter((w) => drillCount(w) > 0 && doneCount(w) === drillCount(w)).length;
    const current = currentIdx >= 0 ? draft.weeks[currentIdx] : null;
    const currentDate = currentIdx >= 0 ? weekDates.get(currentIdx) : undefined;
    // Weeks before this one fold away, as in the Training Log.
    const earlier = currentIdx > 0 && !showEarlier ? currentIdx : 0;
    const status = (w: PlanWeek, i: number) => {
      const total = drillCount(w);
      const date = weekDates.get(i);
      if (total > 0 && doneCount(w) === total) return "done";
      if (i === currentIdx) return "current";
      if (date && date < today) return "past";
      return "upcoming";
    };
    return (
      <>
        {/* The plan: its name, when it runs, how far through it the team is */}
        <section className="mb-4 rounded-3xl bg-white p-4 shadow-sm dark:bg-[#1c1c1e]">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[19px] font-bold text-gray-900 dark:text-gray-50">
                {draft.title || `${teamName(team)} Plan`}
              </h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {draft.weeks.length} week{draft.weeks.length === 1 ? "" : "s"}
                {draft.startDate ? ` · from ${formatDate(draft.startDate)}` : " · not on the calendar yet"}
              </p>
            </div>
            <button
              onClick={() => setSheet({ kind: "plan" })}
              className="shrink-0 cursor-pointer rounded-full bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700 hover:text-green-700 dark:bg-white/10 dark:text-gray-200"
            >
              Edit Plan
            </button>
          </div>
          {draft.weeks.length > 0 && (
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-green-600 transition-all"
                  style={{ width: `${Math.round((weeksDone / draft.weeks.length) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                {weeksDone} of {draft.weeks.length} weeks done
              </p>
            </div>
          )}
          {!draft.startDate && draft.weeks.length > 0 && (
            <button
              onClick={() => setSheet({ kind: "plan" })}
              className="mt-3 w-full cursor-pointer rounded-xl bg-green-50 px-3 py-2 text-left text-xs font-semibold text-green-800 dark:bg-green-400/10 dark:text-green-300"
            >
              Pick the session week 1 is on, and each week lands on the team&apos;s training in the Training Log →
            </button>
          )}
        </section>

        {unplaced > 0 && (
          <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
            {unplaced === 1 ? "The last week doesn't" : `The last ${unplaced} weeks don't`} fit before training ends for
            the season — start the plan earlier, or take some weeks out.
          </p>
        )}

        {drills.length === 0 && (
          <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
            The drill library is empty — add some drills in the{" "}
            <button onClick={() => setView("library")} className="cursor-pointer font-semibold underline">
              drill library
            </button>{" "}
            first, then pick them for each week here.
          </p>
        )}

        {/* What's on at the next session */}
        {current && (
          <section className="mb-5 rounded-3xl bg-white p-4 shadow-sm ring-2 ring-green-600/40 dark:bg-[#1c1c1e]">
            <p className="text-[11px] font-bold uppercase tracking-wide text-green-700 dark:text-green-400">
              {currentDate ? (currentDate === today ? "Today" : `Next session · ${formatDate(currentDate)}`) : "Up next"}
            </p>
            <div className="mt-1 mb-3 flex items-baseline justify-between gap-2">
              <h3 className="min-w-0 truncate text-[22px] font-extrabold text-gray-900 dark:text-gray-50">
                {current.theme || "No topic yet"}
              </h3>
              <span className="shrink-0 text-sm font-semibold text-gray-500 dark:text-gray-400">Week {currentIdx + 1}</span>
            </div>
            {weekDrills(current)}
          </section>
        )}

        {draft.weeks.length === 0 ? (
          <div className="mb-4 rounded-3xl bg-white px-4 py-8 text-center shadow-sm dark:bg-[#1c1c1e]">
            <div className="text-3xl">📋</div>
            <p className="mt-2 text-[17px] font-bold text-gray-900 dark:text-gray-50">Plan the season</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-gray-500 dark:text-gray-400">
              Add a week, give it a topic, then pick its warm-up, technical and game.
            </p>
            {seasonPlan.length > 0 && (
              <button
                onClick={applySeasonPlan}
                className="mt-4 cursor-pointer rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700"
              >
                Use the {seasonPlan.length}-Week Season Plan
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Season</h3>
              {currentIdx > 0 && (
                <button
                  onClick={() => setShowEarlier((v) => !v)}
                  className="cursor-pointer text-xs font-semibold text-green-700 dark:text-green-400"
                >
                  {showEarlier ? "Hide earlier weeks" : `Show ${currentIdx} earlier week${currentIdx === 1 ? "" : "s"}`}
                </button>
              )}
            </div>
            <div className="overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-[#1c1c1e]">
              {draft.weeks.map((week, wi) => {
                if (wi < earlier) return null;
                const st = status(week, wi);
                const total = drillCount(week);
                const done = doneCount(week);
                const isOpen =
                  weekToggles[week.id] ??
                  // a week just added, still to be filled in
                  (total === 0 && !savedPlan?.weeks.some((sw) => sw.id === week.id));
                const date = weekDates.get(wi);
                return (
                  <div key={week.id} className="border-b border-gray-100 last:border-b-0 dark:border-white/10">
                    <button
                      onClick={() => setWeekToggles((t) => ({ ...t, [week.id]: !isOpen }))}
                      aria-expanded={isOpen}
                      className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left ${st === "current" ? "bg-green-50/70 dark:bg-green-400/5" : ""}`}
                    >
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
                          st === "done"
                            ? "bg-green-600 text-white"
                            : st === "current"
                              ? "bg-white text-green-700 ring-2 ring-green-600 dark:bg-transparent dark:text-green-400"
                              : st === "past"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300"
                                : "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400"
                        }`}
                      >
                        {st === "done" ? (
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
                        ) : (
                          wi + 1
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-gray-900 dark:text-gray-50">
                          {week.theme || "No topic yet"}
                        </span>
                        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                          {[
                            `Week ${wi + 1}`,
                            date ? formatDate(date) : draft.startDate ? "After the season" : "",
                            st === "current" ? "Up next" : "",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 text-xs font-bold ${
                          st === "done"
                            ? "text-green-700 dark:text-green-400"
                            : st === "past"
                              ? "text-amber-700 dark:text-amber-300"
                              : "text-gray-400"
                        }`}
                      >
                        {total === 0 ? "No drills" : st === "done" ? "Done" : `${done}/${total}`}
                      </span>
                      <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4">
                        <button
                          onClick={() => setSheet({ kind: "topic", weekId: week.id })}
                          className="mb-3 inline-flex cursor-pointer items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700 hover:text-green-700 dark:bg-white/10 dark:text-gray-200"
                        >
                          Topic: {week.theme || "pick one"}
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                        </button>
                        {weekDrills(week)}
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3 dark:border-white/10">
                          {smallButton("↑ Earlier", () => editPlan((p) => ({ ...p, weeks: move(p.weeks, wi, wi - 1) })), wi === 0)}
                          {smallButton("↓ Later", () => editPlan((p) => ({ ...p, weeks: move(p.weeks, wi, wi + 1) })), wi === draft.weeks.length - 1)}
                          <span className="flex-1" />
                          {smallButton(
                            "Remove Week",
                            () => {
                              if (week.drillIds.length > 0 && !confirm(`Remove week ${wi + 1}${week.theme ? ` (${week.theme})` : ""}?`)) return;
                              editPlan((p) => ({ ...p, weeks: p.weeks.filter((w) => w.id !== week.id) }));
                            },
                            false,
                            true
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <button
          onClick={() => {
            const id = newId();
            editPlan((p) => ({ ...p, weeks: [...p.weeks, { id, theme: "", drillIds: [], doneIds: [] }] }));
            setWeekToggles((t) => ({ ...t, [id]: true }));
          }}
          className="mt-4 w-full cursor-pointer rounded-2xl border-2 border-dashed border-gray-300 py-3 text-sm font-bold text-gray-600 hover:border-green-400 hover:text-green-700 dark:text-gray-300 dark:border-white/20"
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
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{label}</span>
        <div className="mt-1">{input}</div>
        {hint && <span className="mt-0.5 block text-[11px] text-gray-400">{hint}</span>}
      </label>
    );
    return (
      <section className="rounded-3xl bg-white p-4 shadow-sm ring-2 ring-green-600/30 dark:bg-[#1c1c1e]">
        <h2 className="mb-3 text-[17px] font-bold text-gray-900 dark:text-gray-50">
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
          {(() => {
            const uploads = (form.id && drillById.get(form.id)?.uploads) || [];
            const count = uploads.length + pendingFiles.length;
            const row = (key: string, icon: string, label: string, note: string, onRemove: () => void) => (
              <li key={key} className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-white/5">
                <span aria-hidden="true">{icon}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-gray-800 dark:text-gray-100">
                  {label}
                  {note && <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">{note}</span>}
                </span>
                <button
                  type="button"
                  onClick={onRemove}
                  disabled={uploading}
                  className="shrink-0 cursor-pointer text-xs font-semibold text-red-600 disabled:opacity-40 dark:text-red-400"
                >
                  Remove
                </button>
              </li>
            );
            return (
              <div>
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Photos &amp; PDFs</span>
                {count > 0 && (
                  <ul className="mt-1 flex flex-col gap-1.5">
                    {uploads.map((u) =>
                      row(u.id, u.type === "pdf" ? "📄" : "🖼️", u.label, "", () => removeFile(form.id, u.id, u.label))
                    )}
                    {pendingFiles.map((f, i) =>
                      row(`p${i}`, /pdf$/i.test(f.type || f.name) ? "📄" : "🖼️", f.name, "· adds when you save", () =>
                        setPendingFiles((prev) => prev.filter((_, j) => j !== i))
                      )
                    )}
                  </ul>
                )}
                {count < MAX_DRILL_UPLOADS && (
                  <label
                    className={`mt-1.5 flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-gray-300 py-2.5 text-sm font-bold text-gray-600 hover:border-green-400 hover:text-green-700 dark:border-white/20 dark:text-gray-300 ${uploading ? "pointer-events-none opacity-50" : ""}`}
                  >
                    {uploading ? "Uploading…" : "+ Add Photo or PDF"}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      multiple
                      className="sr-only"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        e.target.value = "";
                        if (files.length) addFiles(form.id, files, MAX_DRILL_UPLOADS - count);
                      }}
                    />
                  </label>
                )}
                <span className="mt-0.5 block text-[11px] text-gray-400">
                  Up to {MAX_DRILL_UPLOADS}{" "}— a photo of the whiteboard, a drawn-up session or a PDF (up to 1 MB). Only
                  the club&apos;s coaches can see them.
                </span>
              </div>
            );
          })()}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => {
              setDrillForm(null);
              setPendingFiles([]);
            }}
            className="cursor-pointer rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:border-gray-300 dark:text-gray-300 dark:border-white/15"
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
    const chip = (on: boolean, label: ReactNode, onClick: () => void, key: string) => (
      <button
        key={key}
        onClick={onClick}
        className={`shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold ${
          on
            ? "border-green-600 bg-green-600 text-white"
            : "border-gray-200 bg-white text-gray-600 hover:border-green-400 dark:bg-[#1c1c1e] dark:text-gray-300 dark:border-white/15"
        }`}
      >
        {label}
      </button>
    );
    return (
      <>
        <div className="mb-3 flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search drills"
            aria-label="Search drills"
            className={`${inputClass} min-w-0 flex-1 rounded-xl py-2.5`}
          />
          {canEdit && (
            <button
              onClick={() => setDrillForm({ ...BLANK_DRILL })}
              className="shrink-0 cursor-pointer rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700"
            >
              + New Drill
            </button>
          )}
        </div>
        {/* one row of filters, scrolled sideways: the type, then the topic */}
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {chip(!kindFilter && !topicFilter, "All", () => {
            setKindFilter("");
            setTopicFilter("");
          }, "all")}
          {DRILL_KINDS.map((k) =>
            chip(kindFilter === k.slug, <>{k.name} <span className="opacity-70">{kindCount(k.slug)}</span></>, () => setKindFilter(kindFilter === k.slug ? "" : k.slug), k.slug)
          )}
          <span className="my-1 w-px shrink-0 bg-gray-300 dark:bg-white/15" />
          {DRILL_TOPICS.map((t) =>
            chip(topicFilter === t.slug, <>{t.name} <span className="opacity-70">{topicCount(t.slug)}</span></>, () => setTopicFilter(topicFilter === t.slug ? "" : t.slug), t.slug)
          )}
        </div>

        {drills.length > 0 && (
          <p className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {shownDrills.length === drills.length
              ? `${drills.length} drill${drills.length === 1 ? "" : "s"}`
              : `${shownDrills.length} of ${drills.length} drills`}
          </p>
        )}

        {drills.length === 0 ? (
          <div className="rounded-3xl bg-white px-4 py-8 text-center shadow-sm dark:bg-[#1c1c1e]">
            <div className="text-3xl">⚽</div>
            <p className="mt-2 text-[17px] font-bold text-gray-900 dark:text-gray-50">No drills yet</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-gray-500 dark:text-gray-400">
              Every team&apos;s plan picks from this one library, so a drill only has to be written once.
            </p>
          </div>
        ) : shownDrills.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">No drills match.</p>
        ) : (
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-[#1c1c1e]">
            {shownDrills.map((drill) => (
              <button
                key={drill.id}
                onClick={() => setSheet({ kind: "drill", drillId: drill.id })}
                className="flex w-full cursor-pointer items-center gap-3 border-b border-gray-100 px-4 py-3 text-left last:border-b-0 dark:border-white/10"
              >
                <span className={`h-9 w-1 shrink-0 rounded-full ${KIND_STRIPE[drill.kind]}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-gray-900 dark:text-gray-50">{drill.title}</span>
                  <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                    {[
                      DRILL_KINDS.find((k) => k.slug === drill.kind)?.name,
                      drill.topic ? topicName(drill.topic) : "",
                      drill.minutes ? `${drill.minutes} min` : "",
                      drill.players ? `${drill.players} players` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
              </button>
            ))}
          </div>
        )}
      </>
    );
  }

  /** Whichever sheet is open: a drill, picking one for a week, a week's topic, or the plan's details. */
  function sheetView() {
    if (!sheet || !draft) return null;
    const close = () => setSheet(null);
    if (sheet.kind === "plan") {
      return (
        <Sheet title="Edit Plan" onClose={close}>
          <label className="mb-4 block">
            <span className="px-1 text-xs font-semibold text-gray-600 dark:text-gray-300">Name</span>
            <input
              value={draft.title}
              onChange={(e) => editPlan((p) => ({ ...p, title: e.target.value }))}
              placeholder={`${teamName(team)} Plan, e.g. Autumn block`}
              maxLength={120}
              className={`${inputClass} mt-1 rounded-xl py-2.5`}
            />
          </label>
          <label className="mb-4 block">
            <span className="px-1 text-xs font-semibold text-gray-600 dark:text-gray-300">Week 1 is on</span>
            <select
              value={draft.startDate}
              onChange={(e) => editPlan((p) => ({ ...p, startDate: e.target.value }))}
              className={`${inputClass} mt-1 rounded-xl py-2.5`}
            >
              <option value="">Not scheduled yet</option>
              {/* a start date the schedule no longer covers still shows */}
              {draft.startDate && !sessionsHere.some((s) => s.date === draft.startDate) && (
                <option value={draft.startDate}>{formatDate(draft.startDate)}</option>
              )}
              {sessionsHere.map((s) => (
                <option key={s.date} value={s.date}>
                  {formatDate(s.date)}
                  {s.cancelled ? " — no training" : ""}
                </option>
              ))}
            </select>
            <span className="mt-1 block px-1 text-[11px] text-gray-500 dark:text-gray-400">
              Each week goes on the team&apos;s next training session, and shows in the Training Log. A session marked as
              no training is skipped, so the plan moves back one.
            </span>
          </label>
          {seasonPlan.length > 0 && (
            <button
              onClick={() => {
                applySeasonPlan();
                close();
              }}
              className="mb-4 w-full cursor-pointer rounded-2xl bg-white p-3 text-left text-sm shadow-sm ring-2 ring-green-600/30 dark:bg-[#2c2c2e]"
            >
              <span className="font-bold text-gray-900 dark:text-gray-50">Use the {seasonPlan.length}-Week Season Plan</span>
              <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                Fills the weeks with the{seasonPlanTitle ? ` ${seasonPlanTitle}` : " season plan"}&apos;s topics and drills.
              </span>
            </button>
          )}
          <button onClick={close} className="w-full cursor-pointer rounded-xl bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-700">
            Done
          </button>
        </Sheet>
      );
    }
    const week = "weekId" in sheet ? draft.weeks.find((w) => w.id === sheet.weekId) : undefined;
    if (sheet.kind === "topic") {
      if (!week) return null;
      const known = DRILL_TOPICS.some((t) => t.name === week.theme);
      const options = [...DRILL_TOPICS.map((t) => t.name), ...(week.theme && !known ? [week.theme] : [])];
      return (
        <Sheet title={`Week ${draft.weeks.indexOf(week) + 1} Topic`} onClose={close}>
          <div className="overflow-hidden rounded-2xl bg-white dark:bg-[#2c2c2e]">
            {options.map((name) => (
              <button
                key={name}
                onClick={() => {
                  setWeek(week.id, (w) => ({ ...w, theme: name }));
                  close();
                }}
                className="flex w-full cursor-pointer items-center justify-between border-b border-gray-100 px-4 py-3 text-left text-[15px] font-semibold text-gray-900 last:border-b-0 dark:border-white/10 dark:text-gray-50"
              >
                {name}
                {week.theme === name && <span className="text-green-600">✓</span>}
              </button>
            ))}
          </div>
        </Sheet>
      );
    }
    if (sheet.kind === "pick") {
      if (!week) return null;
      const [one, many] = SLOT_WORD[sheet.slot];
      const current = inSlot(week, sheet.slot);
      const topic = DRILL_TOPICS.find((t) => t.name === week.theme);
      const ofKind = drills.filter((d) => d.kind === sheet.slot);
      const onTopic = topic ? ofKind.filter((d) => d.topic === topic.slug) : [];
      const others = topic ? ofKind.filter((d) => d.topic !== topic.slug) : ofKind;
      const group = (label: string, list: Drill[]) =>
        list.length > 0 && (
          <>
            <p className="mb-1.5 mt-4 px-1 text-[13px] font-semibold uppercase tracking-wide text-gray-500 first:mt-0 dark:text-gray-400">{label}</p>
            <div className="overflow-hidden rounded-2xl bg-white dark:bg-[#2c2c2e]">
              {list.map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    setSlot(week.id, sheet.slot, d.id);
                    close();
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 border-b border-gray-100 px-4 py-3 text-left last:border-b-0 dark:border-white/10"
                >
                  <span className={`h-8 w-1 shrink-0 rounded-full ${KIND_STRIPE[d.kind]}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-gray-900 dark:text-gray-50">{d.title}</span>
                    <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                      {[d.topic ? topicName(d.topic) : "No topic", d.minutes ? `${d.minutes} min` : ""].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {current?.id === d.id && <span className="shrink-0 font-bold text-green-600">✓</span>}
                </button>
              ))}
            </div>
          </>
        );
      return (
        <Sheet title={`Pick a ${one[0].toUpperCase()}${one.slice(1)}`} onClose={close}>
          {ofKind.length === 0 ? (
            <p className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-gray-500 dark:bg-[#2c2c2e] dark:text-gray-400">
              No {many} in the library yet.{" "}
              <button
                onClick={() => {
                  close();
                  setView("library");
                }}
                className="cursor-pointer font-semibold text-green-700 underline dark:text-green-400"
              >
                Add one
              </button>
            </p>
          ) : (
            <>
              {topic && onTopic.length === 0 && (
                <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
                  No {topic.name.toLowerCase()} {many} yet — here are the others.
                </p>
              )}
              {group(topic ? topic.name : many, topic ? onTopic : others)}
              {topic && group(`Other ${many}`, others)}
            </>
          )}
          {current && (
            <button
              onClick={() => {
                setSlot(week.id, sheet.slot, "");
                close();
              }}
              className="mt-4 w-full cursor-pointer rounded-xl py-2.5 text-sm font-semibold text-red-600 dark:text-red-400"
            >
              Take {current.title} Out
            </button>
          )}
        </Sheet>
      );
    }
    // a drill: from a week (tick it off, swap it), or from the library (edit it)
    const drill = drillById.get(sheet.drillId);
    if (!drill) return null;
    const uses = usesOf(drill.id);
    const ticked = !!week?.doneIds.includes(drill.id);
    const tickable = !!week && !!savedPlan?.weeks.find((w) => w.id === week.id)?.drillIds.includes(drill.id);
    return (
      <Sheet title={drill.title} badge={<KindBadge kind={drill.kind} />} onClose={close}>
        <div className="rounded-2xl bg-white p-4 dark:bg-[#2c2c2e]">
          <DrillDetails drill={drill} adminKey={key} />
        </div>
        {week ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => setSheet({ kind: "pick", weekId: week.id, slot: drill.kind })}
              className="cursor-pointer rounded-xl bg-white py-3 text-sm font-bold text-gray-700 shadow-sm dark:bg-[#2c2c2e] dark:text-gray-200"
            >
              Swap Drill
            </button>
            <button
              onClick={() => tick(week.id, drill.id, !ticked)}
              disabled={!tickable || !!ticking}
              className={`cursor-pointer rounded-xl py-3 text-sm font-bold disabled:opacity-40 ${
                ticked ? "bg-white text-green-700 shadow-sm dark:bg-[#2c2c2e] dark:text-green-400" : "bg-green-600 text-white hover:bg-green-700"
              }`}
            >
              {ticked ? "✓ Done" : "Mark Done"}
            </button>
            {!tickable && (
              <p className="col-span-2 text-center text-[11px] text-gray-500 dark:text-gray-400">Save the plan first, then tick it off</p>
            )}
          </div>
        ) : (
          <>
            <p className="mt-3 px-1 text-xs text-gray-500 dark:text-gray-400">
              {uses.length > 0 ? `Used in ${uses.join(", ")}` : "Not in any plan yet"}
            </p>
            {canEdit && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    close();
                    setDrillForm(toDraft(drill));
                  }}
                  className="cursor-pointer rounded-xl bg-white py-3 text-sm font-bold text-gray-700 shadow-sm dark:bg-[#2c2c2e] dark:text-gray-200"
                >
                  Edit
                </button>
                {!drill.builtIn && (
                  <button
                    onClick={async () => {
                      if (await deleteDrill(drill)) close();
                    }}
                    disabled={saving}
                    className="cursor-pointer rounded-xl bg-white py-3 text-sm font-bold text-red-600 shadow-sm disabled:opacity-40 dark:bg-[#2c2c2e] dark:text-red-400"
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </Sheet>
    );
  }

  return (
    <main className="themed min-h-screen bg-[#f2f2f7] dark:bg-black dark:text-gray-50 pb-24">
      <TopBar title="Training Plans" href={`/admin${keyQuery(key)}`} />

      <div className="mx-auto max-w-2xl px-4 py-4">
        {/* Plan / library switch */}
        <ToolTabs label="Training plan views" tabs={[{ id: "plan", label: "Team Plans" }, { id: "library", label: "Drill Library", count: drills.length }]} value={view} onChange={(next) => { setView(next as View); setSheet(null); }} />

        {/* Team tabs — plans only; the library is shared */}
        {view === "plan" && (
          <label className="mb-4 block"><span className="sr-only">Team</span><select value={team} onChange={(event) => switchTeam(event.target.value)} className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 dark:border-white/15 dark:bg-[#1c1c1e] dark:text-gray-50">{TEAMS.map((option) => <option key={option.slug} value={option.slug}>{option.name}</option>)}</select></label>
        )}

        {error && (
          <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-300">{error}</p>
        )}

        {/* The library is the owner's: they unlock editing it with their own password */}
        {view === "library" && !coachesEditDrills && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-3xl bg-white px-4 py-3 text-xs text-gray-500 shadow-sm dark:bg-[#1c1c1e] dark:text-gray-400">
            {canEdit ? (
              <>
                <span className="font-semibold text-green-700 dark:text-green-400">Editing drills as the owner</span>
                <button
                  onClick={() => {
                    setDrillForm(null);
                    setOwnerKey("");
                  }}
                  className="cursor-pointer font-semibold text-gray-600 hover:text-green-700 dark:text-gray-300"
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
                <span>Drills are set by the owner</span>
                {ownerKeySet && (
                  <button
                    onClick={() => setUnlocking(true)}
                    className="cursor-pointer rounded-full bg-gray-100 px-3 py-1 font-semibold text-gray-700 hover:text-green-700 dark:bg-white/10 dark:text-gray-200"
                  >
                    Owner Unlock
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {view === "plan" ? planView() : libraryView()}
      </div>

      {sheetView()}

      {/* Unsaved plan changes follow the coach down the page */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:border-white/15 dark:bg-[#1c1c1e]/95">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              {teamName(team)} plan has unsaved changes
            </span>
            <div className="flex gap-2">
              <button
                onClick={discardPlan}
                disabled={saving}
                className="cursor-pointer rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:border-gray-300 disabled:opacity-40 dark:text-gray-300 dark:border-white/15"
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
