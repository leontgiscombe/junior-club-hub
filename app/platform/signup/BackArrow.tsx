"use client";

// Sign-up's round back arrow: back a step (each step is a page of the
// browser's history, SignupForm), or off sign-up from its first step — to
// the platform's home if sign-up was opened on its own.
export default function BackArrow({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = "/"))}
      aria-label={label}
      className="grid h-12 w-12 cursor-pointer place-items-center rounded-full bg-white text-gray-900 shadow-md ring-1 ring-black/5 hover:bg-gray-50"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  );
}
