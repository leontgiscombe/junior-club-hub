"use client";

// Your Account → Appearance: Light, Dark, or Match My Phone (lib/theme.ts),
// for this device. The pages built for both switch straight away.
import { useEffect, useState } from "react";
import { THEMES, applyTheme, savedTheme, type ThemeChoice } from "@/lib/theme";

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
    </div>
  );
}
