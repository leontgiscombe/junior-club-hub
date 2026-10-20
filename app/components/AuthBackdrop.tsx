// The backdrop behind the sign-in, join and opening screens' cards: the club's
// crest (on the platform's own address, the app's logo), large and soft-focus
// over the club's dark green, so the screen feels like the club's own. The
// <main> it's in needs `relative isolate overflow-hidden`.
import { getClub } from "@/lib/settings";
import { getTenant } from "@/lib/tenant";

export const APP_LOGO = "/app-logo.jpg";

export default async function AuthBackdrop({ src: given }: { src?: string } = {}) {
  const tenant = given ? null : await getTenant();
  const src = given ?? (tenant ? (await getClub().catch(() => null))?.crest.src ?? APP_LOGO : APP_LOGO);
  return (
    <div aria-hidden="true" className="no-dark pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[var(--club-night,#04130a)]">
      <div className="absolute inset-0 bg-gradient-to-b from-green-700 via-green-900 to-[var(--club-night,#04130a)]" />
      {/* a big soft glow of it across the screen… */}
      {/* eslint-disable-next-line @next/next/no-img-element -- the club's own picture, any size */}
      <img
        src={src}
        alt=""
        className="absolute left-1/2 top-[-12vmin] h-[120vmin] w-[120vmin] max-w-none -translate-x-1/2 object-contain opacity-50 blur-3xl saturate-150"
      />
      {/* …and the crest itself, soft-focus, at the top above the card */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="absolute left-1/2 top-[max(1.5rem,env(safe-area-inset-top))] h-[62vmin] max-h-80 w-[62vmin] max-w-80 -translate-x-1/2 object-contain opacity-30 blur-[6px]"
      />
      {/* darker towards the bottom, so the card stands out */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/25 to-black/60" />
    </div>
  );
}
