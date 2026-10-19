// Whether an email looks like a club's shared address (secretary@…, info@…,
// riversiderovers@…) rather than one person's own — the sign-up form then
// suggests a personal email, because the email you sign up with is your own
// account, not the club's. Only a hint: nothing is refused. No server imports.

// words that usually mean a club's or an office's address, not a person's
const SHARED = /(^|[^a-z])(club|clubs|fc|jfc|afc|cfc|juniors?|youth|academy|united|utd|rovers|athletic|town|city|wanderers|rangers|albion|sports?|football|info|hello|enquiries|enquiry|contact|office|admin|secretary|sec|chair|chairman|committee|treasurer|membership|welfare|team|teams)([^a-z]|$)/;

/** true if `email` looks shared: a club-ish word, or a word of the club's name, before the @. */
export function looksShared(email: string, clubName = ""): boolean {
  const local = email.trim().toLowerCase().split("@")[0] ?? "";
  if (!local || !email.includes("@")) return false;
  // split joined-up words a little: "pudseyjuniorsjfc" still has "jfc" at the end
  if (SHARED.test(local.replace(/(fc|jfc|afc|juniors?|united|rovers|club)$/, ".$1"))) return true;
  const squashed = local.replace(/[^a-z0-9]/g, "");
  return clubName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !/^(junior|juniors|football|club|united|town|city)$/.test(w))
    .some((w) => squashed.includes(w));
}
