"use client";
// Subscribing in the App Store app, for a club's admins: the plans at the App
// Store's prices, bought with In-App Purchase as the club (lib/nativePurchases.ts),
// then read back onto the club (app/api/billing/sync) so it opens straight away.
// A club already paying through the App Store sees its plan marked, and can
// switch to another (Apple upgrades or downgrades it).
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { PLANS, PLAN_IDS, teamsLabel, type PlanId } from "@/lib/billing";
import { buy, currentProduct, nativePurchases, restore, storeOptions, type StoreOption } from "@/lib/nativePurchases";
import { RowsSkeleton } from "../components/Skeleton";

type Period = "monthly" | "yearly";
const noChange = () => () => {};

export default function AppPlans({ tenant, apiKey, suggested }: { tenant: string; apiKey: string | null; suggested: PlanId }) {
  const router = useRouter();
  const [options, setOptions] = useState<StoreOption[] | null>(null);
  const [problem, setProblem] = useState("");
  const [period, setPeriod] = useState<Period>("monthly");
  const [plan, setPlan] = useState<PlanId>(suggested);
  const [busy, setBusy] = useState<"" | "buy" | "restore">("");
  const [note, setNote] = useState("");
  // the App Store product the club pays for now, if any
  const [current, setCurrent] = useState<StoreOption | null>(null);
  // the server can't tell, so it assumes the plugin's there
  const supported = useSyncExternalStore(noChange, nativePurchases, () => true);

  useEffect(() => {
    if (!apiKey || !nativePurchases()) return;
    (async () => {
      const o = await storeOptions(apiKey, tenant);
      if (!o.length) return setProblem("The plans couldn't be loaded from the App Store — try again later.");
      const id = await currentProduct(apiKey, tenant).catch(() => null);
      const now = o.find((x) => x.pkg.product.identifier === id) ?? null;
      if (now) {
        setCurrent(now);
        setPlan(now.plan);
        setPeriod(now.period);
      }
      setOptions(o);
    })().catch(() => setProblem("The plans couldn't be loaded from the App Store — check your connection and try again."));
  }, [apiKey, tenant]);

  // read the club's subscription back, then show the page as it now stands
  const settle = async () => {
    const res = await fetch("/api/billing/sync", { method: "POST" }).catch(() => null);
    if (!res?.ok) throw new Error("It went through, but the club couldn't be updated yet — pull down to refresh in a minute.");
    router.refresh();
  };

  const subscribe = async () => {
    const option = options?.find((o) => o.plan === plan && o.period === period);
    if (!option || !apiKey) return;
    setBusy("buy");
    setNote("");
    try {
      if (await buy(apiKey, tenant, option)) await settle();
    } catch (err) {
      setNote(err instanceof Error && err.message ? err.message : "The purchase didn't go through — try again.");
    } finally {
      setBusy("");
    }
  };

  const restorePurchases = async () => {
    if (!apiKey) return;
    setBusy("restore");
    setNote("");
    try {
      await restore(apiKey, tenant);
      await settle();
      setNote("Done. If the club still isn't showing as paid, the subscription was bought with a different Apple ID.");
    } catch (err) {
      setNote(err instanceof Error && err.message ? err.message : "Couldn't restore purchases — try again.");
    } finally {
      setBusy("");
    }
  };

  const box = "rounded-2xl bg-white p-4 text-sm text-gray-600 dark:bg-[#1c1c1e] dark:text-gray-300";
  if (!supported) {
    return <p className={box}>To subscribe in the app, update Grassroots Club Hub from the App Store.</p>;
  }
  if (!apiKey) {
    return (
      <p className={box}>
        Subscribing in the app is nearly ready.{" "}
        <Link href="/support#contact" className="font-semibold text-green-700 underline dark:text-green-400">Get in touch</Link> and
        we&apos;ll set the club&apos;s plan up.
      </p>
    );
  }
  if (problem) return <p className={box}>{problem}</p>;
  if (!options) return <div className={box}><RowsSkeleton rows={2} /></div>;

  const priceOf = (p: PlanId, per: Period) => options.find((o) => o.plan === p && o.period === per)?.price;
  const chosen = priceOf(plan, period);
  const per = period === "monthly" ? "month" : "year";
  const isCurrent = current?.plan === plan && current.period === period;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 rounded-xl bg-gray-200 p-1 text-sm font-semibold dark:bg-white/10">
        {(["monthly", "yearly"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`min-h-9 rounded-lg ${period === p ? "bg-white text-gray-900 shadow dark:bg-[#3a3a3c] dark:text-gray-50" : "text-gray-500 dark:text-gray-400"}`}
          >
            {p === "monthly" ? "Monthly" : "Yearly · 2 months free"}
          </button>
        ))}
      </div>
      {PLAN_IDS.filter((id) => priceOf(id, period)).map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => setPlan(id)}
          aria-pressed={plan === id}
          className={`flex items-center justify-between gap-3 rounded-2xl border-2 bg-white px-4 py-3 text-left dark:bg-[#1c1c1e] ${
            plan === id ? "border-green-600" : "border-transparent"
          }`}
        >
          <span>
            <span className="block font-bold text-gray-900 dark:text-gray-50">
              {PLANS[id].name}
              {current?.plan === id && current.period === period ? (
                <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-bold text-gray-700 dark:bg-white/15 dark:text-gray-200">Current</span>
              ) : (
                id === suggested && <span className="ml-2 rounded-full bg-green-600 px-2 py-0.5 text-[11px] font-bold text-white">Your club</span>
              )}
            </span>
            <span className="block text-sm text-gray-500 dark:text-gray-400">{teamsLabel(id)} · every feature</span>
          </span>
          <span className="text-right font-extrabold text-gray-900 dark:text-gray-50">
            {priceOf(id, period)}
            <span className="text-xs font-semibold text-gray-500">/{period === "monthly" ? "month" : "year"}</span>
          </span>
        </button>
      ))}
      <button
        type="button"
        onClick={subscribe}
        disabled={!!busy || !chosen || isCurrent}
        className="min-h-12 rounded-xl bg-green-700 px-4 font-bold text-white disabled:opacity-60"
      >
        {busy === "buy"
          ? current ? "Switching…" : "Subscribing…"
          : isCurrent
            ? "Your Current Plan"
            : current
              ? `Switch to ${PLANS[plan].name} — ${chosen} a ${per}`
              : `Subscribe — ${chosen} a ${per}`}
      </button>
      {current && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          A bigger plan starts straight away, and Apple credits what&apos;s left of the current one. A smaller plan, or a change
          between monthly and yearly, starts at your next renewal. Switch with the Apple ID that pays for it.
        </p>
      )}
      {note && <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{note}</p>}
      <button type="button" onClick={restorePurchases} disabled={!!busy} className="min-h-11 text-sm font-semibold text-green-700 dark:text-green-400">
        {busy === "restore" ? "Restoring…" : "Restore Purchases"}
      </button>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Payment is taken from your Apple ID when you confirm. The subscription renews automatically at the same price unless
        it&apos;s cancelled at least 24 hours before the end of the month or year. Manage or cancel it in your iPhone&apos;s
        Settings → your name → Subscriptions. It pays for the whole club; nobody else in the club pays.{" "}
        <Link href="/terms" className="underline">Terms of Use</Link> · <Link href="/privacy" className="underline">Privacy Policy</Link>
      </p>
    </div>
  );
}
