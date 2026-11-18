import { APP_STORE_LINK } from "@/lib/appStore";

/** "Download on the App Store", in the style of Apple's badge. */
export default function AppStoreBadge({ href = APP_STORE_LINK, className = "" }: { href?: string; className?: string }) {
  return (
    <a
      href={href}
      className={`mx-auto inline-flex items-center gap-2.5 rounded-xl bg-black px-4 py-2 text-left text-white ring-1 ring-white/40 hover:bg-gray-900 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true">
        <path d="M16.37 12.7c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.24 2.73 2.2 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.41 1.2-2.47-.03-.01-2.3-.88-2.32-3.5zM14.2 6.23c.6-.74 1.01-1.75.9-2.77-.87.04-1.93.58-2.55 1.31-.56.65-1.05 1.69-.92 2.69.97.08 1.97-.49 2.57-1.23z" />
      </svg>
      <span className="leading-tight">
        <span className="block text-[10px]">Download on the</span>
        <span className="block text-lg font-semibold">App Store</span>
      </span>
    </a>
  );
}
