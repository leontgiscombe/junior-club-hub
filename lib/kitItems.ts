// The kit items and their sizes, shared by the kit form, kit requests and
// Kit Responses. No server-only imports: the forms use it in the browser.
import { KIT_EXTRAS, type KitExtra } from "./clubSettings";

export const SIZES = ["4XS", "3XS", "XXS", "XS", "S"] as const;
export const SOCK_SIZES = ["XS", "S", "M"] as const;

export type KitItem = "shirt" | "shorts" | "socks" | KitExtra;

/** Each item a parent can ask for, with its sizes. */
export const KIT_ITEMS: Record<KitItem, { label: string; short: string; emoji: string; sizes: readonly string[] }> = {
  shirt: { label: "Shirt", short: "Shirt", emoji: "👕", sizes: SIZES },
  shorts: { label: "Shorts", short: "Shorts", emoji: "🩳", sizes: SIZES },
  socks: { label: "Socks", short: "Socks", emoji: "🧦", sizes: SOCK_SIZES },
  jacket: { label: KIT_EXTRAS.jacket.label, short: KIT_EXTRAS.jacket.short, emoji: KIT_EXTRAS.jacket.emoji, sizes: SIZES },
  rainJacket: { label: KIT_EXTRAS.rainJacket.label, short: KIT_EXTRAS.rainJacket.short, emoji: KIT_EXTRAS.rainJacket.emoji, sizes: SIZES },
};

/** The items this club's parents can ask for: the basics, and the extras it has switched on. */
export function itemsFor(extras: KitExtra[]): KitItem[] {
  return ["shirt", "shorts", "socks", ...(Object.keys(KIT_EXTRAS) as KitExtra[]).filter((e) => extras.includes(e))];
}

export const isKitItem = (v: unknown): v is KitItem => typeof v === "string" && v in KIT_ITEMS;
