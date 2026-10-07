// Sends each request to the right part of the app. With ROOT_DOMAIN set, the
// root domain is the platform's own site (lib/tenant.ts): its home page and
// sign-up live under /platform, and anything else there goes home. A club's
// own address never shows the platform pages.
//
// A club that has made its hub private (Coach Admin → Members) only opens for
// phones a coach has approved (lib/access.ts); anyone else is sent to its join
// page. Coach Admin stays open, as it has its own password, and so do the
// coaches' APIs (every one checks the coach password itself).
import { NextResponse, type NextRequest } from "next/server";
import { MEMBER_COOKIE, cachedAccess, isApprovedMember } from "./lib/access";
import { tenantFromHost } from "./lib/tenantHost";

// what the platform's site needs: its pages and APIs, plus shared images
const PLATFORM_PATHS = [/^\/platform(\/|$)/, /^\/api\/(signup|clubs|health|platform-admin|cron-backup|finance\/cron-remind)(\/|$)/, /^\/(privacy|terms)$/, /^\/poster\//, /\.(png|jpe?g|svg|webp|ico)$/];

// what a private club's hub shows people who aren't members yet: the join
// page, Coach Admin, password resets, the legal pages, pictures and files —
// and every API except the few that serve the club's own pages to anyone
const OPEN_TO_ALL = [
  /^\/join$/,
  /^\/admin(\/|$)/,
  /^\/reset-password$/,
  /^\/(privacy|terms)$/,
  /^\/manifest\.webmanifest$/,
  /^\/poster\//,
  /^\/api\/(?!(club|submit|finance\/team|finance\/push)$)/,
  /\.(png|jpe?g|svg|webp|ico|js|css|woff2?|txt|webmanifest)$/,
];

export async function proxy(req: NextRequest) {
  const tenant = tenantFromHost(req.headers.get("host") ?? "");
  const { pathname } = req.nextUrl;
  if (tenant === null) {
    if (pathname === "/") return NextResponse.rewrite(new URL("/platform", req.url));
    if (pathname === "/signup") return NextResponse.rewrite(new URL("/platform/signup", req.url));
    if (!PLATFORM_PATHS.some((p) => p.test(pathname))) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }
  if (pathname.startsWith("/platform")) return NextResponse.redirect(new URL("/", req.url));
  if (OPEN_TO_ALL.some((p) => p.test(pathname))) return NextResponse.next();

  try {
    if (!(await cachedAccess(tenant)).private) return NextResponse.next();
    if (await isApprovedMember(tenant, req.cookies.get(MEMBER_COOKIE)?.value ?? "")) return NextResponse.next();
  } catch {
    // the database can't be reached: the page itself will say so
    return NextResponse.next();
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
