// A club's plan: where it stands (free trial, subscribed, free, or ended) and
// the plans by number of teams (lib/billing.ts). Open while a club is paused
// after its trial (proxy.ts), so its admins can sort it out.
import Link from "next/link";
import PlanList from "../components/PlanList";
import { billingState, planForTeams, PLANS, TRIAL_DAYS } from "@/lib/billing";
import { getClub, getTeams } from "@/lib/settings";
import { getTenant } from "@/lib/tenant";
import { getTenantRecord } from "@/lib/tenants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plans", robots: { index: false } };

const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export default async function PlansPage() {
  const tenant = await getTenant();
  const [club, teams, record] = await Promise.all([getClub(), getTeams().catch(() => []), tenant ? getTenantRecord(tenant) : null]);
  const state = record ? billingState(record.billing) : null;
  const suggested = planForTeams(Math.max(teams.length, 1));
  return (
    <main className="themed min-h-screen bg-[#f2f2f7] px-5 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))] text-gray-900 dark:bg-black dark:text-gray-50">
      <div className="mx-auto flex max-w-md flex-col gap-5">
        <Link href="/" className="text-sm font-semibold text-gray-500 hover:text-green-700 dark:text-gray-400">← Home</Link>
        <div>
          <h1 className="text-[34px] font-extrabold leading-tight tracking-tight">Plans</h1>
          <p className="mt-1 text-[15px] text-gray-500 dark:text-gray-400">
            {!state
              ? `Every club starts with ${TRIAL_DAYS} days free, with everything included.`
              : state.kind === "trial"
                ? `${club.name} is on its free trial: ${state.daysLeft} day${state.daysLeft === 1 ? "" : "s"} left (until ${when(state.endsAt)}).`
                : state.kind === "paid"
                  ? `${club.name} is on the ${PLANS[state.plan].name} plan, paid up to ${when(state.until)}.`
                  : state.kind === "free"
                    ? `${club.name} is free: ${state.reason.toLowerCase()}. Nothing to pay.`
                    : `${club.name}'s free trial has ended. Everything's kept — choose a plan to carry on.`}
          </p>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Every plan has every part of the hub. You pay by how many teams the club has — {club.name} has {teams.length} team
          {teams.length === 1 ? "" : "s"}.
        </p>
        <PlanList suggested={suggested} />
        <div className="rounded-2xl bg-white p-4 text-sm text-gray-600 dark:bg-[#1c1c1e] dark:text-gray-300">
          <p className="font-bold text-gray-900 dark:text-gray-50">Subscribing</p>
          <p className="mt-1">
            Subscribing in the app is coming soon. Until then, a club admin can{" "}
            <Link href="/support#contact" className="font-semibold text-green-700 underline dark:text-green-400">
              get in touch
            </Link>{" "}
            and we&apos;ll set the club&apos;s plan up.
          </p>
        </div>
      </div>
    </main>
  );
}
