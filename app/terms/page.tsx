// The terms a club agrees to when it signs up, including the data-processing
// terms UK GDPR asks for between a club (controller) and the platform
// (processor).
import Link from "next/link";
import { List, LegalPage, Part } from "../components/LegalPage";
import { operator } from "@/lib/legal";
import { PLATFORM_NAME } from "@/lib/tenant";

export const metadata = { title: `Terms of Use – ${PLATFORM_NAME}` };

export default function TermsPage() {
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
      title="Terms of Use"
      intro={`These terms apply when a club signs up for ${PLATFORM_NAME}, which is run by ${op.name}. By signing up, the person doing so agrees to them on the club's behalf.`}
    >
      <Part title="1. Signing up">
        <List
          items={[
            "You must be 18 or over and allowed to act for the club.",
            "Keep the club's email up to date — it's where password resets go.",
            "Keep the coach password safe and share it only with the club's coaches. If you think someone else knows it, change it in Settings.",
          ]}
        />
      </Part>

      <Part title="2. The club's responsibilities">
        <p>The club is responsible for the information it puts in its hub. The club agrees to:</p>
        <List
          items={[
            "only add information about players, parents and volunteers that it's allowed to, for running the club;",
            <>
              tell its members how their information is used — it can share our{" "}
              <Link href="/privacy" className="font-semibold text-green-700 underline">Privacy Policy</Link>{" "}
              for the parts we handle;
            </>,
            "have parents' permission before adding photos of a child;",
            "follow its league's and the FA's safeguarding guidance;",
            "not use the hub for anything unlawful, harmful or unrelated to running a football club.",
          ]}
        />
      </Part>

      <Part title="3. How we handle the club's information (data processing terms)">
        <p>
          For information the club keeps about its players and parents, the club is the controller
          and we are its processor. We will:
        </p>
        <List
          items={[
            "use it only to run the club's hub, as the club instructs, and never for our own purposes;",
            "make sure anyone who handles it for us keeps it confidential;",
            "keep it secure, and keep each club's information separate;",
            <>
              use only the service providers listed in our{" "}
              <Link href="/privacy" className="font-semibold text-green-700 underline">Privacy Policy</Link>, under
              contracts that protect it, and tell clubs before adding new ones;
            </>,
            "help the club answer requests from people exercising their data rights;",
            "tell the club without undue delay if we become aware of a breach affecting its information;",
            "delete the club's information when it leaves, normally within 30 days;",
            "give the club the information it reasonably needs to show these terms are being kept.",
          ]}
        />
      </Part>

      <Part title="4. The club's content">
        <p>
          Everything the club puts in its hub stays the club&apos;s. The club lets us store and show
          it only so the hub works. If the club leaves, it can ask us for a copy first.
        </p>
      </Part>

      <Part title="5. The service">
        <List
          items={[
            "We work hard to keep the hub running and secure, but can't promise it will never be unavailable or that it will be free of mistakes.",
            "We may improve or change features. If we ever remove something important, we'll tell clubs first.",
            "If the hub becomes a paid service, we'll explain the price and terms before any club is charged.",
          ]}
        />
      </Part>

      <Part title="6. Ending">
        <p>
          A club can stop using the hub at any time and ask us to delete it. We may suspend or close
          a hub that breaks these terms, telling the club why where we can.
        </p>
      </Part>

      <Part title="7. Liability">
        <p>
          The hub is a tool to help clubs run their teams; clubs remain responsible for their own
          decisions and records. As far as the law allows, we aren&apos;t liable for indirect losses,
          and our total liability is limited to the amount the club has paid us in the previous 12
          months. Nothing in these terms limits liability that can&apos;t legally be limited, such as
          for death or personal injury caused by negligence, or for fraud.
        </p>
      </Part>

      <Part title="8. General">
        <p>
          We may update these terms; we&apos;ll update the date at the top and tell clubs about
          important changes by email. These terms are governed by the law of England and Wales.
          Questions? Contact us at {contact}.
        </p>
      </Part>
    </LegalPage>
  );
}
