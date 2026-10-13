"use client";

// A parent's kit request, like a shop's basket: pick who it's for, the item,
// the size and how many, and add it to the basket; add as many as needed, then
// send them all at once (with a note). Below, their requests, waiting or done.
// The page: app/kit/request.
import { useState } from "react";
import { KIT_ITEMS, type KitItem } from "@/lib/kitItems";

type Mine = {
  id: string;
  childName: string;
  item: KitItem;
  size: string;
  quantity: number;
  note?: string;
  createdAt: string;
  doneAt?: string;
};

const box = "block rounded-3xl bg-white p-4 shadow-sm dark:bg-[#1c1c1e]";
const heading = "mb-3 text-sm font-bold text-gray-700 dark:text-gray-200";
const choice = (on: boolean) =>
  `cursor-pointer rounded-xl border-2 px-2 py-3 text-sm font-extrabold transition-all ${
    on
      ? "border-green-700 bg-green-700 text-white shadow-md"
      : "border-gray-200 bg-white text-gray-700 hover:border-green-500 dark:border-white/15 dark:bg-[#1c1c1e] dark:text-gray-200"
  }`;

const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default function KitRequestForm({
  family,
  items,
  initial,
}: {
  family: { id: string; name: string; teamName: string }[];
  items: KitItem[];
  initial: Mine[];
}) {
  const [childId, setChildId] = useState(family.length === 1 ? family[0].id : "");
  const [item, setItem] = useState<KitItem | null>(null);
  const [size, setSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  // the basket: what's been added, not yet sent
  const [basket, setBasket] = useState<{ key: number; childId: string; item: KitItem; size: string; quantity: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [mine, setMine] = useState(initial);

  const ready = !!childId && !!item && !!size && !busy;
  const MAX_BASKET = 10;
  const firstName = (id: string) => family.find((c) => c.id === id)?.name.split(" ")[0] ?? "";

  function addToBasket() {
    if (!ready || !item || basket.length >= MAX_BASKET) return;
    setBasket((b) => {
      // the same thing again: more of it, rather than a second line
      const same = b.find((l) => l.childId === childId && l.item === item && l.size === size);
      if (same) return b.map((l) => (l === same ? { ...l, quantity: Math.min(5, l.quantity + quantity) } : l));
      return [...b, { key: Date.now(), childId, item, size, quantity }];
    });
    setItem(null);
    setSize("");
    setQuantity(1);
  }

  async function send() {
    if (!basket.length || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/kit/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: basket.map(({ childId, item, size, quantity }) => ({ childId, item, size, quantity })), note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "That didn't send");
      setMine((m) => [...(data.requests ?? [data.request]), ...m]);
      setSent(true);
      setBasket([]);
      setItem(null);
      setSize("");
      setQuantity(1);
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't send");
    } finally {
      setBusy(false);
    }
  }

  async function takeBack(id: string) {
    if (!confirm("Take this request back?")) return;
    const res = await fetch(`/api/kit/requests?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) setMine((m) => m.filter((r) => r.id !== id));
    else alert((await res.json().catch(() => ({}))).error ?? "That didn't work");
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      {sent ? (
        <div className="rounded-3xl bg-white p-6 text-center shadow-sm dark:bg-[#1c1c1e]">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-green-600 text-2xl text-white">✓</div>
          <p className="text-lg font-extrabold">Request sent</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            The coaches have been told. You&apos;ll see it marked done below once it&apos;s sorted.
          </p>
          <button onClick={() => setSent(false)} className="mt-4 cursor-pointer text-sm font-semibold text-green-700 dark:text-green-400">
            Request Something Else
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="px-1 text-center text-[15px] text-gray-500 dark:text-gray-400">
            Need something during the season — a bigger shirt, new socks? Ask here and your child&apos;s
            coaches get an alert.
          </p>

          {family.length > 1 && (
            <div className={box}>
              <p className={heading}>Who&apos;s it for?</p>
              <div className="grid grid-cols-2 gap-2">
                {family.map((c) => (
                  <button key={c.id} type="button" onClick={() => setChildId(c.id)} className={choice(childId === c.id)}>
                    {c.name.split(" ")[0]}
                    <span className={`block text-xs font-semibold ${childId === c.id ? "text-white/80" : "text-gray-400"}`}>{c.teamName}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={box}>
            <p className={heading}>What do you need?</p>
            <div className="grid grid-cols-2 gap-2">
              {items.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setItem(i);
                    if (!KIT_ITEMS[i].sizes.includes(size)) setSize("");
                  }}
                  className={choice(item === i)}
                >
                  {KIT_ITEMS[i].emoji} {KIT_ITEMS[i].label}
                </button>
              ))}
            </div>
          </div>

          {item && (
            <div className={box}>
              <p className={heading}>Size</p>
              <div className="flex gap-2">
                {KIT_ITEMS[item].sizes.map((s) => (
                  <button key={s} type="button" onClick={() => setSize(s)} className={`flex-1 ${choice(size === s)}`}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-700 dark:text-gray-200">How many</span>
                <span className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    aria-label="Fewer"
                    className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-gray-200 text-lg font-bold disabled:opacity-30 dark:border-white/15"
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-lg font-extrabold">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(5, q + 1))}
                    disabled={quantity >= 5}
                    aria-label="More"
                    className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-gray-200 text-lg font-bold disabled:opacity-30 dark:border-white/15"
                  >
                    +
                  </button>
                </span>
              </div>
            </div>
          )}

          <button
            onClick={addToBasket}
            disabled={!ready || basket.length >= MAX_BASKET}
            className="w-full cursor-pointer rounded-2xl border-2 border-green-600 bg-white py-3.5 font-bold text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 dark:bg-[#1c1c1e] dark:text-green-400 dark:disabled:border-white/15 dark:disabled:text-gray-500"
          >
            {basket.length >= MAX_BASKET ? `Up to ${MAX_BASKET} items at a time` : "+ Add to Basket"}
          </button>

          {/* the basket */}
          <div className={box}>
            <p className={heading}>
              🧺 Basket{basket.length ? ` (${basket.reduce((n, l) => n + l.quantity, 0)} item${basket.reduce((n, l) => n + l.quantity, 0) === 1 ? "" : "s"})` : ""}
            </p>
            {basket.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Nothing yet — choose an item and size, then Add to Basket.</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-white/10">
                {basket.map((l) => (
                  <li key={l.key} className="flex items-center gap-3 py-2">
                    <span className="text-2xl">{KIT_ITEMS[l.item].emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {l.quantity > 1 ? `${l.quantity} × ` : ""}
                        {KIT_ITEMS[l.item].short} · {l.size}
                      </span>
                      {family.length > 1 && <span className="block text-sm text-gray-500 dark:text-gray-400">For {firstName(l.childId)}</span>}
                    </span>
                    <button
                      onClick={() => setBasket((b) => b.filter((x) => x.key !== l.key))}
                      aria-label={`Take ${KIT_ITEMS[l.item].short} out of the basket`}
                      className="h-8 w-8 cursor-pointer rounded-lg text-lg text-gray-400 hover:text-red-500"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {basket.length > 0 && (
              <label className="mt-3 block">
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">Anything to add? (optional)</span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={200}
                  rows={2}
                  placeholder="e.g. lost at the last away game"
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 dark:border-white/15 dark:bg-[#1c1c1e] dark:text-gray-50"
                />
              </label>
            )}
          </div>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-300">
              {error}
            </p>
          )}
          <button
            onClick={send}
            disabled={!basket.length || busy}
            className="w-full cursor-pointer rounded-xl bg-green-600 py-4 font-bold text-white shadow-md hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none dark:disabled:bg-white/15"
          >
            {busy ? "Sending…" : basket.length ? `Send Request (${basket.reduce((n, l) => n + l.quantity, 0)})` : "Send Request"}
          </button>
        </div>
      )}

      {mine.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-lg font-bold">Your Requests</h2>
          <div className="divide-y divide-gray-100 overflow-hidden rounded-3xl bg-white shadow-sm dark:divide-white/10 dark:bg-[#1c1c1e]">
            {mine.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-2xl">{KIT_ITEMS[r.item]?.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">
                    {r.quantity > 1 ? `${r.quantity} × ` : ""}
                    {KIT_ITEMS[r.item]?.short ?? r.item} · {r.size}
                  </span>
                  <span className="block truncate text-sm text-gray-500 dark:text-gray-400">
                    {r.childName.split(" ")[0]} · asked {when(r.createdAt)}
                  </span>
                </span>
                {r.doneAt ? (
                  <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800 dark:bg-green-400/15 dark:text-green-300">
                    Done
                  </span>
                ) : (
                  <span className="flex flex-col items-end gap-1">
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">
                      Waiting
                    </span>
                    <button onClick={() => takeBack(r.id)} className="cursor-pointer text-xs font-semibold text-gray-400 hover:text-red-500">
                      Take back
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
