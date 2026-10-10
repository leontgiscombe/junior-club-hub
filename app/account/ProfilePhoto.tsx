"use client";

// Your Account's profile photo: pick one, and it's cut to a square, made
// small and saved; it shows in the profile badge on the home page.
import { useEffect, useRef, useState } from "react";

const SIZE = 256;

/** The middle square of a picture, SIZE pixels a side, as a JPEG data: URL. */
async function squarePhoto(file: File): Promise<string> {
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

export default function ProfilePhoto({ initials }: { initials: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // a fresh ?v= each time the page opens, so a new photo always shows
    const url = `/api/account/photo?v=${Date.now()}`;
    fetch(url)
      .then((r) => r.ok && setSrc(url))
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
    <div className="flex items-center gap-4">
      <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-green-700 text-xl font-extrabold text-white ring-2 ring-white shadow">
        {/* eslint-disable-next-line @next/next/no-img-element -- your own photo, private to you */}
        {src ? <img src={src} alt="Your profile photo" className="h-full w-full object-cover" /> : initials}
      </span>
      <div className="min-w-0">
        <span className="block text-sm font-bold text-gray-800">Profile photo</span>
        <div className="mt-1 flex flex-wrap gap-2">
          <button
            onClick={() => input.current?.click()}
            disabled={busy}
            className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-bold text-white hover:bg-black disabled:opacity-40"
          >
            {busy ? "…" : src ? "Change" : "Add a Photo"}
          </button>
          {src && (
            <button onClick={remove} disabled={busy} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40">
              Remove
            </button>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        <p className="mt-1 text-xs text-gray-400">Only you see it, in the badge at the top of the home page.</p>
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => choose(e.target.files?.[0])} />
    </div>
  );
}
