// Search: the app's pages and settings, and — for those allowed to see them —
// the club's players, matches, members, drills and kit requests.
import SearchView from "../components/SearchView";
import { getClub } from "@/lib/settings";
import { getTenant } from "@/lib/tenant";
import { SIGNED_OUT, getViewer } from "@/lib/viewer";
import { HELP_SECTIONS, PAGES } from "@/lib/searchIndex";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search" };

export default async function SearchPage() {
  const tenant = await getTenant();
  const [CLUB, viewer] = await Promise.all([getClub(), getViewer(tenant).catch(() => SIGNED_OUT)]);
  // only the pages this person can use, in the parts of the hub the club has on
  const pages = PAGES.filter(
    (p) =>
      (!p.feature || CLUB.features[p.feature]) &&
      (p.href !== "/results" || CLUB.publicResults) &&
      (p.who === "all" ||
        (p.who === "signedIn" && viewer.signedIn) ||
        (p.who === "coach" && viewer.canCoach) ||
        (p.who === "finance" && viewer.canFinance)) &&
      !(p.href === "/signin" && viewer.signedIn),
  );
  const help = viewer.canCoach ? HELP_SECTIONS : [];
  return (
    <SearchView
      pages={pages}
      help={help}
      // only signed-in people have club data to search
      searchData={viewer.signedIn}
      hint={viewer.canCoach ? "Try a player, an opponent, a drill, or “training times”" : viewer.signedIn ? "Try “kit”, an opponent, or “dark mode”" : "Try “kit”, “results” or “training”"}
    />
  );
}
