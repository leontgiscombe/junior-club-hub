"use client";

// Join requests for club admins and coaches: the count waiting (a badge on
// Coach Admin's Members tile), and the switch for
// this phone's alerts (a prompt in Coach Admin until they're on; the switch in
// Your Account). The alerts come through public/hub-sw.js.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SESSION_KEY } from "@/lib/access";
import { isAppUserAgent } from "@/lib/inApp";

import { forgetToken, nativePush, nativeToken, savedToken } from "@/lib/nativePush";

// the App Store app's web view can't show web alerts (lib/inApp.ts): there, alerts come
// through Apple (lib/nativePush.ts), and an older build of the app without that shows none
const inTheApp = () => typeof navigator !== "undefined" && isAppUserAgent(navigator.userAgent) && !nativePush();

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

function sameBytes(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.length) return false;
  const x = new Uint8Array(a);
  return x.every((v, i) => v === b[i]);
}

/** How many are waiting, and whether this phone has alerts on; null until known, or for someone who isn't a coach. */
export function useJoinRequests(key: string = SESSION_KEY, enabled = true) {
  const [status, setStatus] = useState<Status | null>(null);
  const refresh = useCallback(async () => {
    // only once signed in: a half-typed password would count as a wrong one
    if (!enabled) return;
    let endpoint = "";
    if (nativePush()) endpoint = savedToken() ? `apns:${savedToken()}` : "";
    else if (pushSupported()) {
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

/** Turning this phone's alerts on and off, for someone signed in as a club admin or coach. */
function useAlertSwitch(refresh: () => void) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const turnOn = async () => {
    setBusy(true);
    setNote(null);
    try {
      if (nativePush()) {
        const res = await fetch("/api/members/alerts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ apnsToken: await nativeToken() }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not turn alerts on");
        setNote("Alerts are on for this phone.");
        return;
      }
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
      const serverKey = b64ToBytes(club.vapidPublicKey);
      let sub = await reg.pushManager.getSubscription();
      // a subscription made with the hub's earlier key can't be sent to: start again
      if (sub && !sameBytes(sub.options.applicationServerKey, serverKey)) {
        await sub.unsubscribe();
        sub = null;
      }
      sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey });
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
      if (nativePush()) {
        if (savedToken()) {
          await fetch("/api/members/alerts", {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ endpoint: `apns:${savedToken()}` }),
          });
        }
        forgetToken();
        setNote("Alerts are off for this phone.");
        return;
      }
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

  const test = async () => {
    setBusy(true);
    setNote(null);
    try {
      const endpoint = nativePush()
        ? savedToken() && `apns:${savedToken()}`
        : (await (await navigator.serviceWorker.getRegistration("/"))?.pushManager.getSubscription())?.endpoint;
      if (!endpoint) throw new Error("This phone has no alerts set up — turn them on first");
      const res = await fetch("/api/members/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ test: true, endpoint }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "The test alert wasn't sent");
      setNote("Test alert sent — it should appear in a few seconds. If it doesn't, turn alerts off and on again.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "The test alert wasn't sent");
    } finally {
      setBusy(false);
    }
  };

  return { busy, note, turnOn, turnOff, test };
}

/**
 * Coach Admin's nudge to turn alerts on, until this phone has them; turning
 * them off is in Your Account. Only for someone signed in with their account.
 */
export function AlertsPrompt({ status, refresh }: { status: Status | null; refresh: () => void }) {
  const { busy, note, turnOn } = useAlertSwitch(refresh);
  // stays up just long enough to say it worked (or why it didn't)
  if (!status?.pushAvailable || (status.alerts && !note) || inTheApp()) return null;
  return (
    <div className="mb-4 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm dark:bg-[#1c1c1e] dark:border-white/15">
      {!status.alerts && (
        <div className="flex items-center gap-3">
          <span className="text-xl">🔔</span>
          <p className="flex-1 text-gray-700 dark:text-gray-200">Get an alert on this phone when someone asks to join.</p>
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
              <Link href="/account#alerts" className="font-semibold text-green-700 hover:underline dark:text-green-400">Your Account</Link>.
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
  const { busy, note, turnOn, turnOff, test } = useAlertSwitch(refresh);
  if (!status?.pushAvailable || inTheApp()) return null;
  return (
    <section className={className} id="alerts">
      <h2 className="font-extrabold text-gray-900 dark:text-gray-50">🔔 Coach Alerts</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {status.alerts
          ? "On for this phone — you get an alert when someone asks to join or a parent requests kit. Tapping it opens the right page."
          : "Get an alert on this phone when someone asks to join, or a parent requests kit. Club admins hear about every join request; coaches about their own team's, and their team's kit requests."}
      </p>
      <button
        onClick={status.alerts ? turnOff : turnOn}
        disabled={busy}
        className={`mt-3 rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-40 ${
          status.alerts ? "border border-gray-200 text-gray-700 hover:bg-gray-50 dark:hover:bg-white/5 dark:text-gray-200 dark:border-white/15" : "bg-gray-900 text-white hover:bg-black dark:hover:bg-gray-200 dark:bg-white dark:text-gray-900"
        }`}
      >
        {busy ? "…" : status.alerts ? "Turn Off on This Phone" : "Turn On for This Phone"}
      </button>
      {status.alerts && (
        <button
          onClick={test}
          disabled={busy}
          className="mt-3 ml-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:hover:bg-white/5 dark:text-gray-200 dark:border-white/15"
        >
          Send a Test Alert
        </button>
      )}
      {note && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{note}</p>}
    </section>
  );
}
