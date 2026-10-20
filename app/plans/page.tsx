// A club's plan: where it stands (free trial, subscribed, free, or ended) and
// the plans by number of teams (lib/billing.ts). Open while a club is paused
// after its trial (proxy.ts), so its admins can sort it out.
import Link from "next/link";
import PlanList from "../components/PlanList";
import AppPlans from "./AppPlans";
import { billingState, planForTeams, PLANS, TRIAL_DAYS } from "@/lib/billing";
import { getClub, getTeams } from "@/lib/settings";
import { getTenant } from "@/lib/tenant";
import { getTenantRecord } from "@/lib/tenants";
import { inApp } from "@/lib/inAppServer";
import { currentPerson } from "@/lib/people";
import { revenueCatConfigured, syncClubBilling, webPurchaseUrl } from "@/lib/revenuecat";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plans", robots: { index: false } };

const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export default async function PlansPage() {
  // in the App Store app, plans are bought with In-App Purchase (AppPlans), and
  // nothing points to paying on the website (lib/inApp.ts)
  const appView = await inApp();
  const tenant = await getTenant();
  const [club, teams, me] = await Promise.all([
    getClub(),
    getTeams().catch(() => []),
    tenant ? currentPerson(tenant).catch(() => null) : null,
  ]);
  const isAdmin = me?.person?.status === "approved" && me.person.roles.includes("admin");
  let record = tenant ? await getTenantRecord(tenant) : null;
  // a club admin sees it as RevenueCat has it now (lib/revenuecat.ts), not
  // waiting on the webhook
  let managementUrl: string | null = null;
  if (tenant && isAdmin && record?.billing && revenueCatConfigured()) {
    try {
      managementUrl = (await syncClubBilling(tenant))?.managementUrl ?? null;
      record = await getTenantRecord(tenant);
    } catch (err) {
      console.error("Plans: RevenueCat", err);
    }
  }
  const state = record ? billingState(record.billing) : null;
  const billing = record?.billing;
  const buyUrl = tenant && isAdmin ? webPurchaseUrl(tenant) : null;
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
        {/* in the app, an admin subscribes, or switches plan if the club pays through the App Store */}
        {appView && tenant && isAdmin && (state?.kind === "trial" || state?.kind === "ended" || (state?.kind === "paid" && billing?.source === "apple")) ? (
          <AppPlans tenant={tenant} apiKey={process.env.REVENUECAT_APPLE_KEY || null} suggested={suggested} />
        ) : (
          <PlanList suggested={suggested} />
        )}
        <div className="rounded-2xl bg-white p-4 text-sm text-gray-600 dark:bg-[#1c1c1e] dark:text-gray-300">
          <p className="font-bold text-gray-900 dark:text-gray-50">{state?.kind === "paid" ? "Your subscription" : "Subscribing"}</p>
          {state?.kind === "paid" ? (
            <>
              {billing?.billingIssue && <p className="mt-1 font-semibold text-red-700 dark:text-red-400">The last payment didn&apos;t go through, and it&apos;s being tried again. Please check the card.</p>}
              {billing?.cancelled && <p className="mt-1 font-semibold text-amber-800 dark:text-amber-300">It&apos;s been cancelled, so it ends on {when(state.until)}. Everything&apos;s kept if you subscribe again.</p>}
              <p className="mt-1">
                {billing?.source === "apple"
                  ? appView && isAdmin
                    ? "Paid through the App Store. Switch plan above. To cancel, open Settings on the iPhone it was bought on, tap your name, then Subscriptions."
                    : "Paid through the App Store. To change plan or cancel, open Settings on the iPhone it was bought on, tap your name, then Subscriptions."
                  : billing?.source === "web"
                    ? appView ? "Paid by card on our website." : "Paid by card on this website."
                    : "Set up for you by us. Get in touch to change it."}
              </p>
              {billing?.source === "web" && isAdmin && managementUrl && !appView && (
                <a href={managementUrl} className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-green-700 px-4 py-2 font-semibold text-white">
                  Manage Billing
                </a>
              )}
            </>
          ) : state?.kind === "free" ? (
            <p className="mt-1">Nothing to do — {club.name} doesn&apos;t pay.</p>
          ) : appView ? (
            <p className="mt-1">
              {isAdmin
                ? "Subscribe above with your Apple ID. One subscription covers the whole club."
                : "A club admin can subscribe in the app. Parents, coaches and players never pay."}
            </p>
          ) : buyUrl ? (
            <>
              <p className="mt-1">Pay monthly or yearly by card. Change plan or cancel whenever you like.</p>
              <a href={buyUrl} className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-green-700 px-4 py-2 font-semibold text-white">
                Subscribe
              </a>
            </>
          ) : tenant && !isAdmin && webPurchaseUrl(tenant) ? (
            <p className="mt-1">A club admin can subscribe here, or in the app.</p>
          ) : (
            <p className="mt-1">
              A club admin can{" "}
              <Link href="/support#contact" className="font-semibold text-green-700 underline dark:text-green-400">
                get in touch
              </Link>{" "}
              and we&apos;ll set the club&apos;s plan up.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
