// Joining the club's hub: type the club's join code and your name, then wait
// for a coach to approve you (lib/access.ts). A hub open to everyone is joined
// the same way — anyone can look around it, but a parent joins to add their
// children — with its code filled in.
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { JOIN_CODE_COOKIE, MEMBER_COOKIE, normaliseCode, readMember, showCode } from "@/lib/access";
import { getAccess } from "@/lib/members";
import { currentPerson } from "@/lib/people";
import { getClub } from "@/lib/settings";
import { platformUrl, requireTenant, rootDomain } from "@/lib/tenant";
import JoinForm from "./JoinForm";
import AuthBackdrop from "../components/AuthBackdrop";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const club = await getClub();
  return { title: `Join ${club.name}`, robots: { index: false } };
}

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const tenant = await requireTenant();
  const [club, access, member, me, { code: linkCode }, jar] = await Promise.all([
    getClub(),
    getAccess(tenant),
    (async () => readMember(tenant, (await cookies()).get(MEMBER_COOKIE)?.value ?? ""))(),
    currentPerson(tenant),
    searchParams,
    cookies(),
  ]);
  // the code from the join link, else one already typed here (checked again either way)
  const code = linkCode ?? jar.get(JOIN_CODE_COOKIE)?.value;
  // already in (an approved account, or a phone approved before accounts)
  if (me?.person?.status === "approved" || member?.status === "approved") redirect("/");

  return (
    <main className="themed relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#f2f2f7] dark:bg-black px-4 py-10">
      <AuthBackdrop />
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
      </div>
      {/* back to the opening screen, which the app otherwise skips for the club picked last time */}
      {rootDomain() && (
        <a href={platformUrl("/start?pick=1")} className="mt-5 text-sm font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50">
          Not {club.name}? Switch Club
        </a>
      )}
    </main>
  );
}
