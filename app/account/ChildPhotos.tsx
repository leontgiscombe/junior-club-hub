"use client";

// Your Account → Your Children: a photo for each child in the club's squad.
// It shows on their profile in Members; only the club's coaches and the
// child's own parents or carers can see it (app/api/players/photo).
import { useRef, useState } from "react";
import { squarePhoto } from "./ProfilePhoto";

type Kid = { playerId: string; name: string };

function ChildPhoto({ kid, version, onChange }: { kid: Kid; version?: string; onChange: (v: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const initials = kid.name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 2)
    .join("");

  async function save(file: File | null) {
    setBusy(true);
    setError(null);
    try {
      const res = file
        ? await fetch("/api/players/photo", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: kid.playerId, image: await squarePhoto(file) }),
          })
        : await fetch(`/api/players/photo?id=${encodeURIComponent(kid.playerId)}`, { method: "DELETE" });
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
    <li className="flex items-center gap-3 py-2.5">
      <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-green-100 text-lg font-bold text-green-800 dark:bg-green-400/15 dark:text-green-300">
        {version ? (
          // eslint-disable-next-line @next/next/no-img-element -- your child's photo, private to you and the club's coaches
          <img src={`/api/players/photo?id=${encodeURIComponent(kid.playerId)}&v=${version}`} alt="" className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-gray-900 dark:text-gray-50">{kid.name}</span>
        <span className="mt-0.5 flex gap-4 text-sm font-semibold">
          <button onClick={() => input.current?.click()} disabled={busy} className="text-green-700 disabled:opacity-40 dark:text-green-400">
            {busy ? "Saving…" : version ? "Change Photo" : "Add Photo"}
          </button>
          {version && (
            <button onClick={() => save(null)} disabled={busy} className="text-gray-500 disabled:opacity-40 dark:text-gray-400">
              Remove
            </button>
          )}
        </span>
        {error && <span className="block text-sm text-red-600 dark:text-red-400">{error}</span>}
      </span>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => save(e.target.files?.[0] ?? null)} />
    </li>
  );
}

export default function ChildPhotos({ kids, photos }: { kids: Kid[]; photos: Record<string, string> }) {
  const [versions, setVersions] = useState(photos);
  if (!kids.length) return null;
  return (
    <div className="mb-5">
      <p className="text-sm font-bold text-gray-900 dark:text-gray-50">Photos</p>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        Shown on their profile for the club&apos;s coaches. Only the coaches and you (and any other parent or carer of theirs) can see it.
      </p>
      <ul className="mt-1 divide-y divide-gray-100 dark:divide-white/10">
        {kids.map((k) => (
          <ChildPhoto
            key={k.playerId}
            kid={k}
            version={versions[k.playerId]}
            onChange={(v) =>
              setVersions((all) => {
                const next = { ...all };
                if (v) next[k.playerId] = v;
                else delete next[k.playerId];
                return next;
              })
            }
          />
        ))}
      </ul>
    </div>
  );
}
