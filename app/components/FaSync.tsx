"use client";

// Keeps a team's fixtures in step with FA Full-Time. The team's official
// Full-Time snippet is loaded in a hidden frame in the coach's own browser
// (Full-Time blocks servers), the games are read out of it and sent to the
// match log to add or update. It runs by itself when a team's match log is
// opened — at most once an hour per team on each device — and on "Sync now".
import { useCallback, useEffect, useRef, useState } from "react";
import { FA_SNIPPETS, parseSnippet, type FaFixture } from "@/lib/faFullTime";
import { CLUB } from "@/club.config";

interface SyncResult {
  at: number;
  games?: number;
  added?: number;
  updated?: number;
  undated?: number;
  error?: string;
}

const AUTO_EVERY_MS = 60 * 60 * 1000;
const storageKey = (team: string) => `${CLUB.storagePrefix}:fa-sync:${team}`;

function readResult(team: string): SyncResult | null {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey(team)) ?? "null");
  } catch {
    return null;
  }
}

function saveResult(team: string, result: SyncResult) {
  try {
    window.localStorage.setItem(storageKey(team), JSON.stringify(result));
  } catch {
    // storage blocked — it just syncs again next time
  }
}

/** Load a snippet in a throwaway frame and read the fixtures it writes. */
function loadSnippet(code: string): Promise<{ fixtures: FaFixture[]; undated: number }> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.style.cssText = "position:absolute;left:-9999px;width:400px;height:400px;border:0";
    frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<div id="lrep${code}">Data loading....</div>
<script>var lrcode = '${code}';</script>
<script src="https://fulltime.thefa.com/client/api/cs1.js"></script>
</body></html>`;
    const started = Date.now();
    const done = (fn: () => void) => {
      window.clearInterval(timer);
      frame.remove();
      fn();
    };
    const timer = window.setInterval(() => {
      const box = frame.contentDocument?.getElementById(`lrep${code}`);
      if (box && !box.textContent?.includes("Data loading")) {
        const parsed = parseSnippet(box);
        done(() => resolve(parsed));
      } else if (Date.now() - started > 20000) {
        done(() => reject(new Error("Full-Time didn't answer")));
      }
    }, 500);
    document.body.appendChild(frame);
  });
}

function ago(at: number) {
  const mins = Math.round((Date.now() - at) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function FaSync<M>({
  team,
  adminKey,
  onMatches,
}: {
  team: string;
  adminKey: string;
  onMatches: (matches: M[]) => void;
}) {
  const code = FA_SNIPPETS[team];
  const [result, setResult] = useState<SyncResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const running = useRef(false);

  const sync = useCallback(async () => {
    if (!code || running.current) return;
    running.current = true;
    setSyncing(true);
    let next: SyncResult;
    try {
      const { fixtures, undated } = await loadSnippet(code);
      const res = await fetch(`/api/stats/matches?key=${encodeURIComponent(adminKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fa-sync", team, fixtures }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "The match log didn't save them");
      onMatches(data.matches ?? []);
      next = {
        at: Date.now(),
        games: fixtures.length,
        added: data.added,
        updated: data.updated,
        undated,
      };
    } catch (err) {
      next = { at: Date.now(), error: err instanceof Error ? err.message : "Sync failed" };
    }
    saveResult(team, next);
    setResult(next);
    setSyncing(false);
    running.current = false;
  }, [code, adminKey, team, onMatches]);

  // On opening a team's log: show the last sync, and run one if it's been a while.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!code) return;
    const last = readResult(team);
    setResult(last);
    if (!last || last.error || Date.now() - last.at > AUTO_EVERY_MS) sync();
  }, [team, code, sync]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!code) return null;

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
      <p className="min-w-0 text-xs text-gray-600">
        <span className="font-semibold text-gray-800">🔄 Fixtures from FA Full-Time</span>
        <br />
        {syncing
          ? "Checking Full-Time…"
          : !result
            ? "Not synced yet."
            : result.error
              ? `Couldn't sync ${ago(result.at)} — ${result.error}.`
              : `Synced ${ago(result.at)} · ${result.games} game${result.games === 1 ? "" : "s"}` +
                (result.added || result.updated
                  ? ` (${result.added} added, ${result.updated} updated)`
                  : ", all up to date") +
                (result.undated ? ` · ${result.undated} not dated yet` : "")}
      </p>
      <button
        onClick={sync}
        disabled={syncing}
        className="shrink-0 cursor-pointer rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:border-green-400 hover:text-green-700 disabled:opacity-40"
      >
        Sync Now
      </button>
    </div>
  );
}
