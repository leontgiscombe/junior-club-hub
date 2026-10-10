"use client";

// Join requests for club admins and coaches: the count waiting (a badge on
// Coach Admin's Members tile and a banner on the home page), and the switch for
// this phone's alerts (a prompt in Coach Admin until they're on; the switch in
// Your Account). The alerts come through public/hub-sw.js.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SESSION_KEY } from "@/lib/access";

type Status = { pending: number; alerts: boolean; pushAvailable: boolean };

const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

async function hubWorker() {
  return navigator.serviceWorker.register("/hub-sw.js", { scope: "/" });
}

function b64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** How many are waiting, and whether this phone has alerts on; null until known, or for someone who isn't a coach. */
export function useJoinRequests(key: string = SESSION_KEY, enabled = true) {
  const [status, setStatus] = useState<Status | null>(null);
  const refresh = useCallback(async () => {
    // only once signed in: a half-typed password would count as a wrong one
    if (!enabled) return;
    let endpoint = "";
    if (pushSupported()) {
      const reg = await navigator.serviceWorker.getRegistration("/").catch(() => undefined);
      endpoint = (await reg?.pushManager.getSubscription().catch(() => null))?.endpoint ?? "";
    }
    const params = new URLSearchParams();
    if (key && key !== SESSION_KEY) params.set("key", key);
    if (endpoint) params.set("endpoint", endpoint);
    const res = await fetch(`/api/members/alerts?${params}`, { cache: "no-store" }).catch(() => null);
    setStatus(res?.ok ? ((await res.json()) as Status) : null);
  }, [key, enabled]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);
  return { status, refresh };
}

/** The home page's banner, for a club admin or coach signed in, when someone's waiting. */
export function PendingBanner() {
  const { status } = useJoinRequests();
  if (!status?.pending) return null;
  return (
    <Link
      href="/admin/members"
      className="mb-5 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 shadow-sm hover:bg-amber-100"
    >
      <span className="text-xl">⏳</span>
      <span className="flex-1">
        {status.pending} {status.pending === 1 ? "person is" : "people are"} waiting for approval
      </span>
      <span>→</span>
    </Link>
  );
}

/** Turning this phone's alerts on and off, for someone signed in as a club admin or coach. */
function useAlertSwitch(refresh: () => void) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const turnOn = async () => {
    setBusy(true);
    setNote(null);
    try {
      if (!pushSupported()) {
        setNote("This browser can't show alerts. On an iPhone, add the hub to your Home Screen (Share → Add to Home Screen), open it from there and try again.");
        return;
      }
      if ((await Notification.requestPermission()) !== "granted") {
        setNote("Alerts are blocked for this site. Allow notifications in your phone's settings, then try again.");
        return;
      }
      const club = await fetch("/api/club").then((r) => r.json());
      if (!club?.vapidPublicKey) throw new Error("Alerts aren't set up on this hub");
      const reg = await hubWorker();
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(club.vapidPublicKey) }));
      const res = await fetch("/api/members/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not turn alerts on");
      setNote("Alerts are on for this phone.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not turn alerts on");
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const turnOff = async () => {
    setBusy(true);
    setNote(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/members/alerts", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setNote("Alerts are off for this phone.");
    } finally {
      setBusy(false);
      refresh();
    }
  };

  return { busy, note, turnOn, turnOff };
}

/**
 * Coach Admin's nudge to turn alerts on, until this phone has them; turning
 * them off is in Your Account. Only for someone signed in with their account.
 */
export function AlertsPrompt({ status, refresh }: { status: Status | null; refresh: () => void }) {
  const { busy, note, turnOn } = useAlertSwitch(refresh);
  // stays up just long enough to say it worked (or why it didn't)
  if (!status?.pushAvailable || (status.alerts && !note)) return null;
  return (
    <div className="mb-4 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm">
      {!status.alerts && (
        <div className="flex items-center gap-3">
          <span className="text-xl">🔔</span>
          <p className="flex-1 text-gray-700">Get an alert on this phone when someone asks to join.</p>
          <button
            onClick={turnOn}
            disabled={busy}
            className="shrink-0 rounded-xl bg-green-600 px-4 py-2 font-bold text-white hover:bg-green-700 disabled:opacity-40"
          >
            {busy ? "…" : "Turn On"}
          </button>
        </div>
      )}
      {note && (
        <p className={`text-xs text-gray-500 ${status.alerts ? "" : "mt-2"}`}>
          {note}
          {status.alerts && (
            <>
              {" "}
              You can turn them off in{" "}
              <Link href="/account#alerts" className="font-semibold text-green-700 hover:underline">Your Account</Link>.
            </>
          )}
        </p>
      )}
    </div>
  );
}

/** Your Account's section for this phone's alerts — only for club admins and coaches, on a club's own address. */
export function AlertsSettings({ className }: { className: string }) {
  const { status, refresh } = useJoinRequests();
  const { busy, note, turnOn, turnOff } = useAlertSwitch(refresh);
  if (!status?.pushAvailable) return null;
  return (
    <section className={className} id="alerts">
      <h2 className="font-extrabold text-gray-900">🔔 Join Request Alerts</h2>
      <p className="mt-1 text-sm text-gray-500">
        {status.alerts
          ? "On for this phone — you get an alert when someone asks to join, and tapping it opens Members."
          : "Get an alert on this phone when someone asks to join. Club admins hear about every request; coaches about their own team's."}
      </p>
      <button
        onClick={status.alerts ? turnOff : turnOn}
        disabled={busy}
        className={`mt-3 rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-40 ${
          status.alerts ? "border border-gray-200 text-gray-700 hover:bg-gray-50" : "bg-gray-900 text-white hover:bg-black"
        }`}
      >
        {busy ? "…" : status.alerts ? "Turn Off on This Phone" : "Turn On for This Phone"}
      </button>
      {note && <p className="mt-2 text-sm text-gray-600">{note}</p>}
    </section>
  );
}
