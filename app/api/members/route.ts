// Coach Admin → Members: the club's join code, whether the hub is private, and
// the people who've asked to join. Behind the coach password.
//   GET  ?key=…                                   -> { private, code, joinUrl, platformJoin, members }
//   POST ?key=… { action: "approve" | "decline" | "remove", id }
//   POST ?key=… { action: "newCode" }             -> a new join code (the old one stops working)
//   POST ?key=… { action: "private", value }      -> only approved members can open the hub (or anyone)
import { NextRequest, NextResponse } from "next/server";
import { showCode } from "@/lib/access";
import { isCoach } from "@/lib/adminAuth";
import { decide, getAccess, listMembers, renewCode, setPrivate } from "@/lib/members";
import { DEFAULT_TENANT, platformUrl, requireTenant, rootDomain, tenantUrl } from "@/lib/tenant";

export const dynamic = "force-dynamic";

async function snapshot(tenant: string) {
  const [access, members] = await Promise.all([getAccess(tenant), listMembers(tenant)]);
  return {
    private: access.private,
    code: showCode(access.code),
    joinUrl: tenantUrl(tenant, `/join?code=${access.code}`),
    // the platform's "join your club" box only finds clubs with their own address
    platformJoin: tenant !== DEFAULT_TENANT && rootDomain() ? platformUrl("/") : null,
    members,
  };
}

export async function GET(req: NextRequest) {
  if (!(await isCoach(req.nextUrl.searchParams.get("key") ?? ""))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  return NextResponse.json(await snapshot(await requireTenant()));
}

export async function POST(req: NextRequest) {
  if (!(await isCoach(req.nextUrl.searchParams.get("key") ?? ""))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const tenant = await requireTenant();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const action = body?.action;
  if (action === "approve" || action === "decline" || action === "remove") {
    if (!(await decide(tenant, String(body?.id ?? ""), action))) {
      return NextResponse.json({ error: "That person isn't on the list any more" }, { status: 404 });
    }
  } else if (action === "newCode") {
    await renewCode(tenant);
  } else if (action === "private") {
    await setPrivate(tenant, body?.value === true);
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  return NextResponse.json(await snapshot(tenant));
}
