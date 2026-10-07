// Joining a club, on its own address (lib/access.ts).
//   GET                          -> { private, status: "none" | "pending" | "approved" | "declined" }
//   POST { code, name, note? }   -> { status: "open" } if the hub is open to all, or
//                                   { status: "pending" } with this phone's member cookie set;
//                                   the club's email hears there's someone to approve.
import { NextRequest, NextResponse } from "next/server";
import { MEMBER_COOKIE, MEMBER_COOKIE_MAX_AGE, normaliseCode, readMember } from "@/lib/access";
import { clientIp } from "@/lib/clientIp";
import { sendEmail, simpleEmail } from "@/lib/email";
import { rawKv } from "@/lib/kv";
import { getAccess, requestToJoin } from "@/lib/members";
import { getClub } from "@/lib/settings";
import { DEFAULT_TENANT, PLATFORM_NAME, getTenant, tenantUrl } from "@/lib/tenant";
import { getTenantRecord, tenantExists } from "@/lib/tenants";

export const dynamic = "force-dynamic";

async function club(): Promise<string | null> {
  const tenant = await getTenant();
  return tenant && (await tenantExists(tenant)) ? tenant : null;
}

export async function GET(req: NextRequest) {
  const tenant = await club();
  if (!tenant) return NextResponse.json({ error: "No club here" }, { status: 404 });
  const [access, member] = await Promise.all([
    getAccess(tenant),
    readMember(tenant, req.cookies.get(MEMBER_COOKIE)?.value ?? ""),
  ]);
  return NextResponse.json({ private: access.private, status: member?.status ?? "none" });
}

export async function POST(req: NextRequest) {
  const tenant = await club();
  if (!tenant) return NextResponse.json({ error: "No club here" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 60) : "";
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 120) : "";
  const code = typeof body?.code === "string" ? normaliseCode(body.code) : "";

  // a few tries an hour from one place, so codes can't be guessed
  const kv = await rawKv();
  if (!kv) return NextResponse.json({ error: "Storage isn't set up" }, { status: 503 });
  const ipKey = `platform:join-ip:${clientIp(req.headers)}`;
  const tries = await kv.incr(ipKey);
  if (tries === 1) await kv.expire(ipKey, 3600);
  if (tries > 10) return NextResponse.json({ error: "Too many tries — try again later" }, { status: 429 });

  const access = await getAccess(tenant);
  if (code !== access.code) {
    return NextResponse.json({ error: "That isn't this club's code — check it with your coach" }, { status: 400 });
  }
  if (!access.private) return NextResponse.json({ status: "open" });
  if (!name) return NextResponse.json({ error: "Enter your name, so the coaches know who you are" }, { status: 400 });

  const token = await requestToJoin(tenant, { name, note });
  const res = NextResponse.json({ status: "pending" });
  res.cookies.set(MEMBER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https",
    maxAge: MEMBER_COOKIE_MAX_AGE,
    path: "/",
  });

  // let the club know — at most one email every half hour
  if (tenant !== DEFAULT_TENANT && (await kv.set(`platform:join-email:${tenant}`, 1, { nx: true, ex: 1800 }))) {
    const record = await getTenantRecord(tenant);
    const clubInfo = await getClub();
    if (record) {
      await sendEmail({
        to: record.email,
        subject: `Someone wants to join ${clubInfo.name}`,
        ...simpleEmail({
          heading: "A new request to join",
          paragraphs: [
            `${name}${note ? ` (${note})` : ""} has asked to join ${clubInfo.name}'s hub.`,
            "Approve or decline them in Coach Admin → Members.",
          ],
          button: { label: "Open Members", url: tenantUrl(tenant, "/admin/members") },
          footer: `${PLATFORM_NAME} · ${tenantUrl(tenant)}`,
        }),
      }).catch(() => false);
    }
  }
  return res;
}
