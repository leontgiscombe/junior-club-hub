"use client";

// Your Account → Tab Bar: choose the tabs at the bottom of the screen and
// their order (lib/tabs.ts), for this phone. Home is always first.
import { useEffect, useState } from "react";
import { MAX_TABS, availableTabs, chosenTabs, loadSavedTabs, saveTabs, tabDef, type TabContext, type TabId } from "@/lib/tabs";
import { useClub } from "../components/ClubProvider";
import { TabIcon } from "../components/TabBar";

export default function TabBarPicker() {
  const club = useClub();
  const [ctx, setCtx] = useState<TabContext | null>(null);
  const [tabs, setTabs] = useState<TabId[]>([]);

  // who this is decides which tabs they can have
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .catch(() => null)
      .then((me) => {
        const roles: string[] = me?.person?.status === "approved" ? me.person.roles : [];
        const c: TabContext = {
          signedIn: !!me?.user,
          canCoach: !!me?.canCoach,
          canFinance: roles.includes("treasurer") || roles.includes("admin"),
          features: club.features,
          publicResults: club.publicResults,
        };
        setCtx(c);
        setTabs(chosenTabs(c, loadSavedTabs()));
      });
  }, [club.features, club.publicResults]);

  if (!ctx) return <div className="mt-4 h-64 animate-pulse rounded-3xl bg-white dark:bg-[#1c1c1e]" />;

  const update = (next: TabId[]) => {
    setTabs(next);
    saveTabs(next);
  };
  const toggle = (id: TabId) =>
    update(tabs.includes(id) ? tabs.filter((t) => t !== id) : tabs.length < MAX_TABS ? [...tabs, id] : tabs);
  const move = (id: TabId, by: -1 | 1) => {
    const i = tabs.indexOf(id);
    const j = i + by;
    // Home stays first
    if (i <= 0 || j <= 0 || j >= tabs.length) return;
    const next = [...tabs];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };
  const others = availableTabs(ctx).filter((id) => !tabs.includes(id));

  return (
    <div className="mt-4">
      <p className="px-2 pb-3 text-sm text-gray-500 dark:text-gray-400">
        Home is always first. Tick up to {MAX_TABS - 1} more and put them in order — {tabs.length} of {MAX_TABS} chosen.
      </p>
      <ul className="divide-y divide-gray-100 overflow-hidden rounded-3xl bg-white shadow-sm dark:divide-white/10 dark:bg-[#1c1c1e]">
        {[...tabs, ...others].map((id) => {
          const on = tabs.includes(id);
          const i = tabs.indexOf(id);
          const label = tabDef(id, ctx).label;
          return (
            <li key={id} className="flex items-center gap-3 px-4 py-2.5 text-gray-900 dark:text-gray-50">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${on ? "bg-green-700/10 text-green-700 dark:bg-green-400/15 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400"}`}>
                <TabIcon id={id} className="h-5 w-5" />
              </span>
              <span className="flex-1 text-[16px]">{label}</span>
              {on && id !== "home" && (
                <span className="flex gap-1">
                  <button onClick={() => move(id, -1)} disabled={i <= 1} aria-label={`Move ${label} left`} className="grid h-9 w-9 place-items-center rounded-full text-gray-500 disabled:opacity-25 dark:text-gray-400">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
                  </button>
                  <button onClick={() => move(id, 1)} disabled={i === tabs.length - 1} aria-label={`Move ${label} right`} className="grid h-9 w-9 place-items-center rounded-full text-gray-500 disabled:opacity-25 dark:text-gray-400">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                  </button>
                </span>
              )}
              {id === "home" ? (
                <span className="text-xs font-semibold text-gray-400">Always</span>
              ) : (
                <button
                  onClick={() => toggle(id)}
                  aria-pressed={on}
                  aria-label={on ? `Remove ${label}` : `Add ${label}`}
                  disabled={!on && tabs.length >= MAX_TABS}
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 disabled:opacity-30 ${on ? "border-green-600 bg-green-600 text-white" : "border-gray-300 dark:border-white/25"}`}
                >
                  {on && (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                  )}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <button
        onClick={() => {
          saveTabs(null);
          setTabs(chosenTabs(ctx, null));
        }}
        className="mt-3 px-2 text-sm font-semibold text-green-700 dark:text-green-400"
      >
        Reset to the usual tabs
      </button>
    </div>
  );
}
