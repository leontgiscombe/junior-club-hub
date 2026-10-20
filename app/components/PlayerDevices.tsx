"use client";

// A child's own devices (lib/playerDevices.ts), for their parents (Your
// Account → Your Children) and coaches (Members → a player's profile): make a
// one-time code to set one up, and see or remove the ones already set up.
import { useEffect, useState } from "react";
import { useScrollLock } from "./useScrollLock";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { playerSetupUrl } from "@/lib/playerCode";

type Device = { id: string; label: string; createdAt: string; by: string };

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function PlayerDevices({
  playerId,
  name,
  adminKey,
  className = "text-green-700 dark:text-green-400",
  label = "Devices",
  onClose,
}: {
  playerId: string;
  name: string;
  /** a coach's key, in Coach Admin; parents are known by their account */
  adminKey?: string;
  className?: string;
  /** the button's words (Home's device prompt says what it does) */
  label?: string;
  /** after the sheet's closed, e.g. to see whether a device was set up */
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const first = name.trim().split(/\s+/)[0] || "Their";
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      {open &&
        createPortal(
          <Sheet playerId={playerId} first={first} adminKey={adminKey} onClose={() => { setOpen(false); onClose?.(); }} />,
          document.body,
        )}
    </>
  );
}

function Sheet({ playerId, first, adminKey, onClose }: { playerId: string; first: string; adminKey?: string; onClose: () => void }) {
  useScrollLock();
  const q = (extra = "") => `?${adminKey ? `key=${encodeURIComponent(adminKey)}&` : ""}${extra}`;
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [code, setCode] = useState<{ code: string; minutes: number; qr?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/players/devices${q(`id=${encodeURIComponent(playerId)}`)}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error ?? "Couldn't load the devices");
    else setDevices(data.devices);
  }
  // the list, once, when the sheet opens
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function newCode() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/players/devices${q()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: playerId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error ?? "Couldn't make a code");
    else {
      // a QR code of the setup link, for the child's camera to scan
      const qr = await QRCode.toString(playerSetupUrl(window.location.origin, data.code), { type: "svg", margin: 1, errorCorrectionLevel: "M" }).catch(() => undefined);
      setCode({ ...data, qr });
    }
    setBusy(false);
  }

  async function remove(d: Device) {
    if (!confirm(`Remove ${first}'s ${d.label}? It's signed out straight away.`)) return;
    setBusy(true);
    const res = await fetch(`/api/players/devices${q(`id=${encodeURIComponent(playerId)}&device=${encodeURIComponent(d.id)}`)}`, { method: "DELETE" });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Couldn't remove it");
    await load();
    setBusy(false);
  }

  const address = typeof window !== "undefined" ? `${window.location.host}/player` : "/player";
  return (
    <div className="themed fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${first}'s devices`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[#f2f2f7] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 text-gray-900 shadow-2xl dark:bg-[#1c1c1e] dark:text-gray-50 sm:rounded-3xl"
      >
        <div className="flex items-center justify-between px-1 pb-3">
          <span className="w-12" />
          <h2 className="text-[17px] font-semibold">{first}&apos;s Devices</h2>
          <button onClick={onClose} className="w-12 text-right text-[15px] font-bold text-green-700 dark:text-green-400">
            Done
          </button>
        </div>
        <p className="px-1 pb-3 text-sm text-gray-500 dark:text-gray-400">
          {`${first} can use the Training Hub on their own phone or tablet, without an email or password. A device set up for them opens only the Training Hub — nothing else in the club's app.`}
        </p>

        {code ? (
          <div className="rounded-3xl bg-white p-5 text-center dark:bg-black/40">
            {code.qr && (
              <>
                <p className="text-sm text-gray-500 dark:text-gray-400">Scan this with {first}&apos;s device:</p>
                {/* white behind it in dark mode too, so cameras can read it */}
                <div
                  className="mx-auto mt-3 w-52 rounded-2xl bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
                  role="img"
                  aria-label="QR code to set up the device"
                  dangerouslySetInnerHTML={{ __html: code.qr }}
                />
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">No camera? On {first}&apos;s device, go to</p>
              </>
            )}
            {!code.qr && <p className="text-sm text-gray-500 dark:text-gray-400">On {first}&apos;s device, go to</p>}
            <p className="mt-1 break-all font-semibold">{address}</p>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">and type this code:</p>
            <p className="mt-2 font-mono text-4xl font-bold tracking-[0.3em]">{code.code}</p>
            <p className="mt-3 text-xs text-gray-400">It works once, for {code.minutes} minutes. Set it up with them — don&apos;t share it.</p>
            <button onClick={() => { setCode(null); load(); }} className="mt-4 text-sm font-semibold text-green-700 dark:text-green-400">
              Done — it&apos;s set up
            </button>
          </div>
        ) : (
          <button
            onClick={newCode}
            disabled={busy}
            className="w-full rounded-3xl bg-green-600 py-3.5 text-[16px] font-bold text-white hover:bg-green-700 disabled:opacity-40"
          >
            Set Up a Device
          </button>
        )}

        {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-300">{error}</p>}

        <p className="mt-5 px-1 pb-2 text-[13px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Set up</p>
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-3xl bg-white dark:divide-white/10 dark:bg-black/40">
          {devices === null ? (
            <li className="px-4 py-3 text-sm text-gray-500">Loading…</li>
          ) : devices.length === 0 ? (
            <li className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No devices yet.</li>
          ) : (
            devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block font-semibold">{d.label}</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                    Set up {when(d.createdAt)} by {d.by}
                  </span>
                </span>
                <button onClick={() => remove(d)} disabled={busy} className="shrink-0 text-sm font-semibold text-red-600 disabled:opacity-40 dark:text-red-400">
                  Remove
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
