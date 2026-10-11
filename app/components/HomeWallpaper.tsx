"use client";

// The home screen's wallpaper (lib/wallpaper.ts): a picture fixed behind the
// page, with a soft shade over it so the cards and headings stay readable.
// While one is showing, <html data-wallpaper> turns the headings that sit on
// it white (globals.css: .wp-text).
import { useEffect, useState } from "react";
import { WALLPAPER_EVENT, loadWallpaper, type Wallpaper } from "@/lib/wallpaper";

/** What each wallpaper looks like, as CSS backgrounds. */
export function wallpaperStyle(w: Wallpaper): React.CSSProperties | null {
  switch (w.kind) {
    case "club":
      return {
        background:
          "radial-gradient(120% 70% at 15% 0%, var(--color-green-500, #22c55e) 0%, transparent 60%), radial-gradient(90% 60% at 100% 30%, var(--club-bright, #3ee04f) 0%, transparent 55%), linear-gradient(180deg, var(--color-green-800, #166534), var(--club-night, #060906))",
      };
    case "brush":
      return {
        background: "var(--club-night, #060906) url(/poster/brush-background.jpg) center top / cover no-repeat",
        filter: "var(--club-brush-filter)",
      };
    case "pitch":
      return {
        background:
          "repeating-linear-gradient(180deg, #2f9a4c 0 56px, #23803c 56px 112px)",
      };
    case "photo":
      return w.photo ? { background: `#000 url(${w.photo}) center / cover no-repeat` } : null;
    default:
      return null;
  }
}

export default function HomeWallpaper() {
  const [wall, setWall] = useState<Wallpaper>({ kind: "none" });
  useEffect(() => {
    const read = () => setWall(loadWallpaper());
    read();
    window.addEventListener(WALLPAPER_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(WALLPAPER_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  const style = wallpaperStyle(wall);
  useEffect(() => {
    const html = document.documentElement;
    if (style) html.dataset.wallpaper = wall.kind;
    else delete html.dataset.wallpaper;
    return () => {
      delete html.dataset.wallpaper;
    };
  }, [style, wall.kind]);
  if (!style) return null;
  return (
    <div aria-hidden="true" className="no-dark pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0 animate-[wp-in_400ms_ease-out]" style={style} />
      {/* a shade, darker at the top where the headings are */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/25 to-black/45" />
    </div>
  );
}
