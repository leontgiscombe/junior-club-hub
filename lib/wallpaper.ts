// The app's wallpaper (Your Account → Appearance), chosen per phone
// and kept on it (localStorage): none, the club's colours, its paint-stroke
// artwork, a pitch, or a photo of your own (made small first). Browser only.

export type WallpaperKind = "none" | "club" | "brush" | "pitch" | "photo";
export type Wallpaper = { kind: WallpaperKind; photo?: string };

export const WALLPAPERS: { kind: WallpaperKind; label: string }[] = [
  { kind: "none", label: "None" },
  { kind: "club", label: "Club Colours" },
  { kind: "brush", label: "Brush Strokes" },
  { kind: "pitch", label: "Pitch" },
  { kind: "photo", label: "Your Photo" },
];

const KEY = "hub_wallpaper";
/** Tells the app to redraw when the choice changes on this phone. */
export const WALLPAPER_EVENT = "hub-wallpaper";

export function loadWallpaper(): Wallpaper {
  try {
    const w = JSON.parse(localStorage.getItem(KEY) ?? "null") as Wallpaper | null;
    if (w && WALLPAPERS.some((x) => x.kind === w.kind)) return w;
  } catch {}
  return { kind: "none" };
}

/** Save a choice; false if the phone has no room for it (a big photo). */
export function saveWallpaper(w: Wallpaper): boolean {
  try {
    if (w.kind === "none") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(w));
    window.dispatchEvent(new Event(WALLPAPER_EVENT));
    return true;
  } catch {
    return false;
  }
}

/** A photo from the phone, made small enough to keep: at most 1200px tall, as a JPEG. */
export async function wallpaperPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That file doesn't look like a photo"));
      el.src = url;
    });
    const scale = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}
