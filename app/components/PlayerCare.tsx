"use client";

// A child's medical notes and emergency contact (lib/playerCare.ts), for their
// parents (Your Account → Your Children: the Medical button) and coaches
// (Members → a player's profile, inline). Nobody else in the club sees them.
import { useEffect, useState } from "react";
import { useScrollLock } from "./useScrollLock";
import { createPortal } from "react-dom";

type Care = { medical: string; emergency: string; updatedAt?: string; by?: string };

const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** The form itself: loads their details, and saves them. */
export function PlayerCareForm({ playerId, first, adminKey }: { playerId: string; first: string; adminKey?: string }) {
  const keyPart = adminKey ? `key=${encodeURIComponent(adminKey)}&` : "";
  const [saved, setSaved] = useState<Care | null>(null);
  const [medical, setMedical] = useState("");
  const [emergency, setEmergency] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // their details, once
  useEffect(() => {
    fetch(`/api/players/care?${keyPart}id=${encodeURIComponent(playerId)}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Couldn't load them");
        setSaved(data.care);
        setMedical(data.care.medical);
        setEmergency(data.care.emergency);
      })
      .catch((e) => setMessage({ ok: false, text: e instanceof Error ? e.message : "Couldn't load them" }));
  }, [playerId, keyPart]);

  async function save() {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/players/care?${keyPart}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: playerId, medical, emergency }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setSaved(data.care);
      setMedical(data.care.medical);
      setEmergency(data.care.emergency);
      setMessage({ ok: true, text: "Saved." });
    } else setMessage({ ok: false, text: data.error ?? "That didn't save" });
    setBusy(false);
  }

  const changed = !!saved && (medical.trim() !== saved.medical || emergency.trim() !== saved.emergency);
  const field = "w-full bg-transparent text-[16px] focus:outline-none placeholder:text-gray-400";
  return (
    <div>
      <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white dark:divide-white/10 dark:bg-black/40">
        <label className="block px-4 py-3">
          <span className="block text-[13px] text-gray-500 dark:text-gray-400">Medical notes &amp; allergies</span>
          <textarea
            value={medical}
            onChange={(e) => setMedical(e.target.value)}
            disabled={!saved}
            rows={3}
            maxLength={500}
            placeholder="e.g. asthma — inhaler in kit bag"
            className={`${field} mt-1 resize-none`}
          />
        </label>
        <label className="block px-4 py-3">
          <span className="block text-[13px] text-gray-500 dark:text-gray-400">Emergency contact</span>
          <input
            value={emergency}
            onChange={(e) => setEmergency(e.target.value)}
            disabled={!saved}
            maxLength={120}
            placeholder="Name and phone number"
            className={`${field} mt-1`}
          />
        </label>
      </div>
      <p className="mt-1.5 px-1 text-xs text-gray-500 dark:text-gray-400">
        Only {first}&apos;s parents and carers and the club&apos;s coaches can see these.
        {saved?.updatedAt ? ` Last changed ${when(saved.updatedAt)}${saved.by ? ` by ${saved.by}` : ""}.` : ""}
      </p>
      {changed && (
        <button onClick={save} disabled={busy} className="mt-2 w-full rounded-2xl bg-green-600 py-3 text-[16px] font-bold text-white hover:bg-green-700 disabled:opacity-40">
          {busy ? "Saving…" : "Save Medical Details"}
        </button>
      )}
      {message && (
        <p className={`mt-2 rounded-xl px-3 py-2 text-sm ${message.ok ? "bg-green-50 text-green-800 dark:bg-green-400/10 dark:text-green-300" : "bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

/** A "Medical" button, opening the form in a sheet. */
export default function PlayerCare({ playerId, name, className = "text-green-700 dark:text-green-400" }: { playerId: string; name: string; className?: string }) {
  const [open, setOpen] = useState(false);
  useScrollLock(open);
  const first = name.trim().split(/\s+/)[0] || "Their";
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        Medical
      </button>
      {open &&
        createPortal(
          <div className="themed fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-black/40 sm:items-center" onClick={() => setOpen(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`${first}'s medical details`}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[#f2f2f7] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 text-gray-900 shadow-2xl dark:bg-[#1c1c1e] dark:text-gray-50 sm:rounded-3xl"
            >
              <div className="flex items-center justify-between px-1 pb-3">
                <span className="w-12" />
                <h2 className="text-[17px] font-semibold">{first}&apos;s Medical Details</h2>
                <button onClick={() => setOpen(false)} className="w-12 text-right text-[15px] font-bold text-green-700 dark:text-green-400">
                  Done
                </button>
              </div>
              <p className="px-1 pb-3 text-sm text-gray-500 dark:text-gray-400">
                Anything the coaches should know to keep {first} safe at training and matches, and who to call if something happens.
              </p>
              <PlayerCareForm playerId={playerId} first={first} />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
