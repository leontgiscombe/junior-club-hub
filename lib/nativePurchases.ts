// Subscribing in the App Store app (ios-app/): RevenueCat's Purchases plugin,
// used through the Capacitor bridge the app puts on every page, like
// lib/nativePush.ts. Purchases are made as the club's RevenueCat customer,
// "club:<club id>" (lib/revenuecat.ts), so a club that pays in the app or on
// the website is paid up either way. A build of the app without the plugin, or
// a browser, has none of this: nativePurchases() is false. Client only.
import { planFromProduct, type PlanId } from "./billing";

type Bridge = {
  PluginHeaders?: { name: string }[];
  nativePromise?: (plugin: string, method: string, options?: object) => Promise<Record<string, unknown>>;
};

const bridge = (): Bridge | undefined =>
  typeof window === "undefined" ? undefined : (window as unknown as { Capacitor?: Bridge }).Capacitor;

const PLUGIN = "Purchases";
const call = (method: string, options: object = {}) => bridge()!.nativePromise!(PLUGIN, method, options);

/** Whether this is the App Store app with In-App Purchase. */
export const nativePurchases = () => {
  const b = bridge();
  return !!b?.PluginHeaders?.some((h) => h.name === PLUGIN) && typeof b.nativePromise === "function";
};

/** A package from RevenueCat's offering, handed back as it came to buy it. */
type Package = { identifier: string; product: { identifier: string; priceString: string } };

/** One plan and period the App Store sells, with its price there. */
export type StoreOption = { plan: PlanId; period: "monthly" | "yearly"; price: string; pkg: Package };

/** Set RevenueCat up as this club's customer (once per club per app launch). */
async function asClub(apiKey: string, tenant: string) {
  const appUserID = `club:${tenant}`;
  const { isConfigured } = await call("isConfigured");
  if (!isConfigured) await call("configure", { apiKey, appUserID });
  else if ((await call("getAppUserID")).appUserID !== appUserID) await call("logIn", { appUserID });
}

/** The plans the App Store sells this club, from RevenueCat's current offering. */
export async function storeOptions(apiKey: string, tenant: string): Promise<StoreOption[]> {
  await asClub(apiKey, tenant);
  const offerings = (await call("getOfferings")) as { current?: { availablePackages?: Package[] } | null };
  const options: StoreOption[] = [];
  for (const pkg of offerings.current?.availablePackages ?? []) {
    const id = pkg.product?.identifier ?? "";
    const plan = planFromProduct(id);
    const period = /monthly$/.test(id) ? "monthly" : /yearly$/.test(id) ? "yearly" : null;
    if (plan && period) options.push({ plan, period, price: pkg.product.priceString, pkg });
  }
  return options;
}

const cancelled = (err: unknown) => {
  const e = err as { code?: unknown; message?: unknown; data?: { userCancelled?: unknown } } | null;
  return e?.data?.userCancelled === true || e?.code === "1" || e?.code === 1 || /cancel/i.test(String(e?.message ?? ""));
};

/** Buy a plan with the App Store. False when they backed out of Apple's sheet. */
export async function buy(apiKey: string, tenant: string, option: StoreOption): Promise<boolean> {
  await asClub(apiKey, tenant);
  try {
    await call("purchasePackage", { aPackage: option.pkg });
    return true;
  } catch (err) {
    if (cancelled(err)) return false;
    throw err;
  }
}

/** Bring back a subscription bought with this phone's Apple ID. */
export async function restore(apiKey: string, tenant: string) {
  await asClub(apiKey, tenant);
  await call("restorePurchases");
}
