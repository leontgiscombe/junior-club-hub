"use client";

// Your Account → Your Children: each child's photo, heading their card. It
// shows on their profile in Members; only the club's coaches and the child's
// own parents or carers can see it (app/api/players/photo). A child gets a
// photo once they're in the club's squad (they have a squad player).
import { useRef, useState, type ReactNode } from "react";
import { squarePhoto } from "./ProfilePhoto";
import PlayerCare from "../components/PlayerCare";
import PlayerDevices from "../components/PlayerDevices";

export function ChildAvatar({
  playerId,
  name,
  version,
  onChange,
  children,
}: {
  playerId?: string;
  name: string;
  version?: string;
  onChange: (v: string | null) => void;
  /** their name and team, beside the photo */
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0]!.toUpperCase())
      .slice(0, 2)
      .join("") || "?";

  async function save(file: File | null) {
    if (!playerId) return;
    setBusy(true);
    setError(null);
    try {
      const res = file
        ? await fetch("/api/players/photo", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: playerId, image: await squarePhoto(file) }),
          })
        : await fetch(`/api/players/photo?id=${encodeURIComponent(playerId)}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't save the photo");
      onChange(file ? String(Date.now()) : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the photo");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => playerId && input.current?.click()}
        disabled={!playerId || busy}
        aria-label={playerId ? `${version ? "Change" : "Add"} ${name}'s photo` : undefined}
        className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-green-100 text-lg font-bold text-green-800 disabled:cursor-default dark:bg-green-400/15 dark:text-green-300"
      >
        {playerId && version ? (
          // eslint-disable-next-line @next/next/no-img-element -- your child's photo, private to you and the club's coaches
          <img src={`/api/players/photo?id=${encodeURIComponent(playerId)}&v=${version}`} alt="" className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </button>
      <span className="min-w-0 flex-1">
        {children}
        {playerId && (
          <span className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
            <button type="button" onClick={() => input.current?.click()} disabled={busy} className="text-green-700 disabled:opacity-40 dark:text-green-400">
              {busy ? "Saving…" : version ? "Change Photo" : "Add Photo"}
            </button>
            {version && (
              <button type="button" onClick={() => save(null)} disabled={busy} className="text-gray-500 disabled:opacity-40 dark:text-gray-400">
                Remove
              </button>
            )}
            {/* their own phone or tablet, for the Training Hub */}
            <PlayerDevices playerId={playerId} name={name} />
            {/* their medical notes and emergency contact, for the coaches */}
            <PlayerCare playerId={playerId} name={name} />
          </span>
        )}
        {error && <span className="block text-sm text-red-600 dark:text-red-400">{error}</span>}
      </span>
      {playerId && <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => save(e.target.files?.[0] ?? null)} />}
    </div>
  );
}
