// Joining the club's hub: type the club's join code and your name, then wait
// for a coach to approve you (lib/access.ts). A hub open to everyone is joined
// the same way — anyone can look around it, but a parent joins to add their
// children — with its code filled in.
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { MEMBER_COOKIE, normaliseCode, readMember, showCode } from "@/lib/access";
import { getAccess } from "@/lib/members";
import { currentPerson } from "@/lib/people";
import { getClub } from "@/lib/settings";
import { platformUrl, requireTenant, rootDomain } from "@/lib/tenant";
import JoinForm from "./JoinForm";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const club = await getClub();
  return { title: `Join ${club.name}`, robots: { index: false } };
}

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const tenant = await requireTenant();
  const [club, access, member, me, { code }] = await Promise.all([
    getClub(),
    getAccess(tenant),
    (async () => readMember(tenant, (await cookies()).get(MEMBER_COOKIE)?.value ?? ""))(),
    currentPerson(tenant),
    searchParams,
  ]);
  // already in (an approved account, or a phone approved before accounts)
  if (me?.person?.status === "approved" || member?.status === "approved") redirect("/");

  return (
    <main className="themed flex min-h-screen items-center justify-center bg-gradient-to-b from-green-700 to-green-900 px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-xl dark:bg-[#1c1c1e]">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={club.crest.src} alt={club.crest.alt} className="mx-auto h-20 w-auto" />
          <h1 className="mt-3 text-2xl font-extrabold text-gray-900 dark:text-gray-50">{club.name}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {access.private
              ? "This hub is for the club's members."
              : "Anyone can look around. Join to add your children and hear from the club."}
          </p>
        </div>
        <JoinForm
          initialStatus={me?.person?.status ?? "none"}
          // an open hub's code isn't a secret: it's filled in for them
          initialCode={
            normaliseCode(code ?? "").length === 6
              ? showCode(normaliseCode(code ?? ""))
              : !access.private && access.code
                ? showCode(access.code)
                : ""
          }
          account={me ? { email: me.user.email, name: me.user.name } : null}
        />
        {!access.private && (
          <Link href="/" className="mt-4 block text-center text-sm font-semibold text-gray-500 hover:text-green-700 dark:text-gray-400">
            Just looking? Open the Hub →
          </Link>
        )}
        {/* back to the opening screen, which the app otherwise skips for the club picked last time */}
        {rootDomain() && (
          <a
            href={platformUrl("/start?pick=1")}
            className="mt-4 block border-t border-gray-100 pt-4 text-center text-sm font-semibold text-gray-500 hover:text-green-700 dark:border-white/10 dark:text-gray-400"
          >
            A different club, or starting a new one? →
          </a>
        )}
      </div>
    </main>
  );
}
