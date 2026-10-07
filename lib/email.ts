// Sending email, through Resend (resend.com): password resets and welcome
// emails. Needs RESEND_API_KEY and EMAIL_FROM — a no-reply sender on a domain
// verified in Resend, e.g. "Grassroots Club Hub <noreply@grassroots-club-hub.co.uk>".
// Replies to emails that invite them go to PLATFORM_CONTACT_EMAIL (lib/legal.ts).
// Without them nothing is sent; the email is written to the server log
// instead, so it can still be tried out. Server only.

export const emailConfigured = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

/** Send an email. Returns false if it couldn't be sent. */
export async function sendEmail(msg: {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** where replies go; without it, the email is from the no-reply sender only */
  replyTo?: string;
}): Promise<boolean> {
  if (!emailConfigured()) {
    console.log(`[email not set up] To: ${msg.to}\nSubject: ${msg.subject}\n\n${msg.text}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
      }),
    });
    if (!res.ok) console.error("Email not sent:", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (e) {
    console.error("Email not sent:", e);
    return false;
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** A plain, readable email: a heading, some paragraphs and one button. */
export function simpleEmail(opts: { heading: string; paragraphs: string[]; button?: { label: string; url: string }; footer: string }) {
  const text = [opts.heading, "", ...opts.paragraphs, ...(opts.button ? ["", `${opts.button.label}: ${opts.button.url}`] : []), "", opts.footer].join("\n");
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
<h1 style="font-size:22px;margin:0 0 16px">${esc(opts.heading)}</h1>
${opts.paragraphs.map((p) => `<p style="font-size:15px;line-height:1.5;margin:0 0 12px">${esc(p)}</p>`).join("\n")}
${opts.button ? `<p style="margin:24px 0"><a href="${esc(opts.button.url)}" style="background:#16a34a;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px;display:inline-block">${esc(opts.button.label)}</a></p>` : ""}
<p style="font-size:12px;color:#6b7280;margin-top:28px">${esc(opts.footer)}</p></div>`;
  return { text, html };
}
