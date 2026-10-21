"use client";

// The club's crest and kit picture, made ready in the browser before they're
// saved: shrunk to size, and, if one has a plain background, offered with it
// taken off (BackgroundChoice). In Settings and when signing a club up.
import { kitAspect } from "@/lib/clubSettings";
import { removeBackground } from "@/lib/crestBackground";

/** The picture as a data: URL no bigger than `max` pixels a side: a PNG (keeps a see-through background) or a JPEG (for photos). */
export type Picture = { image: string; width: number; height: number };
export const pictureOf = (canvas: HTMLCanvasElement, type = "image/png"): Picture => ({
  image: canvas.toDataURL(type, 0.85),
  width: canvas.width,
  height: canvas.height,
});

/** A see-through kit picture has to be a PNG: made smaller until it's within the upload limit. */
const KIT_PNG_BYTES = 560 * 1024;
function pngWithin(canvas: HTMLCanvasElement, maxBytes: number): Picture {
  let pic = pictureOf(canvas);
  for (let scale = 0.85; (pic.image.length * 3) / 4 > maxBytes && scale > 0.2; scale -= 0.15) {
    const smaller = document.createElement("canvas");
    smaller.width = Math.max(1, Math.round(canvas.width * scale));
    smaller.height = Math.max(1, Math.round(canvas.height * scale));
    smaller.getContext("2d")!.drawImage(canvas, 0, 0, smaller.width, smaller.height);
    pic = pictureOf(smaller);
  }
  return pic;
}

export async function shrinkImage(
  file: File,
  { max = 512, type = "image/png" }: { max?: number; type?: "image/png" | "image/jpeg" } = {},
): Promise<Picture> {
  return pictureOf(await shrinkToCanvas(file, { max, type }), type);
}

export async function shrinkToCanvas(
  file: File,
  { max = 512, type = "image/png" }: { max?: number; type?: "image/png" | "image/jpeg" } = {},
): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That file doesn't look like an image"));
      el.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    if (type === "image/jpeg") {
      // a JPEG can't be see-through, so anything see-through becomes white
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(img, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** How each picture is shrunk: the crest a small PNG, the kit picture a wide photo. */
export const PICTURES = {
  crest: { name: "crest", shrink: { max: 512, type: "image/png" } },
  kit: { name: "kit picture", shrink: { max: 1600, type: "image/jpeg" } },
} as const;
export type PictureSlot = keyof typeof PICTURES;

/** A picture file made ready: as it is, or (a plain background) both versions to choose from. */
export async function preparePicture(slot: PictureSlot, file: File): Promise<{ picture: Picture } | { original: Picture; cleaned: Picture }> {
  const { shrink } = PICTURES[slot];
  if (slot === "crest") {
    const canvas = await shrinkToCanvas(file, shrink);
    const cleaned = removeBackground(canvas);
    return cleaned ? { original: pictureOf(canvas), cleaned: pictureOf(cleaned) } : { picture: pictureOf(canvas) };
  }
  // worked on as a PNG, so a see-through version keeps its see-through parts
  const canvas = await shrinkToCanvas(file, { max: shrink.max, type: "image/png" });
  const cleaned = removeBackground(canvas, { shaded: true });
  return cleaned
    ? { original: await shrinkImage(file, shrink), cleaned: pngWithin(cleaned, KIT_PNG_BYTES) }
    : { picture: await shrinkImage(file, shrink) };
}

/** A crest or kit picture had a plain background: with it taken off, or as it was. */
export function BackgroundChoice({
  what,
  pick,
  wide = false,
  busy,
  onPick,
  onCancel,
}: {
  what: string;
  pick: { original: Picture; cleaned: Picture };
  /** a wide picture (the kit): the two one above the other */
  wide?: boolean;
  busy: boolean;
  onPick: (picture: Picture) => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-5 border-t border-gray-100 pt-4 dark:border-white/10">
      <p className="text-sm font-bold text-gray-900 dark:text-gray-50">Take the background off?</p>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        Your {what} has a plain background. Here it is with that taken off, and as you uploaded it.
      </p>
      <div className={`mt-3 grid gap-3 ${wide ? "grid-cols-1" : "grid-cols-2"}`}>
        {(
          [
            ["cleaned", "Background Off", pick.cleaned],
            ["original", "As Uploaded", pick.original],
          ] as const
        ).map(([key, label, pic]) => (
          <button
            key={key}
            type="button"
            onClick={() => onPick(pic)}
            disabled={busy}
            className={`cursor-pointer rounded-2xl border-2 p-2 text-sm font-bold disabled:opacity-50 ${
              key === "cleaned"
                ? "border-green-600 text-green-700 dark:text-green-400"
                : "border-gray-200 text-gray-700 dark:border-white/15 dark:text-gray-200"
            }`}
          >
            {/* on the dark colour it's shown on, so any leftover background shows */}
            <span
              className={`grid place-items-center rounded-xl p-3 ${
                wide ? "bg-[var(--club-night)]" : "aspect-square bg-[radial-gradient(circle_at_50%_46%,#1f5c2c_0%,#0b2412_55%,#060906_100%)]"
              }`}
              style={wide ? { aspectRatio: kitAspect(pick.original) } : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pic.image} alt="" className="max-h-full max-w-full object-contain" />
            </span>
            <span className="mt-2 block">Use {label}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="mt-3 w-full cursor-pointer text-sm font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400"
      >
        Cancel
      </button>
    </div>
  );
}
