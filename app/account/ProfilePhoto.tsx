"use client";

// Your Account's profile photo: pick one, and it's cut to a square, made
// small and saved; it shows in the profile badge on the home page.
import { useEffect, useRef, useState } from "react";

const SIZE = 256;

/** The middle square of a picture, SIZE pixels a side, as a JPEG data: URL. */
export async function squarePhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That file doesn't look like a photo"));
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, SIZE, SIZE);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ProfilePhoto({ initials, compact = false }: { initials: string; compact?: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // only when there is one (asking for a photo nobody's added is a 404), with a
    // fresh ?v= each time the page opens, so a new photo always shows
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => me?.user?.photo && setSrc(`/api/account/photo?v=${Date.now()}`))
      .catch(() => {});
  }, []);

  async function choose(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const image = await squarePhoto(file);
      const res = await fetch("/api/account/photo", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't save the photo");
      setSrc(image);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the photo");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    await fetch("/api/account/photo", { method: "DELETE" }).catch(() => null);
    setSrc(null);
    setBusy(false);
  }

  return (
    <div className="flex shrink-0 flex-col items-center">
      <div className="relative">
        <span className={`grid place-items-center overflow-hidden bg-green-700 font-semibold text-white ${compact ? "h-14 w-14 rounded-full text-lg shadow-sm" : "h-36 w-36 rounded-3xl text-5xl shadow-lg"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- your own photo, private to you */}
          {src ? <img src={src} alt="Your profile photo" className="h-full w-full object-cover" /> : initials}
        </span>
        <button
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-label={src ? "Change your photo" : "Add a photo"}
          title={src ? "Change your photo" : "Add a photo"}
          className={compact ? "absolute inset-0 grid h-14 w-14 place-items-center rounded-full disabled:opacity-50" : "absolute -right-3 -top-3 grid h-12 w-12 place-items-center rounded-full bg-white text-gray-900 shadow-lg ring-1 ring-black/5 hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-white/5 dark:bg-[#1c1c1e] dark:text-gray-50 dark:ring-white/10"}
        >
          {compact ? <span className="sr-only">Profile photo</span> : busy ? (
            <span className="text-sm font-bold">…</span>
          ) : (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden="true">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          )}
        </button>
      </div>
      {src && !compact && (
        <button onClick={remove} disabled={busy} className="mt-2 text-xs font-semibold text-gray-400 hover:text-gray-600">
          Remove photo
        </button>
      )}
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => choose(e.target.files?.[0])} />
    </div>
  );
}
