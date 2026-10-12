// A person's mobile number, as they typed it (for the club's WhatsApp
// reminders about subs): kept as typed, once it looks like a phone number.

/** "" for none, the number tidied up, or null if it isn't a phone number. */
export function cleanPhone(v: unknown): string | null {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/\s+/g, " ");
  if (!s) return "";
  if (!/^\+?[\d ()-]+$/.test(s)) return null;
  const digits = s.replace(/\D/g, "").length;
  return digits >= 7 && digits <= 15 ? s.slice(0, 24) : null;
}

export const BAD_PHONE = "That doesn't look like a phone number — check it and try again";
export const NEED_PHONE = "Enter your mobile number, so the club can reach you";
