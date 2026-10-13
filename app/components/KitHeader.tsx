import { getClub } from "@/lib/settings";
import { getTenant } from "@/lib/tenant";
import { SIGNED_OUT, getViewer } from "@/lib/viewer";
import AppHeader from "./AppHeader";
import { TopBar } from "./SettingsUI";


/** The kit pages' header: a large title on the Kit tab, the top bar on a team's form. */
export default async function KitHeader({
  back,
  title,
  subtitle,
}: {
  /** where the back button goes; none on the Kit tab's own page */
  back?: { href: string; label: string };
  title: string;
  subtitle: string;
}) {
  const CLUB = await getClub();
  // a team's form: a page you go into, with the back arrow and the title
  if (back) return <TopBar title={title} href={back.href} />;
  // the Kit tab itself: like Home — your photo, Search and the crest, then a large title
  const viewer = await getViewer(await getTenant()).catch(() => SIGNED_OUT);
  return (
    <header className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 pb-2 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <AppHeader viewer={viewer} crest={CLUB.crest} />
      <div className="min-w-0">
        <h1 className="text-[34px] font-extrabold leading-tight tracking-tight">{title}</h1>
        <p className="mt-0.5 truncate text-[15px] text-gray-500 dark:text-gray-400">
          {subtitle} · {CLUB.kitSeason} season
        </p>
      </div>
    </header>
  );
}

/** The kit pages' foot: the legal links, small. */
export async function KitFooter() {
  return (
    <p className="mt-8 pb-6 text-center text-xs text-gray-500 dark:text-gray-400">
      <a href="/privacy" className="hover:underline">Privacy</a>
      {" · "}
      <a href="/terms" className="hover:underline">Terms</a>
    </p>
  );
}
