"use client";

import { useState } from "react";
import type { SquadOption } from "@/lib/kitSquad";

const SIZES = ["4XS", "3XS", "XXS", "XS", "S"] as const;
type Size = (typeof SIZES)[number];

const SOCK_SIZES = ["XS", "S", "M"] as const;
type SockSize = (typeof SOCK_SIZES)[number];

const SOCK_GUIDE = {
  XS: { shoe: "UK 10–2" },
  S:  { shoe: "UK 2.5–5" },
  M:  { shoe: "UK 5.5–8" },
} as const;

const SIZE_GUIDE = {
  "4XS": { height: "110–119cm  (3'6\"–3'9\")", chest: "60–64cm  (23.5–25\")", waist: "56–59cm  (22–23\")" },
  "3XS": { height: "120–132cm  (3'9\"–4'3\")", chest: "64–72cm  (25–28\")",   waist: "59–64cm  (23–25\")" },
  "XXS": { height: "133–146cm  (4'3\"–4'8\")", chest: "72–80cm  (28–31.5\")", waist: "64–69cm  (25–27\")" },
  "XS":  { height: "147–160cm  (4'8\"–5'2\")", chest: "80–88cm  (31.5–34.5\")",waist: "69–74cm  (27–29\")" },
  "S":   { height: "160–172cm  (5'2\"–5'6\")", chest: "88–96cm  (34.6–37.8\")",waist: "74–79cm  (29–31\")" },
} as const;


function SizeButton({ size, selected, onClick }: { size: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-3 px-1 rounded-xl text-sm font-extrabold border-2 transition-all duration-100 cursor-pointer select-none ${
        selected
          ? "bg-green-700 border-green-700 text-white shadow-md scale-105"
          : "bg-white border-gray-200 text-gray-700 hover:border-green-500 hover:text-green-700"
      }`}
    >
      {size}
    </button>
  );
}

function Step({ n, done }: { n: number; done: boolean }) {
  return (
    <span
      className={`mr-2 inline-grid h-6 w-6 place-items-center rounded-full text-xs font-extrabold align-middle ${
        done ? "bg-green-600 text-white" : "bg-gray-900 text-white"
      }`}
    >
      {done ? "✓" : n}
    </span>
  );
}

function SizeSelector<T extends string>({ step, label, emoji, value, onChange, sizes }: {
  step: number; label: string; emoji: string; value: T | null; onChange: (s: T) => void; sizes: readonly T[];
}) {
  return (
    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
      <p className="text-sm font-bold text-gray-700 mb-3">
        <Step n={step} done={!!value} />
        {emoji} {label}
        {value && <span className="ml-2 text-green-700 font-extrabold">{value}</span>}
      </p>
      <div className="flex gap-2">
        {sizes.map((s) => (
          <SizeButton key={s} size={s} selected={value === s} onClick={() => onChange(s)} />
        ))}
      </div>
    </div>
  );
}

function SizeGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-blue-50 rounded-2xl border border-blue-100 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-blue-800 cursor-pointer"
      >
        <span>📏 Size Guide</span>
        <span className="text-blue-500 text-xs">{open ? "▲ Hide" : "▼ Show"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 overflow-x-auto">
          <p className="mb-1 text-xs font-bold text-blue-900">👕 Shirt</p>
          <table className="w-full text-xs text-left border-collapse min-w-[260px]">
            <thead>
              <tr className="border-b border-blue-200">
                {["Size","Height","Chest"].map((h) => (
                  <th key={h} className="py-2 pr-3 font-bold text-blue-900 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SIZES.map((size) => (
                <tr key={size} className="border-b border-blue-100 last:border-0">
                  <td className="py-2 pr-3 font-bold text-blue-800">{size}</td>
                  <td className="py-2 pr-3 text-gray-700 whitespace-nowrap">{SIZE_GUIDE[size].height}</td>
                  <td className="py-2 text-gray-700 whitespace-nowrap">{SIZE_GUIDE[size].chest}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 mb-1 text-xs font-bold text-blue-900">🩳 Shorts</p>
          <table className="w-full text-xs text-left border-collapse min-w-[260px]">
            <thead>
              <tr className="border-b border-blue-200">
                {["Size","Height","Waist"].map((h) => (
                  <th key={h} className="py-2 pr-3 font-bold text-blue-900 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SIZES.map((size) => (
                <tr key={size} className="border-b border-blue-100 last:border-0">
                  <td className="py-2 pr-3 font-bold text-blue-800">{size}</td>
                  <td className="py-2 pr-3 text-gray-700 whitespace-nowrap">{SIZE_GUIDE[size].height}</td>
                  <td className="py-2 text-gray-700 whitespace-nowrap">{SIZE_GUIDE[size].waist}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 mb-1 text-xs font-bold text-blue-900">🧦 Socks</p>
          <table className="w-full text-xs text-left border-collapse min-w-[200px]">
            <thead>
              <tr className="border-b border-blue-200">
                {["Size","Shoe size"].map((h) => (
                  <th key={h} className="py-2 pr-3 font-bold text-blue-900 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SOCK_SIZES.map((size) => (
                <tr key={size} className="border-b border-blue-100 last:border-0">
                  <td className="py-2 pr-3 font-bold text-blue-800">{size}</td>
                  <td className="py-2 text-gray-700 whitespace-nowrap">{SOCK_GUIDE[size].shoe}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-blue-600 italic">Tip: if between sizes, go up for a comfortable fit.</p>
        </div>
      )}
    </div>
  );
}

function SuccessScreen({ childName, alreadySent, shirtSize, shortsSize, socksSize, onReset }: {
  childName: string; alreadySent: boolean; shirtSize: string; shortsSize: string; socksSize: string; onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-5 pb-8">
      <div className="text-center pt-4">
        <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-green-600 text-3xl text-white shadow-md">✓</div>
        <h2 className="text-xl font-extrabold text-gray-900">All done!</h2>
        <p className="text-sm text-gray-500 mt-1">
          Kit sizes for <strong>{childName}</strong> have been saved.
        </p>
        {alreadySent && (
          <p className="mt-2 text-xs text-amber-700">
            Sizes had already been sent for {childName} — the coaches will see both.
          </p>
        )}
      </div>

      <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
        <p className="text-xs font-semibold text-green-700 mb-3 uppercase tracking-wide">Kit order for {childName}</p>
        <div className="flex gap-3">
          {[["👕","Shirt",shirtSize],["🩳","Shorts",shortsSize],["🧦","Socks",socksSize]].map(([icon,label,val]) => (
            <div key={label} className="flex-1 bg-white rounded-xl py-3 text-center border border-green-100">
              <p className="text-xs text-gray-400">{icon}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              <p className="text-lg font-extrabold text-green-700 mt-1">{val}</p>
            </div>
          ))}
        </div>
      </div>

      <button onClick={onReset} className="text-sm text-green-700 underline underline-offset-2 text-center cursor-pointer py-1">
        Submit Another Child
      </button>
    </div>
  );
}

const NOT_LISTED = "__not-listed__";

export default function KitForm({ team, squad }: { team: string; squad: SquadOption[] }) {
  // a child picked from the squad (their id), NOT_LISTED to type a name, or ""
  const [picked, setPicked] = useState(squad.length ? "" : NOT_LISTED);
  const [childName, setChildName] = useState("");
  const [alreadySent, setAlreadySent] = useState(false);
  const [shirtSize, setShirtSize] = useState<Size | null>(null);
  const [shortsSize, setShortsSize] = useState<Size | null>(null);
  const [socksSize, setSocksSize] = useState<SockSize | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typing = picked === NOT_LISTED;
  const chosenLabel = squad.find((p) => p.id === picked)?.label ?? "";
  const hasChild = typing ? !!childName.trim() : !!chosenLabel;
  const canSubmit = !!(hasChild && shirtSize && shortsSize && socksSize && !submitting);

  function reset() {
    setResult(false); setChildName(""); setShirtSize(null); setShortsSize(null); setSocksSize(null);
    setPicked(squad.length ? "" : NOT_LISTED); setAlreadySent(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team,
          ...(typing ? { childName } : { playerId: picked }),
          shirtSize,
          shortsSize,
          socksSize,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setAlreadySent(!!data.alreadySent);
      setResult(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <SuccessScreen
        childName={typing ? childName.trim() : chosenLabel}
        alreadySent={alreadySent}
        shirtSize={shirtSize!} shortsSize={shortsSize!} socksSize={socksSize!}
        onReset={reset}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 pb-8">
      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
        <label htmlFor="kit-child" className="block text-sm font-bold text-gray-700 mb-2">
          <Step n={1} done={hasChild} />
          👶 Your Child
        </label>
        {squad.length > 0 && (
          <select
            id="kit-child"
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-400 text-base"
          >
            <option value="" disabled>
              Choose your child…
            </option>
            {squad.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            <option value={NOT_LISTED}>My child isn&apos;t listed</option>
          </select>
        )}
        {typing && (
          <input
            id={squad.length ? undefined : "kit-child"}
            type="text" value={childName} onChange={(e) => setChildName(e.target.value)}
            placeholder="Your child's full name, e.g. Jamie Smith" required
            className={`w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 text-base ${
              squad.length ? "mt-2" : ""
            }`}
          />
        )}
      </div>

      <SizeGuide />
      <SizeSelector step={2} label="Shirt Size"  emoji="👕" value={shirtSize}  onChange={setShirtSize}  sizes={SIZES} />
      <SizeSelector step={3} label="Shorts Size" emoji="🩳" value={shortsSize} onChange={setShortsSize} sizes={SIZES} />
      <SizeSelector step={4} label="Socks Size"  emoji="🧦" value={socksSize}  onChange={setSocksSize}  sizes={SOCK_SIZES} />

      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>}

      <button type="submit" disabled={!canSubmit}
        className="mt-2 w-full py-4 rounded-xl text-base font-bold text-white bg-green-600 hover:bg-green-700 active:scale-95 shadow-md transition-all cursor-pointer disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed disabled:scale-100">
        {submitting ? "Saving…" : "Continue →"}
      </button>
      {!canSubmit && !submitting && (
        <p className="text-center text-xs text-gray-400">Choose your child and all three sizes to continue</p>
      )}
      <p className="text-center text-xs text-gray-400">
        Sizes go to your child&apos;s coaches only.{" "}
        <a href="/privacy" className="underline hover:text-gray-600">How we use your information</a>
      </p>
    </form>
  );
}
