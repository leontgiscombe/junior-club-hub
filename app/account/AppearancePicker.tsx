"use client";

// Your Account → Appearance: Light, Dark, or Match My Phone (lib/theme.ts),
// and the home screen's wallpaper (lib/wallpaper.ts), for this device. Both
// take effect straight away.
import { useEffect, useRef, useState } from "react";
import { THEMES, applyTheme, savedTheme, type ThemeChoice } from "@/lib/theme";
import { WALLPAPERS, loadWallpaper, saveWallpaper, wallpaperPhoto, type Wallpaper } from "@/lib/wallpaper";
import { wallpaperStyle } from "../components/HomeWallpaper";

/** The saved choice's name, for the row's detail ("" before the page has loaded). */
export function themeLabel(): string {
  if (typeof document === "undefined") return "";
  return THEMES.find((t) => t.value === savedTheme())?.label ?? "";
}

export default function AppearancePicker() {
  const [choice, setChoice] = useState<ThemeChoice | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the saved choice is only known in the browser
  useEffect(() => setChoice(savedTheme()), []);

  return (
    <div className="mt-4">
      <div className="divide-y divide-gray-100 overflow-hidden rounded-3xl bg-white shadow-sm dark:divide-white/10 dark:bg-[#1c1c1e]">
        {THEMES.map((t) => (
          <button
            key={t.value}
            onClick={() => {
              applyTheme(t.value);
              setChoice(t.value);
            }}
            aria-pressed={choice === t.value}
            className="flex w-full items-center justify-between px-5 py-4 text-left text-[17px] text-gray-900 hover:bg-gray-50 dark:text-gray-50 dark:hover:bg-white/5"
          >
            {t.label}
            {choice === t.value && (
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-green-700 dark:text-green-400" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            )}
          </button>
        ))}
      </div>
      <p className="mt-3 px-2 text-sm text-gray-500 dark:text-gray-400">
        Match My Phone follows your phone&apos;s light or dark setting. Saved on this device.
      </p>

      <WallpaperPicker />
    </div>
  );
}

/** The home screen's wallpaper: a row of previews to tap, one of them your own photo. */
function WallpaperPicker() {
  const [wall, setWall] = useState<Wallpaper | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the saved choice is only known in the browser
  useEffect(() => setWall(loadWallpaper()), []);

  function pick(next: Wallpaper) {
    setNote(null);
    if (!saveWallpaper(next)) {
      setNote("That photo is too big to keep on this phone — try a smaller one.");
      return;
    }
    setWall(next);
  }

  async function choosePhoto(file: File | undefined) {
    if (!file) return;
    try {
      pick({ kind: "photo", photo: await wallpaperPhoto(file) });
    } catch (e) {
      setNote(e instanceof Error ? e.message : "That photo couldn't be used");
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="mt-6">
      <h2 className="px-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Home Wallpaper</h2>
      <div className="mt-2 rounded-3xl bg-white p-4 shadow-sm dark:bg-[#1c1c1e]">
        <div className="grid grid-cols-5 gap-2">
          {WALLPAPERS.map((w) => {
            const chosen = wall?.kind === w.kind;
            const preview = w.kind === "photo" && wall?.kind === "photo" ? wallpaperStyle(wall) : wallpaperStyle({ kind: w.kind });
            return (
              <button
                key={w.kind}
                onClick={() => (w.kind === "photo" ? input.current?.click() : pick({ kind: w.kind }))}
                aria-pressed={chosen}
                className="press flex flex-col items-center gap-1.5 text-center text-[11px] font-semibold leading-tight text-gray-700 dark:text-gray-200"
              >
                <span
                  className={`relative block aspect-[9/16] w-full overflow-hidden rounded-xl bg-gray-100 ring-2 dark:bg-white/10 ${
                    chosen ? "ring-green-600 dark:ring-green-400" : "ring-transparent"
                  }`}
                >
                  {preview && <span className="absolute inset-0" style={preview} />}
                  {w.kind === "photo" && !(wall?.kind === "photo") && (
                    <svg viewBox="0 0 24 24" className="absolute inset-0 m-auto h-6 w-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  )}
                </span>
                {w.label}
              </button>
            );
          })}
        </div>
        {wall?.kind === "photo" && (
          <button onClick={() => input.current?.click()} className="mt-3 text-sm font-semibold text-green-700 dark:text-green-400">
            Choose a different photo
          </button>
        )}
        {note && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{note}</p>}
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => choosePhoto(e.target.files?.[0])} />
      </div>
      <p className="mt-3 px-2 text-sm text-gray-500 dark:text-gray-400">Shown behind the home screen on this phone. Your photo stays on this phone.</p>
    </div>
  );
}
