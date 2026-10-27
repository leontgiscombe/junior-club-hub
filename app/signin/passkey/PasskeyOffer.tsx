"use client";

// "Sign in faster next time?" — add a passkey, or "No thanks" (remembered on
// this device). Goes straight on if this browser can't use passkeys, already
// has one, or the person said no thanks before.
import { useEffect, useState } from "react";
import { addPasskey, alreadyHasOne, cancelled, hasPasskeyHint, saidNoThanks, sayNoThanks, supportsPasskeys } from "../../components/passkey";

export default function PasskeyOffer({ next, hasOne }: { next: string; hasOne: boolean }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supportsPasskeys() || hasPasskeyHint() || saidNoThanks()) window.location.replace(next);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- only known in the browser
    else setShow(true);
  }, [next]);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      await addPasskey();
      window.location.replace(next);
    } catch (err) {
      if (alreadyHasOne(err)) return window.location.replace(next);
      if (!cancelled(err)) setError(err instanceof Error ? err.message : "That didn't work");
      setBusy(false);
    }
  }

  function noThanks() {
    sayNoThanks();
    window.location.replace(next);
  }

  if (!show) return <p className="text-center text-sm text-gray-400">Signing you in…</p>;
  return (
    <div className="text-center">
      <div className="text-4xl">🔐</div>
      <h1 className="mt-3 text-2xl font-extrabold text-gray-900 dark:text-gray-50">Sign in faster next time?</h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        {hasOne
          ? "Add a passkey on this device too, and sign in here with Face ID, your fingerprint or your screen lock — no waiting for a code."
          : "Add a passkey and sign in with Face ID, your fingerprint or your screen lock — no waiting for a code. Treasurers and club admins can open Finances with it too."}
      </p>
      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      <button onClick={add} disabled={busy} className="mt-5 w-full rounded-xl bg-green-600 py-3.5 font-bold text-white hover:bg-green-700 disabled:opacity-50">
        {busy ? "Adding…" : "Add a Passkey"}
      </button>
      <button onClick={noThanks} disabled={busy} className="mt-2 w-full rounded-xl py-3 text-sm font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
        No thanks
      </button>
      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">You can add one any time in Your Account.</p>
    </div>
  );
}
