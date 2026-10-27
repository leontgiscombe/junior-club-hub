// The backdrop behind the sign-in, join and opening screens' cards: the app's
// own light grey (black in dark mode), with a soft glow of the club's crest
// (on the platform's own address, the app's logo) at the top, so the screen
// feels like the club's own and like the rest of the app. The <main> it's in
// needs `relative isolate overflow-hidden`.
import { getClub } from "@/lib/settings";
import { getTenant } from "@/lib/tenant";

export const APP_LOGO = "/app-logo.jpg";

export default async function AuthBackdrop({ src: given }: { src?: string } = {}) {
  const tenant = given ? null : await getTenant();
  const src = given ?? (tenant ? (await getClub().catch(() => null))?.crest.src ?? APP_LOGO : APP_LOGO);
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[#f2f2f7] dark:bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element -- the club's own picture, any size */}
      <img
        src={src}
        alt=""
        className="absolute left-1/2 top-[-30vmin] h-[100vmin] w-[100vmin] max-w-none -translate-x-1/2 object-contain opacity-25 blur-3xl saturate-150 dark:opacity-30"
      />
    </div>
  );
}
