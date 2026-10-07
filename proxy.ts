// Sends each request to the right part of the app. With ROOT_DOMAIN set, the
// root domain is the platform's own site (lib/tenant.ts): its home page and
// sign-up live under /platform, and anything else there goes home. A club's
// own address never shows the platform pages.
import { NextResponse, type NextRequest } from "next/server";
import { tenantFromHost } from "./lib/tenantHost";

// what the platform's site needs: its pages and APIs, plus shared images
const PLATFORM_PATHS = [/^\/platform(\/|$)/, /^\/api\/(signup|clubs|health|platform-admin|cron-backup|finance\/cron-remind)(\/|$)/, /^\/(privacy|terms)$/, /^\/poster\//, /\.(png|jpe?g|svg|webp|ico)$/];

export function proxy(req: NextRequest) {
  const tenant = tenantFromHost(req.headers.get("host") ?? "");
  const { pathname } = req.nextUrl;
  if (tenant === null) {
    if (pathname === "/") return NextResponse.rewrite(new URL("/platform", req.url));
    if (pathname === "/signup") return NextResponse.rewrite(new URL("/platform/signup", req.url));
    if (!PLATFORM_PATHS.some((p) => p.test(pathname))) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }
  if (pathname.startsWith("/platform")) return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}

export const config = {
  // everything except Next's own files
  matcher: ["/((?!_next/).*)"],
};
