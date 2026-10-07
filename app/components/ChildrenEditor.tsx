"use client";

// A parent's children: a name and team for each, with "add another" — on the
// join page, the parent's account page, and when a coach fixes them in Members.
import { MAX_CHILDREN, type Child } from "@/lib/access";

export type ChildDraft = {
  id?: string;
  name: string;
  team: string;
  /** a squad player already: the club decides their team (shown, not chosen, for parents) */
  linked?: boolean;
  teamLabel?: string;
};
type TeamOption = { slug: string; name: string };

export const toDrafts = (children: Child[]): ChildDraft[] =>
  children.map((c) => ({
    id: c.id === "legacy" ? undefined : c.id,
    name: c.name,
    team: c.team?.slug ?? "",
    ...(c.playerId
      ? {
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
}: {
  value: ChildDraft[];
  teams: TeamOption[];
  onChange: (next: ChildDraft[]) => void;
  /** a parent's view: squad players' teams are shown, not chosen */
  clubDecidesTeams?: boolean;
}) {
  const set = (i: number, change: Partial<ChildDraft>) => onChange(value.map((c, j) => (j === i ? { ...c, ...change } : c)));
  const field =
    "rounded-xl border border-gray-200 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400";
  return (
    <div className="flex flex-col gap-2">
      {value.map((c, i) => (
        <div key={c.id ?? `new-${i}`} className="flex flex-wrap gap-2">
          <input
            value={c.name}
            onChange={(e) => set(i, { name: e.target.value })}
            maxLength={60}
            placeholder="e.g. Sam B"
            aria-label={`Child ${i + 1}'s name`}
            className={`${field} min-w-0 flex-1 basis-32`}
          />
          {clubDecidesTeams && c.linked ? (
            <span className="flex basis-32 items-center text-sm text-gray-500">{c.teamLabel}</span>
          ) : teams.length > 0 && (
            <select value={c.team} onChange={(e) => set(i, { team: e.target.value })} aria-label={`Child ${i + 1}'s team`} className={`${field} basis-32`}>
              <option value="">Team…</option>
              {teams.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          {value.length > 1 && (
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Remove child ${i + 1}`} className="px-2 text-lg text-gray-400 hover:text-red-600">
              ×
            </button>
          )}
        </div>
      ))}
      {value.length < MAX_CHILDREN && (
        <button type="button" onClick={() => onChange([...value, { name: "", team: "" }])} className="self-start text-sm font-semibold text-green-700 hover:underline">
          + Add another child
        </button>
      )}
    </div>
  );
}
