"use client";

// A round ••• button that opens a sheet of the page's less-used actions
// (exports, slideshows…), so the page itself keeps only what's used every visit.
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useScrollLock } from "./useScrollLock";
import { createPortal } from "react-dom";

export type MoreItem = {
  label: string;
  /** a line under the label saying what it does */
  hint?: string;
  icon?: ReactNode;
  disabled?: boolean;
} & ({ href: string; onClick?: never } | { onClick: () => void; href?: never });

export function MoreMenu({ title = "More", items }: { title?: string; items: MoreItem[] }) {
  const [open, setOpen] = useState(false);
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  const row = (item: MoreItem) => (
    <>
      {item.icon && (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-green-50 text-green-700 dark:bg-green-400/10 dark:text-green-400">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {item.icon}
          </svg>
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold">{item.label}</span>
        {item.hint && <span className="block text-xs text-gray-500 dark:text-gray-400">{item.hint}</span>}
      </span>
    </>
  );
  const rowClass =
    "flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 disabled:cursor-default disabled:opacity-40 dark:hover:bg-white/5";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={title}
        title={title}
        className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full bg-white text-gray-700 shadow-sm hover:text-green-700 dark:bg-[#1c1c1e] dark:text-gray-200"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>

      {/* on the page's body: the page's slide-in wrapper would keep it under the tab bar */}
      {open &&
        createPortal(
          <div
            className="themed fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-black/40 sm:items-center"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={title}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-3xl bg-[#f2f2f7] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 text-gray-900 shadow-2xl dark:bg-[#1c1c1e] dark:text-gray-50 sm:rounded-3xl"
            >
              <h2 className="pb-3 text-center text-[17px] font-semibold">{title}</h2>
              <ul className="divide-y divide-gray-100 overflow-hidden rounded-3xl bg-white dark:divide-white/10 dark:bg-black/40">
                {items.map((item) => (
                  <li key={item.label}>
                    {item.href && !item.disabled ? (
                      <Link href={item.href} onClick={() => setOpen(false)} className={rowClass}>
                        {row(item)}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={item.disabled}
                        onClick={() => {
                          setOpen(false);
                          item.onClick?.();
                        }}
                        className={rowClass}
                      >
                        {row(item)}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-3 w-full cursor-pointer rounded-3xl bg-white py-3 text-[16px] font-bold text-green-700 dark:bg-black/40 dark:text-green-400"
              >
                Cancel
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
