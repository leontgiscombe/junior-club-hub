"use client";

// Setting up a club's teams, straight after signing it up: each team's name,
// age group, formation, training days and FA Full-Time code, as many teams as
// the club has (with the plan that covers them after the free trial), and
// which team the admin coaches, so the Training Hub and their alerts follow
// it. Saved the way Settings → Teams saves (/api/settings), where any of it
// can be changed later.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SESSION_KEY } from "@/lib/access";
import { PLANS, planForTeams, teamsLabel } from "@/lib/billing";
import type { Team } from "@/lib/clubSettings";
import { TeamsEditor, fromDrafts, toDraft, type TeamDraft } from "./ClubSettings";
import { ToolSkeleton } from "./Skeleton";
import { TopBar } from "./SettingsUI";

const KEY = `key=${encodeURIComponent(SESSION_KEY)}`;

export default function TeamsSetup() {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamDraft[] | null>(null);
  const [initials, setInitials] = useState("");
  const [trial, setTrial] = useState(false);
  // the team the admin coaches, by its name (a new team has no slug until it's saved), or "" for none
  const [mine, setMine] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/settings?${KEY}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject(new Error("Sign in as the club's admin first")))),
      fetch("/api/me/club", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([snap, me]) => {
        const drafts = (snap.teams as Team[]).map(toDraft);
        setTeams(drafts);
        setInitials(snap.club?.initials ?? "");
        setTrial(typeof snap.plan === "string" && snap.plan.startsWith("Free trial"));
        const own = drafts.find((t) => t.slug && t.slug === me?.person?.team?.slug);
        // a new club's only team is most likely the admin's own
        setMine(own?.name ?? (drafts.filter((t) => !t.archived).length === 1 ? drafts[0].name : ""));
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  if (!teams) {
    return (
      <div className="themed min-h-screen bg-[#f2f2f7] dark:bg-black dark:text-gray-50">
        <TopBar title="Your Teams" href="/admin" />
        <div className="mx-auto max-w-xl px-4">{error ? <p className="mt-6 text-center text-sm text-red-600">{error}</p> : <ToolSkeleton />}</div>
      </div>
    );
  }

  const live = teams.filter((t) => !t.archived);
  const named = live.filter((t) => t.name.trim());
  const plan = planForTeams(live.length);

  async function save() {
    setError(null);
    if (live.some((t) => !t.name.trim())) return setError("Give every team a name, or remove the empty one.");
    setBusy(true);
    try {
      const res = await fetch(`/api/settings?${KEY}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teams: fromDrafts(teams!) }),
      });
      const snap = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(snap.error ?? "Your teams didn't save — try again");
      // their own team, now every team has its slug
      const own = (snap.teams as Team[]).find((t) => !t.archived && t.name === mine.trim());
      const me = await fetch("/api/me/club", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team: own?.slug ?? null }),
      });
      if (!me.ok) throw new Error((await me.json().catch(() => ({}))).error ?? "Your own team didn't save — try again");
      router.push("/admin");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="themed min-h-screen bg-[#f2f2f7] pb-16 dark:bg-black dark:text-gray-50">
      <TopBar title="Your Teams" href="/admin" />
      <div className="mx-auto max-w-xl px-4">
        <p className="mt-2 px-1 text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">
          Set up each of your club&apos;s teams: its age group and formation decide what its players learn in the
          Training Hub, and its training days drive the Training Log and plans. Add every team now, or more later in
          Settings.
        </p>

        <TeamsEditor
          teams={teams}
          setTeams={(update) => setTeams((all) => update(all ?? []))}
          initials={initials}
          adminKey={SESSION_KEY}
          onFaCodeEditing={() => {}}
          initialOpen={live.length === 1 ? teams.indexOf(live[0]) : null}
          footer={
            <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
              {live.length} {live.length === 1 ? "team" : "teams"}: the {PLANS[plan].name} plan ({teamsLabel(plan).toLowerCase()})
              {trial ? " after your free trial" : ""}.
            </p>
          }
        />

        <section className="mt-4 rounded-3xl bg-white p-5 shadow-sm dark:bg-[#1c1c1e]">
          <label>
            <span className="font-extrabold text-gray-900 dark:text-gray-50">Which team do you coach?</span>
            <select
              value={named.some((t) => t.name === mine) ? mine : ""}
              onChange={(e) => setMine(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:border-white/15 dark:text-gray-50"
            >
              <option value="">None, or more than one</option>
              {named.map((t, i) => (
                <option key={t.slug || `new-${i}`} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-gray-400">
              Your Training Hub and your alerts follow this team. You can change it in Your Account.
            </span>
          </label>
        </section>

        {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-300">{error}</p>}
        <button
          onClick={save}
          disabled={busy}
          className="mt-4 w-full cursor-pointer rounded-2xl bg-green-600 py-3.5 font-bold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save and Continue"}
        </button>
      </div>
    </div>
  );
}
