// Help & Feedback from the Support page or the app (lib/feedback.ts).
//   POST { kind, message, name?, email?, page? } -> { ok }
// Signed in, the account's name and email are used. Kept for the platform
// admin's inbox and emailed to the platform's contact address. A few an hour
// from one place, so it can't be used to spam.
import { NextRequest, NextResponse } from "next/server";
import { currentUser, EMAIL } from "@/lib/auth";
import { sendEmail, simpleEmail } from "@/lib/email";
import { FEEDBACK_KINDS, addFeedback, type FeedbackKind } from "@/lib/feedback";
import { operator } from "@/lib/legal";
import { overLimit } from "@/lib/rateLimit";
import { PLATFORM_NAME, getTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const kind = (Object.keys(FEEDBACK_KINDS) as FeedbackKind[]).find((k) => k === body?.kind) ?? "question";
  const message = text(body?.message, 3000);
  if (message.length < 3) return NextResponse.json({ error: "Write your message first" }, { status: 400 });
  const user = await currentUser().catch(() => null);
  const email = user?.email ?? text(body?.email, 120).toLowerCase();
  if (!EMAIL.test(email)) return NextResponse.json({ error: "Enter your email, so we can reply" }, { status: 400 });
  if (await overLimit("feedback", 8, 3600)) {
    return NextResponse.json({ error: "That's a lot of messages — try again in an hour, or email us" }, { status: 429 });
  }
  const club = (await getTenant()) ?? "";
  const item = await addFeedback({
    kind,
    message,
    name: user?.name || text(body?.name, 80),
    email,
    club,
    page: text(body?.page, 200),
    device: (req.headers.get("user-agent") ?? "").slice(0, 200),
  });
  const to = operator().email;
  if (to) {
    await sendEmail({
      to,
      replyTo: email,
      subject: `${FEEDBACK_KINDS[kind]} from ${item.name || email}${club ? ` (${club})` : ""}`,
      ...simpleEmail({
        heading: `${FEEDBACK_KINDS[kind]}: ${PLATFORM_NAME}`,
        paragraphs: [
          message,
          `From ${item.name ? `${item.name} <${email}>` : email}${club ? `, club "${club}"` : ""}.`,
          `Page: ${item.page || "—"} · Device: ${item.device || "—"}`,
          "Reply to this email to answer them. It's also in Platform Admin → Feedback.",
        ],
        footer: PLATFORM_NAME,
      }),
    }).catch(() => false);
  }
  return NextResponse.json({ ok: true });
}
