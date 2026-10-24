"use client";

// The round back button at the top left of every page that isn't one of the
// tab bar's main pages, like a phone app's. It goes back to the page you came
// from, or — opened from a link, with nowhere to go back to — up to the page
// this one belongs to (lib/back.ts).
import Link from "next/link";
import { backOr } from "@/lib/back";

export default function BackButton({
  href,
  label,
  light = false,
  className = "",
}: {
  href: string;
  /** where it goes, for screen readers: "Back to {label}" */
  label: string;
  /** on a light background: a white button; otherwise glass over the banner */
  light?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      onClick={backOr}
      // a swipe in from the left edge presses it, in the app (public/app-feel.js)
      data-swipe-back
      aria-label={`Back to ${label}`}
      title={label}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors ${
        light
          ? "bg-white text-gray-900 shadow-md ring-1 ring-black/5 hover:bg-gray-50 dark:hover:bg-white/5 dark:bg-[#1c1c1e] dark:text-gray-50 dark:ring-white/10"
          : "bg-white/15 text-white shadow-lg ring-1 ring-white/30 backdrop-blur-md hover:bg-white/25"
      } ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </Link>
  );
}
