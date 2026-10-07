// The privacy policy, for the platform's site and every club's hub. Written
// for UK GDPR: the platform is the controller for clubs' accounts and a
// processor for the data clubs keep about their players and parents.
import { List, LegalPage, Part } from "../components/LegalPage";
import { operator } from "@/lib/legal";
import { PLATFORM_NAME } from "@/lib/tenant";

export const metadata = { title: `Privacy Policy – ${PLATFORM_NAME}` };

export default function PrivacyPage() {
  const op = operator();
  const contact = op.email ? (
    <a href={`mailto:${op.email}`} className="font-semibold text-green-700 underline">
      {op.email}
    </a>
  ) : (
    "the contact details on our website"
  );

  return (
    <LegalPage
      title="Privacy Policy"
      intro={`${PLATFORM_NAME} gives junior football clubs their own team hub: match and training logs, kit sizes, player of the month, subs and a training app for the players. This policy explains what information the hub keeps, why, who looks after it and what your rights are. We've kept it in plain English.`}
    >
      <Part title="1. Who we are">
        <p>
          {PLATFORM_NAME} is run by {op.name}. For any question about this policy or your
          information, contact us at {contact}.
        </p>
      </Part>

      <Part title="2. Two kinds of information, two roles">
        <List
          items={[
            <>
              <strong>Clubs&apos; accounts</strong> — the club&apos;s name, web address, contact email
              and coach password. We decide how this is used, so for this information we are the{" "}
              <strong>controller</strong>.
            </>,
            <>
              <strong>What a club keeps about its players and parents</strong> — squad lists, match
              and training records, kit sizes and so on. The club decides what goes in and why, so
              the <strong>club is the controller</strong> and we are its <strong>processor</strong>:
              we store and show it only to run the club&apos;s hub, as the club asks.
            </>,
          ]}
        />
        <p>
          If you&apos;re a parent with a question about your child&apos;s information, please ask
          your club first — they&apos;re responsible for it. We&apos;ll help them answer.
        </p>
      </Part>

      <Part title="3. What the hub keeps">
        <List
          items={[
            <>
              <strong>Club account:</strong> club name, web address, contact email, and the coach
              password — stored scrambled (hashed), so nobody, including us, can read it.
            </>,
            <>
              <strong>Club settings:</strong> crest, colours, slogan, teams and their league details.
            </>,
            <>
              <strong>Players:</strong> names as coaches enter them, and football information — games
              played, goals, assists, awards, positions, training attendance and awards.
            </>,
            <>
              <strong>Kit sizes:</strong> the child&apos;s name and their shirt, shorts and sock sizes,
              sent by a parent. The public form only ever shows a first name and initial.
            </>,
            <>
              <strong>Results page (if the club turns it on):</strong> scores and top scorers, with
              players shown by first name and initial only.
            </>,
            <>
              <strong>Financial Admin:</strong> subs, payments, parent contact details, notes and
              spending. This is <strong>encrypted on the coach&apos;s device</strong> with the
              team&apos;s own password before it&apos;s sent to us, so we only ever hold scrambled
              data we cannot read.
            </>,
            <>
              <strong>Your account (if you have one):</strong> your email address and name, the clubs
              you belong to and your role at each (e.g. coach, parent), and a cookie that keeps you
              signed in on your device. There&apos;s no password — you sign in with a code we email
              you. You can delete your account at any time from its page.
            </>,
            <>
              <strong>Members (if the club makes its hub private):</strong> the name of each person
              who asks to join, whether they&apos;re a parent, player or coach, their team, a parent&apos;s
              own child&apos;s name (as they type it, seen only by the club&apos;s coaches), whether a
              coach approved them, and a cookie on their phone that remembers they&apos;re approved.
              It&apos;s only used to let them in.
            </>,
            <>
              <strong>Reminders:</strong> if a coach turns on subs reminders, their browser&apos;s
              notification address (no personal details).
            </>,
            <>
              <strong>Kept only on your own device, never sent to us:</strong> the players&apos;
              Training Hub quiz scores and challenge ticks, photos added to Player of the Month
              posters, and small settings like which team a coach looks after.
            </>,
            <>
              <strong>Technical records:</strong> like any website, our host keeps short-lived logs
              (such as IP address and browser) to keep the service running and secure.
            </>,
          ]}
        />
        <p>
          We don&apos;t show adverts, use tracking or advertising cookies, or sell or share
          information for marketing.
        </p>
      </Part>

      <Part title="4. Why we use it (lawful basis)">
        <List
          items={[
            <>
              Club accounts: to provide the service the club signed up for (<em>contract</em>), and
              to keep it secure and send essential emails such as password resets (
              <em>legitimate interests</em>).
            </>,
            <>
              Players&apos; and parents&apos; information: the club chooses its lawful basis —
              usually <em>legitimate interests</em> in running the club, or <em>consent</em> — and
              should tell its members. We process it only on the club&apos;s instructions.
            </>,
          ]}
        />
      </Part>

      <Part title="5. Children">
        <p>
          The hub is used by coaches and parents. Children&apos;s information is entered by adults
          and kept to what a club needs to run its teams: names and football information. The
          players&apos; Training Hub doesn&apos;t ask for or send any personal information. Clubs
          should only add photos of a child with the parent&apos;s permission.
        </p>
      </Part>

      <Part title="6. Who helps us run the service">
        <p>These companies process information for us, under contracts that protect it:</p>
        <List
          items={[
            <>
              <strong>Render</strong> — hosts the website (servers in Frankfurt, Germany).
            </>,
            <>
              <strong>Upstash</strong> — the database (in the EU).
            </>,
            <>
              <strong>Resend</strong> — sends our emails (password resets, welcome emails).
            </>,
            <>
              <strong>Sentry</strong> — tells us when something in the hub goes wrong. Its reports
              have passwords and personal details removed before they&apos;re sent.
            </>,
            <>
              <strong>Cloudflare</strong> — part of our host&apos;s network, protecting the site and
              delivering it quickly.
            </>,
            <>
              <strong>Apple, Google or Mozilla</strong> — deliver notifications, if a coach turns
              them on.
            </>,
          ]}
        />
        <p>
          Some of these providers may handle information outside the UK; where they do, it&apos;s
          protected by the safeguards UK law requires, such as standard contractual clauses.
        </p>
      </Part>

      <Part title="7. How long we keep it">
        <p>
          A club&apos;s information is kept while the club uses its hub, and coaches can remove
          players, kit responses and other records whenever they like. When a club closes its hub
          or asks us to, we delete all of its information, normally within 30 days. Technical logs
          are kept for a short time only.
        </p>
      </Part>

      <Part title="8. Keeping it safe">
        <p>
          Everything travels over an encrypted connection (HTTPS). Coach passwords are stored
          hashed, Financial Admin is encrypted on the device, and each club&apos;s information is
          kept separate from every other club&apos;s.
        </p>
      </Part>

      <Part title="9. Your rights">
        <p>
          You can ask to see the information held about you or your child, to have it corrected or
          deleted, or to object to how it&apos;s used. For a club&apos;s records, ask the club; for
          anything else, contact us at {contact}. You also have the right to complain to the
          Information Commissioner&apos;s Office at{" "}
          <a href="https://ico.org.uk" className="font-semibold text-green-700 underline">ico.org.uk</a>.
        </p>
      </Part>

      <Part title="10. Changes">
        <p>
          If we change this policy we&apos;ll update the date at the top, and tell clubs about
          anything important by email.
        </p>
      </Part>
    </LegalPage>
  );
}
