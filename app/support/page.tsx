// Support: answers to the common questions, and Help & Feedback (a question,
// a problem or a suggestion) — on the platform's address and every club's.
// Open to everyone, signed in or not: it's the App Store's support page too.
import { LegalPage, Part } from "../components/LegalPage";
import FeedbackForm from "../components/FeedbackForm";
import { currentUser } from "@/lib/auth";
import { operator } from "@/lib/legal";
import { PLATFORM_NAME } from "@/lib/tenant";

export const metadata = { title: `Help & Support – ${PLATFORM_NAME}` };
export const dynamic = "force-dynamic";

const FAQ: [string, string][] = [
  ["How do I sign in?", "Type your email and we send a 6-digit code — there's no password. Then add a passkey (Your Account → Sign-In & Security) and sign in with Face ID or a fingerprint from then on."],
  ["The code hasn't arrived", "Check your junk or spam folder, and that the email address is right. You can ask for another after a minute; each code works for 15 minutes."],
  ["How do I join my child's club?", "Open the join link your club shares (by WhatsApp, email or a QR code at training), sign in with your email, and add your child. A coach approves you, and then you see your child's team."],
  ["I'm a coach — how do I get into Coach Admin?", "A club admin invites you by email, or gives you the Coach role in Members. Sign in with that email and tap Coach."],
  ["How do I add another child, or change their details?", "Your Account → Your Children. Their photo, medical notes and emergency contact are there too; only you and the club's coaches see those."],
  ["Who can see my child's information?", "Only your club's coaches and members, and medical notes and photos only the child's own parents or carers and the coaches. See the Privacy Policy for the details."],
  ["How do I open Finances?", "A team's treasurer and the club's admins open it with Face ID (or straight away, without a passkey); anyone else needs that team's password."],
  ["How do I delete my account?", "Your Account → Delete Account. It removes your account, passkeys and your place in each club straight away."],
];

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const [user, { kind }] = await Promise.all([currentUser().catch(() => null), searchParams]);
  const contact = operator().email;
  return (
    <LegalPage title="Help & Support" intro={`Answers to the common questions about ${PLATFORM_NAME}, and a way to ask us anything, report a problem or suggest something.`}>
      <Part title="Common Questions">
        <dl className="flex flex-col gap-3">
          {FAQ.map(([q, a]) => (
            <div key={q}>
              <dt className="font-bold text-gray-900 dark:text-gray-50">{q}</dt>
              <dd>{a}</dd>
            </div>
          ))}
        </dl>
      </Part>
      <Part title="Ask Us, Report a Problem or Suggest Something">
        <div id="contact">
          <FeedbackForm signedIn={!!user} initialKind={kind === "problem" || kind === "idea" ? kind : "question"} />
        </div>
        {contact && (
          <p className="text-sm">
            Or email{" "}
            <a href={`mailto:${contact}`} className="font-semibold text-green-700 underline dark:text-green-400">
              {contact}
            </a>
            . A question about your child&apos;s details is best asked of your club first.
          </p>
        )}
      </Part>
    </LegalPage>
  );
}
