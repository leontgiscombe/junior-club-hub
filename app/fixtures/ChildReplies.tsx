// "Can Cian come?": a parent's answer for each of their own children invited
// to a game. On a family's game page, and at the top of a coach's when the
// coach is a parent too.
import type { Reply } from "@/lib/fixtures";
import { deadlineWords } from "@/lib/fixtureFormat";
import { ReplyToggle } from "./FixtureControls";
import { Avatar, card, heading, sub } from "./GameParts";

const first = (name: string) => name.split(/\s+/)[0];

export default function ChildReplies({
  matchId,
  kids,
  replies,
  open,
  deadline,
  closed,
}: {
  matchId: string;
  kids: { playerId: string; name: string }[];
  replies: Record<string, Reply>;
  /** answers can still change */
  open: boolean;
  deadline: string;
  /** the reply-by time has gone (a coach can still answer) */
  closed: boolean;
}) {
  if (!kids.length) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className={heading}>{kids.length > 1 ? "Can they come?" : `Can ${first(kids[0].name)} come?`}</h2>
      <div className={`${card} divide-y divide-gray-100 overflow-hidden dark:divide-white/10`}>
        {kids.map((k) => {
          const r = replies[k.playerId];
          return (
            <div key={k.playerId} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
              <Avatar name={k.name} tone={r?.answer === "yes" ? "green" : "gray"} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{first(k.name)}</span>
                <span className={`block text-xs ${r ? sub : "font-semibold text-amber-600 dark:text-amber-400"}`}>
                  {r ? (r.answer === "yes" ? "Coming" : "Not coming") : "Please answer"}
                </span>
              </span>
              {open && <ReplyToggle wide matchId={matchId} playerId={k.playerId} initial={r?.answer ?? null} initialNote={r?.note ?? ""} labels={["Coming", "Can't come"]} />}
            </div>
          );
        })}
      </div>
      <p className={`px-1 text-xs ${sub}`}>
        {closed
          ? "The reply-by time has passed. Message the coaches if anything's changed."
          : deadline
            ? `Please answer by ${deadlineWords(deadline)}.`
            : "You can change your answer any time before the game."}
      </p>
    </section>
  );
}
