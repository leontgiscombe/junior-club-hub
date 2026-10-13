// What a club pays: a 30-day free trial from signing up, then a plan by its
// number of teams. Founding clubs (here before trials) and any club the
// platform admin marks free never pay. Kept on the club's record
// (lib/tenants.ts); a club whose trial has ended without a plan is paused
// (lib/clubStatus.ts) — nothing deleted — until it subscribes. No server-only
// imports: the plans are shown on pages too.

export const TRIAL_DAYS = 30;

export const PLANS = {
  starter: { name: "Starter", teams: 3, monthly: 4.99, yearly: 49.99 },
  club: { name: "Club", teams: 10, monthly: 9.99, yearly: 99.99 },
  large: { name: "Large Club", teams: Infinity, monthly: 14.99, yearly: 149.99 },
} as const;
export type PlanId = keyof typeof PLANS;
export const PLAN_IDS = Object.keys(PLANS) as PlanId[];

export const price = (n: number) => `£${n.toFixed(2)}`;
export const teamsLabel = (p: PlanId) => (PLANS[p].teams === Infinity ? "Unlimited teams" : `Up to ${PLANS[p].teams} teams`);

/** The plan a club with `teams` teams needs. */
export function planForTeams(teams: number): PlanId {
  return PLAN_IDS.find((p) => teams <= PLANS[p].teams) ?? "large";
}

export type Billing = {
  /** when the free trial ends (set when the club signs up) */
  trialEndsAt?: string;
  /** never pays: a founding club, or one the platform admin chose */
  free?: { reason: string };
  /** subscribed: on this plan, paid up to this date */
  plan?: PlanId;
  paidUntil?: string;
  /** the trial reminders already emailed (days left: 7, 1) */
  reminded?: number[];
};

export type BillingState =
  | { kind: "free"; reason: string }
  | { kind: "paid"; plan: PlanId; until: string }
  | { kind: "trial"; endsAt: string; daysLeft: number }
  | { kind: "ended"; endedAt: string };

const DAY = 86400_000;

/** Where a club stands. A record with no billing at all is a founding club. */
export function billingState(billing: Billing | undefined, now = Date.now()): BillingState {
  if (!billing) return { kind: "free", reason: "Founding club" };
  if (billing.free) return { kind: "free", reason: billing.free.reason };
  if (billing.plan && billing.paidUntil && Date.parse(billing.paidUntil) > now) return { kind: "paid", plan: billing.plan, until: billing.paidUntil };
  const end = billing.trialEndsAt ? Date.parse(billing.trialEndsAt) : 0;
  if (end > now) return { kind: "trial", endsAt: billing.trialEndsAt!, daysLeft: Math.ceil((end - now) / DAY) };
  return { kind: "ended", endedAt: billing.paidUntil && Date.parse(billing.paidUntil) > end ? billing.paidUntil : (billing.trialEndsAt ?? new Date(now).toISOString()) };
}

/** A new club's billing: the free trial, from now. */
export function newTrial(now = Date.now()): Billing {
  return { trialEndsAt: new Date(now + TRIAL_DAYS * DAY).toISOString() };
}

/** How many teams the club may have while subscribed (a trial or a free club has no limit). */
export function teamLimit(state: BillingState): number {
  return state.kind === "paid" ? PLANS[state.plan].teams : Infinity;
}
