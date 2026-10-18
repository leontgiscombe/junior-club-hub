// Club subscriptions, bought in the App Store app (In-App Purchase) or on the
// website (RevenueCat Web Billing, through Stripe), both kept by RevenueCat.
// Each club is one RevenueCat customer, "club:<club id>", whoever paid and
// wherever: its webhook (app/api/billing/revenuecat) and the Plans page ask
// RevenueCat where the club stands and copy that onto its billing
// (lib/billing.ts), which is what pauses and unpauses it. Server only.
import { planFromProduct, type Billing, type BillingSource, type PlanId } from "./billing";
import { getTenantRecord, setTenantBilling } from "./tenants";

/** A club's RevenueCat customer id. */
export const customerId = (tenant: string) => `club:${tenant}`;

/** The club a RevenueCat customer id is for, or null for anything else. */
export function tenantOf(id: unknown): string | null {
  return typeof id === "string" && id.startsWith("club:") && id.length > 5 ? id.slice(5) : null;
}

/** The parts of RevenueCat's customer record (GET /v1/subscribers/…) used here. */
export type Subscriber = {
  subscriptions?: Record<
    string,
    {
      expires_date?: string | null;
      store?: string;
      unsubscribe_detected_at?: string | null;
      billing_issues_detected_at?: string | null;
    }
  >;
  management_url?: string | null;
};

export type StorePlan = { plan: PlanId; paidUntil: string; source: BillingSource; cancelled: boolean; billingIssue: boolean };

const sourceOf = (store?: string): BillingSource => (store === "app_store" || store === "mac_app_store" ? "apple" : store === "promotional" ? "manual" : "web");

/**
 * What a customer's subscriptions say about the club's plan: the plan
 * subscription that runs latest (even one that's ended, so an ending shows),
 * or null when they've never had one.
 */
export function planFromSubscriber(subscriber: Subscriber): StorePlan | null {
  let best: StorePlan | null = null;
  for (const [product, s] of Object.entries(subscriber.subscriptions ?? {})) {
    const plan = planFromProduct(product);
    if (!plan || !s.expires_date || !Date.parse(s.expires_date)) continue;
    if (best && Date.parse(best.paidUntil) >= Date.parse(s.expires_date)) continue;
    best = {
      plan,
      paidUntil: new Date(s.expires_date).toISOString(),
      source: sourceOf(s.store),
      cancelled: !!s.unsubscribe_detected_at,
      billingIssue: !!s.billing_issues_detected_at,
    };
  }
  return best;
}

/**
 * The billing change a store plan makes, or null for none: a founding club (no
 * billing at all) is never touched, and a plan the platform admin set by hand
 * that runs longer is kept.
 */
export function billingChange(billing: Billing | undefined, store: StorePlan | null): Partial<Billing> | null {
  if (!billing || !store) return null;
  if (billing.source === "manual" && billing.paidUntil && Date.parse(billing.paidUntil) > Date.parse(store.paidUntil)) return null;
  const change: Partial<Billing> = { plan: store.plan, paidUntil: store.paidUntil, source: store.source, cancelled: store.cancelled, billingIssue: store.billingIssue };
  const same = (Object.keys(change) as (keyof Billing)[]).every((k) => (billing[k] ?? false) === (change[k] ?? false));
  return same ? null : change;
}

export const revenueCatConfigured = () => !!process.env.REVENUECAT_SECRET_KEY;

/**
 * Ask RevenueCat where a club stands and save it on the club. Returns the
 * customer's "manage your subscription" link (web purchases), or null when
 * RevenueCat isn't set up.
 */
export async function syncClubBilling(tenant: string): Promise<{ managementUrl: string | null } | null> {
  const key = process.env.REVENUECAT_SECRET_KEY;
  if (!key) return null;
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(customerId(tenant))}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`RevenueCat answered ${res.status}`);
  const subscriber = ((await res.json()) as { subscriber?: Subscriber }).subscriber ?? {};
  const record = await getTenantRecord(tenant);
  const change = record ? billingChange(record.billing, planFromSubscriber(subscriber)) : null;
  if (change) await setTenantBilling(tenant, change);
  return { managementUrl: subscriber.management_url ?? null };
}

/**
 * The website's purchase page for a club (a RevenueCat Web Purchase Link, with
 * the club's customer id on the end), or null when it isn't set up.
 */
export function webPurchaseUrl(tenant: string): string | null {
  const base = process.env.REVENUECAT_WEB_PURCHASE_URL?.replace(/\/+$/, "");
  return base ? `${base}/${encodeURIComponent(customerId(tenant))}` : null;
}
