"use client";

// The team a coach tool is showing, at the top of the page: a tap opens a
// sheet of the club's teams (a tick on this one), as an iPhone app picks,
// instead of the browser's dropdown.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import NoTabBar from "./NoTabBar";

export type PickerOption = { value: string; label: string };

export default function TeamPicker({
  value,
  onChange,
  options,
  disabled = false,
  className = "",
  label = "Team",
}: {
  value: string;
  onChange: (value: string) => void;
  options: PickerOption[];
  disabled?: boolean;
  className?: string;
  /** what's being picked, for screen readers and the sheet's title */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function close() {
    setShown(false);
    setTimeout(() => setOpen(false), 180);
  }

  // one team: nothing to pick, so just its name
  if (options.length <= 1) {
    return (
      <div className={className}>
        <p className="flex h-11 items-center px-1 text-[15px] font-bold text-gray-900 dark:text-gray-50">{current?.label ?? ""}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-label={`${label}: ${current?.label ?? ""}`}
        className="flex h-11 w-full items-center gap-2 rounded-xl bg-white px-4 text-left shadow-sm ring-1 ring-black/5 disabled:opacity-50 dark:bg-[#1c1c1e] dark:ring-white/10"
      >
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-gray-900 dark:text-gray-50">{current?.label ?? "Choose…"}</span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m7 9 5-5 5 5M7 15l5 5 5-5" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            className={`themed fixed inset-0 z-50 flex items-end justify-center bg-black/40 transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`}
            onClick={close}
          >
            <NoTabBar />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={label}
              onClick={(e) => e.stopPropagation()}
              className={`max-h-[80dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 text-gray-900 shadow-xl transition-transform duration-200 dark:bg-[#1c1c1e] dark:text-gray-50 ${shown ? "translate-y-0" : "translate-y-full"}`}
            >
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300 dark:bg-white/20" aria-hidden />
              <h2 className="text-lg font-extrabold">{label}</h2>
              <div className="mt-2 divide-y divide-gray-100 dark:divide-white/10" role="listbox" aria-label={label}>
                {options.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={o.value === value}
                    onClick={() => {
                      if (o.value !== value) onChange(o.value);
                      close();
                    }}
                    className="flex min-h-12 w-full items-center gap-3 py-3 text-left"
                  >
                    <span className={`min-w-0 flex-1 truncate text-[16px] ${o.value === value ? "font-bold" : ""}`}>{o.label}</span>
                    {o.value === value && (
                      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-green-600" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m5 12 5 5 9-10" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
