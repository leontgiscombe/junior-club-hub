// Notifications, behind the bell in the header (components/NotificationBell.tsx):
// what the hub has told this member, newest first (lib/inbox.ts). The ones
// that came since they last looked are highlighted; opening the page clears
// the bell's red number (MarkSeen).
import Link from "next/link";
import { redirect } from "next/navigation";
import { TopBar } from "../components/SettingsUI";
import MarkSeen from "./MarkSeen";
import { readInbox, type InboxItem, type InboxKind } from "@/lib/inbox";
import { currentPerson } from "@/lib/people";
import { getClub } from "@/lib/settings";
import { getTenant } from "@/lib/tenant";
import { TILE_COLOURS } from "@/lib/tileColours";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const club = await getClub();
  return { title: `Notifications – ${club.name}` };
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const star = <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />;
const people = <><circle cx="9" cy="8" r="3.2" /><path d="M3 19a6 6 0 0 1 12 0M19 8v6M16 11h6" /></>;
const shirt = <path d="M8 3 4 5.5 2.5 10l3 1.2V21h13v-9.8l3-1.2L20 5.5 16 3a4 4 0 0 1-8 0z" />;

// each kind's tile: its colour (lib/tileColours.ts) and drawing
const TILE: Record<InboxKind, { colour: string; icon: React.ReactNode }> = {
  result: { colour: TILE_COLOURS.results, icon: <><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8" /></> },
  potm: { colour: TILE_COLOURS.potm, icon: star },
  awards: { colour: TILE_COLOURS.awards, icon: star },
  kit: { colour: TILE_COLOURS.kit, icon: shirt },
  join: { colour: TILE_COLOURS.members, icon: people },
  child: { colour: TILE_COLOURS.members, icon: people },
  approved: { colour: TILE_COLOURS.hub, icon: <><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.7 2.7L16 9.8" /></> },
  subs: { colour: TILE_COLOURS.finances, icon: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></> },
};

/** "Just now", "5 min ago", "3h ago", "Yesterday", or "12 Oct". */
function when(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  if (min < 24 * 60) return `${Math.floor(min / 60)}h ago`;
  if (min < 48 * 60) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
}

function Item({ item, fresh }: { item: InboxItem; fresh: boolean }) {
  const tile = TILE[item.kind] ?? TILE.approved;
  const inner = (
    <>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white ${tile.colour}`}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" {...stroke}>{tile.icon}</svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-semibold text-gray-900 dark:text-gray-50">{item.title}</span>
          <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{when(item.at)}</span>
        </span>
        <span className="mt-0.5 block text-sm text-gray-600 dark:text-gray-300">{item.body}</span>
      </span>
      {fresh && <span aria-label="New" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />}
    </>
  );
  const className = `flex items-start gap-3 px-4 py-3.5 ${fresh ? "bg-green-50/70 dark:bg-green-400/10" : ""}`;
  return item.url ? (
    <Link href={item.url} className={`press ${className}`}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}

export default async function NotificationsPage() {
  const tenant = await getTenant();
  if (!tenant) redirect("/");
  const me = await currentPerson(tenant).catch(() => null);
  if (!me) redirect("/signin?next=/notifications");
  const approved = me.person?.status === "approved";
  const { items, seenAt } = approved && me.person ? await readInbox(tenant, me.person).catch(() => ({ items: [], seenAt: "" })) : { items: [], seenAt: "" };

  return (
    <main className="themed min-h-screen bg-[#f2f2f7] pb-12 text-gray-900 dark:bg-black dark:text-gray-50">
      <TopBar title="Notifications" href="/" />
      <MarkSeen />
      <div className="mx-auto max-w-xl px-4">
        {items.length ? (
          <div className="mt-2 divide-y divide-gray-100 overflow-hidden rounded-3xl bg-white shadow-sm dark:divide-white/10 dark:bg-[#1c1c1e]">
            {items.map((item) => (
              <Item key={item.id} item={item} fresh={item.at > seenAt} />
            ))}
          </div>
        ) : (
          <div className="mt-2 flex flex-col items-center rounded-3xl bg-white px-6 py-10 text-center shadow-sm dark:bg-[#1c1c1e]">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400">
              <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true" {...stroke}>
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
            </span>
            <p className="mt-4 font-semibold">No notifications yet</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {approved
                ? "Your team's results, Player of the Month and news from the club will show here."
                : "Once a coach has approved you, news from the club will show here."}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
