"use client";

// A parent's children: a name and team for each, with "add another" — on the
// join page, the parent's account page, and when a coach fixes them in Members.
import { MAX_CHILDREN, type Child } from "@/lib/access";
import type { ReactNode } from "react";
import NameFields from "./NameFields";

export type ChildDraft = {
  id?: string;
  name: string;
  team: string;
  /** a squad player already: the club decides their team (shown, not chosen, for parents) */
  linked?: boolean;
  teamLabel?: string;
  /** their squad player, for their photo */
  playerId?: string;
  /** added by the parent, waiting for a coach to approve them into the squad */
  pending?: boolean;
};
type TeamOption = { slug: string; name: string };

export const toDrafts = (children: Child[]): ChildDraft[] =>
  children.map((c) => ({
    id: c.id === "legacy" ? undefined : c.id,
    name: c.name,
    // one still waiting keeps the team the parent asked for
    team: c.team?.slug ?? (c.pending ? c.requestedTeam?.slug ?? "" : ""),
    ...(c.pending ? { pending: true } : {}),
    ...(c.playerId
      ? {
          playerId: c.playerId,
          linked: true,
          teamLabel: c.team
            ? `${c.team.name} (set by the club)`
            : c.requestedTeam
              ? `Asked for ${c.requestedTeam.name} — the club will choose`
              : "The club will choose a team",
        }
      : {}),
  }));

export default function ChildrenEditor({
  value,
  teams,
  onChange,
  clubDecidesTeams = false,
  required = false,
  photo,
}: {
  value: ChildDraft[];
  teams: TeamOption[];
  onChange: (next: ChildDraft[]) => void;
  /** a parent's view: squad players' teams are shown, not chosen */
  clubDecidesTeams?: boolean;
  /** each child needs a first and last name (the join form) */
  required?: boolean;
  /**
   * each child as a card headed by their photo (the parent's account page):
   * renders the photo, with `info` (their name and team) beside it
   */
  photo?: (child: ChildDraft, info: ReactNode) => ReactNode;
}) {
  const set = (i: number, change: Partial<ChildDraft>) => onChange(value.map((c, j) => (j === i ? { ...c, ...change } : c)));
  const field =
    "rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:text-gray-50 dark:border-white/15";
  const remove = (i: number) =>
    value.length > 1 && (
      <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Remove child ${i + 1}`} className="px-2 text-lg text-gray-400 hover:text-red-600">
        ×
      </button>
    );
  const teamSelect = (c: ChildDraft, i: number) =>
    teams.length > 0 && (
      <select value={c.team} onChange={(e) => set(i, { team: e.target.value })} aria-label={`Child ${i + 1}'s team`} className={`${field} w-full min-w-0 flex-1 basis-32`}>
        <option value="">Team…</option>
        {teams.map((t) => (
          <option key={t.slug} value={t.slug}>
            {t.name}
          </option>
        ))}
      </select>
    );
  const names = (c: ChildDraft, i: number) => (
    <NameFields value={c.name} onChange={(name) => set(i, { name })} label={`Child ${i + 1}'s`} required={required} className={field} />
  );

  if (photo) {
    return (
      <div className="flex flex-col">
        {value.map((c, i) => {
          const teamFixed = clubDecidesTeams && c.linked;
          const status = c.pending
            ? "Waiting for a coach to add them to the squad"
            : teamFixed
              ? c.teamLabel
              : c.id
                ? ""
                : "New — a coach adds them to the squad";
          const info = (
            <>
              <span className="block truncate font-semibold text-gray-900 dark:text-gray-50">{c.name.trim() || `Child ${i + 1}`}</span>
              {status && (
                <span className={`block text-sm ${c.pending || !c.id ? "text-amber-700 dark:text-amber-300" : "text-gray-500 dark:text-gray-400"}`}>{status}</span>
              )}
            </>
          );
          return (
            <div key={c.id ?? `new-${i}`} className="border-b border-gray-100 py-4 first:pt-0 last:border-0 dark:border-white/10">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">{photo(c, info)}</div>
                {remove(i)}
              </div>
              {/* a block, not a flex column: the name boxes' flex sizes are for a row */}
              <div className="mt-3 space-y-2">
                {names(c, i)}
                {!teamFixed && teamSelect(c, i)}
              </div>
            </div>
          );
        })}
        {value.length < MAX_CHILDREN && (
          <button type="button" onClick={() => onChange([...value, { name: "", team: "" }])} className="mt-3 self-start text-sm font-semibold text-green-700 hover:underline dark:text-green-400">
            + Add another child
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {value.map((c, i) => (
        <div key={c.id ?? `new-${i}`} className="flex flex-wrap gap-2">
          {names(c, i)}
          {clubDecidesTeams && c.linked ? (
            <span className="flex basis-32 items-center text-sm text-gray-500 dark:text-gray-400">{c.teamLabel}</span>
          ) : (
            teamSelect(c, i)
          )}
          {remove(i)}
        </div>
      ))}
      {value.length < MAX_CHILDREN && (
        <button type="button" onClick={() => onChange([...value, { name: "", team: "" }])} className="self-start text-sm font-semibold text-green-700 hover:underline dark:text-green-400">
          + Add another child
        </button>
      )}
    </div>
  );
}
