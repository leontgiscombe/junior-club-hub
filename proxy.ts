// Sends each request to the right part of the app. With ROOT_DOMAIN set, the
// root domain is the platform's own site (lib/tenant.ts): its home page and
// sign-up live under /platform, and anything else there goes home. A club's
// own address never shows the platform pages.
//
// A club that has made its hub private (Coach Admin → Members) only opens for
// people a coach has approved — signed in with an account, or (from before
// accounts) on a phone that was approved (lib/access.ts); anyone else is sent
// to its join page. Coach Admin stays open, as it has its own password, and so do the
// coaches' APIs (every one checks the coach password itself).
import { NextResponse, type NextRequest } from "next/server";
import {
  MEMBER_COOKIE,
  PATH_HEADER,
  PLAYER_COOKIE,
  SESSION_COOKIE,
  cachedAccess,
  isApprovedMember,
  isApprovedPerson,
  playerSession,
  sessionUserId,
} from "./lib/access";
import { noteActive, pausedClub } from "./lib/clubStatus";
import { tenantFromHost } from "./lib/tenantHost";
import { isAppUserAgent } from "./lib/inApp";

// what the platform's site needs: its pages and APIs, plus shared images
const PLATFORM_PATHS = [/^\/platform(\/|$)/, /^\/(signin|account)(\/|$)/, /^\/api\/(signup|clubs|health|platform-admin|billing\/revenuecat|cron-backup|cron-trial|finance\/cron-remind|auth|account|player\/find|feedback)(\/|$)/, /^\/(privacy|terms|support)$/, /^\/poster\//, /\.(png|jpe?g|svg|webp|ico)$/];

// what a private club's hub shows people who aren't members yet: the join
// page, Coach Admin, password resets, the legal pages, pictures and files —
// and every API except the few that serve the club's own pages to anyone
const OPEN_TO_ALL = [
  /^\/join$/,
  // setting up a player's own device with a code
  /^\/player$/,
  /^\/(signin|account)(\/|$)/,
  /^\/admin(\/|$)/,
  /^\/reset-password$/,
  /^\/(privacy|terms|support)$/,
  /^\/manifest\.webmanifest$/,
  /^\/poster\//,
  /^\/api\/(?!(club|submit|finance\/team|finance\/push)$)/,
  /\.(png|jpe?g|svg|webp|ico|js|css|woff2?|txt|webmanifest)$/,
];

// all a player's own device can open (lib/playerDevices.ts): the Training Hub,
// the APIs it uses, the setup page, the legal pages, and pictures and files
const PLAYER_PATHS = [
  /^\/training-hub(\/|$)/,
  /^\/player$/,
  /^\/api\/(club|auth\/me|me\/club|player\/(me|progress|signout|link))$/,
  /^\/(privacy|terms|support)$/,
  /^\/manifest\.webmanifest$/,
  /^\/poster\//,
  /\.(png|jpe?g|svg|webp|ico|js|css|woff2?|txt|webmanifest)$/,
];

export async function proxy(req: NextRequest) {
  const tenant = tenantFromHost(req.headers.get("host") ?? "");
  const { pathname } = req.nextUrl;
  // Apple's association file, the same on every address and never behind a club's door
  if (pathname === "/.well-known/apple-app-site-association") {
    return NextResponse.rewrite(new URL("/api/apple-app-site-association", req.url));
  }
  if (tenant === null) {
    // in the App Store app, the platform's home and sign-up (with its prices) are the
    // opening screen instead: nothing there points to paying on the website (lib/inApp.ts)
    const app = isAppUserAgent(req.headers.get("user-agent"));
    if (pathname === "/") return NextResponse.rewrite(new URL(app ? "/platform/start" : "/platform", req.url));
    if (pathname === "/signup") return NextResponse.rewrite(new URL(app ? "/platform/start" : "/platform/signup", req.url));
    // the app's opening screen: find your club, as a player or a grown-up
    if (pathname === "/start") return NextResponse.rewrite(new URL("/platform/start", req.url));
    if (!PLATFORM_PATHS.some((p) => p.test(pathname))) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }
  if (pathname.startsWith("/platform")) return NextResponse.redirect(new URL("/", req.url));
  // the page's path, for the layout (which leaves the club's teams out of the
  // pages a private club shows to everyone)
  const headers = new Headers(req.headers);
  headers.set(PATH_HEADER, pathname);
  const pass = () => NextResponse.next({ request: { headers } });

  // pictures and files are always served (the paused page uses them)
  const asset = /\.(png|jpe?g|svg|webp|ico|js|css|woff2?|txt|webmanifest)$/.test(pathname) || pathname.startsWith("/poster/");
  // paused by the platform admin (nothing deleted): every page says so, and the APIs refuse
  if (!asset && pathname !== "/api/health") {
    let paused = null;
    try {
      paused = await pausedClub(tenant);
    } catch {}
    // signing in, your account, help and the plans stay open: a club admin can still sort it out
    const stillOpen = /^\/(signin|account|support|plans|privacy|terms)(\/|$)|^\/api\/(auth|account|feedback)(\/|$)/.test(pathname);
    if (paused && !stillOpen) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ error: "This club's hub is paused" }, { status: 423 });
      headers.set(PATH_HEADER, "/paused");
      return NextResponse.rewrite(new URL("/paused", req.url), { request: { headers } });
    }
    // when the club was last used, for the platform admin (pages only, at most hourly)
    if (!pathname.startsWith("/api/")) noteActive(tenant);
  }

  // A player's own device, with no grown-up signed in on it, keeps to the
  // Training Hub: other pages go back there and other APIs are refused.
  const playerToken = req.cookies.get(PLAYER_COOKIE)?.value;
  if (playerToken) {
    let restricted: boolean;
    try {
      const adult = await sessionUserId(req.cookies.get(SESSION_COOKIE)?.value ?? "");
      restricted = !adult && !!(await playerSession(tenant, playerToken));
    } catch {
      // the database can't be reached: stay on the safe side
      restricted = true;
    }
    if (restricted) {
      if (PLAYER_PATHS.some((p) => p.test(pathname))) return pass();
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "This device is set up for the Training Hub only" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/training-hub", req.url));
    }
  }

  if (OPEN_TO_ALL.some((p) => p.test(pathname))) return pass();

  try {
    if (!(await cachedAccess(tenant)).private) return pass();
    if (await isApprovedMember(tenant, req.cookies.get(MEMBER_COOKIE)?.value ?? "")) return pass();
    if (await isApprovedPerson(tenant, req.cookies.get(SESSION_COOKIE)?.value ?? "")) return pass();
  } catch {
    // the database can't be reached: the page itself will say so
    return pass();
  }
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Only the club's members can use this — ask a coach to approve you" }, { status: 403 });
  }
  return NextResponse.redirect(new URL("/join", req.url));
}

export const config = {
  // everything except Next's own files
  matcher: ["/((?!_next/).*)"],
};
