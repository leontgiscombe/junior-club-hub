// Joining the club's hub: type the club's join code and your name, then wait
// for a coach to approve you (lib/access.ts). A hub open to everyone just
// links to its home page.
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { MEMBER_COOKIE, normaliseCode, readMember, showCode } from "@/lib/access";
import { getAccess } from "@/lib/members";
import { getClub } from "@/lib/settings";
import { requireTenant } from "@/lib/tenant";
import JoinForm from "./JoinForm";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const club = await getClub();
  return { title: `Join ${club.name}`, robots: { index: false } };
}

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const tenant = await requireTenant();
  const [club, access, member, { code }] = await Promise.all([
    getClub(),
    getAccess(tenant),
    (async () => readMember(tenant, (await cookies()).get(MEMBER_COOKIE)?.value ?? ""))(),
    searchParams,
  ]);
  if (member?.status === "approved") redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-green-700 to-green-900 px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-xl">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={club.crest.src} alt={club.crest.alt} className="mx-auto h-20 w-auto" />
          <h1 className="mt-3 text-2xl font-extrabold text-gray-900">{club.name}</h1>
          {access.private && <p className="mt-1 text-sm text-gray-500">This hub is for the club&apos;s members.</p>}
        </div>
        {access.private ? (
          <JoinForm initialStatus={member?.status ?? "none"} initialCode={normaliseCode(code ?? "").length === 6 ? showCode(normaliseCode(code ?? "")) : ""} />
        ) : (
          // (a link, not a redirect: the hub may take a few seconds to notice it's open)
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">This hub is open to everyone.</p>
            <Link href="/" className="mt-4 block rounded-xl bg-green-600 py-3.5 font-bold text-white hover:bg-green-700">
              Open the Hub →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
