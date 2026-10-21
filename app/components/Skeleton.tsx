// Grey placeholder shapes while a page loads, like a phone app's, instead of
// "Loading…" or a flash of the sign-in box. The loading.tsx files show
// LoadingDots straight away when someone taps through to a page, while it fetches.

/** A whole coach screen loading: the top bar, a row of tabs and a few cards. */
export function ToolSkeleton() {
  const bar = "animate-pulse rounded-full bg-gray-200 dark:bg-white/10";
  const card = "animate-pulse rounded-3xl bg-white shadow-sm dark:bg-[#1c1c1e]";
  return (
    <main className="themed min-h-screen bg-[#f2f2f7] dark:bg-black" aria-busy="true" aria-label="Loading">
      <div className="px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="relative mx-auto flex h-12 max-w-xl items-center justify-center">
          <span className="absolute left-0 h-12 w-12 animate-pulse rounded-full bg-white shadow-md dark:bg-[#1c1c1e]" />
          <span className={`h-5 w-36 ${bar}`} />
        </div>
      </div>
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-2">
        <div className="flex gap-2">
          <span className={`h-10 flex-1 ${bar} rounded-xl`} />
          <span className={`h-10 flex-1 ${bar} rounded-xl`} />
        </div>
        <div className={`h-40 ${card}`} />
        <div className={`h-24 ${card}`} />
        <div className={`h-24 ${card}`} />
      </div>
    </main>
  );
}

/** Three grey dots that swell in turn, for the moment between tapping a link and the page arriving (the loading.tsx files). */
export function LoadingDots() {
  return (
    <main
      className="themed wp-page flex min-h-screen items-center justify-center bg-[#f2f2f7] dark:bg-black"
      aria-busy="true"
      aria-label="Loading"
    >
      <Dots />
    </main>
  );
}

/**
 * The dots over the whole screen, below the tab bar: on the way to a page
 * outside the app's own routes, which a loading.tsx can't cover (LeavingDots).
 * public/loading-dots.js draws the same on those pages.
 */
export function LoadingCover() {
  return (
    <div
      className="themed fixed inset-0 z-30 flex items-center justify-center bg-[#f2f2f7] dark:bg-black"
      aria-busy="true"
      aria-label="Loading"
    >
      <Dots />
    </div>
  );
}

function Dots() {
  return (
    <div className="flex h-3.5 items-center gap-3" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} className="loading-dot h-3.5 w-3.5 rounded-full bg-gray-400 dark:bg-white/40" style={{ animationDelay: `${i * 160}ms` }} />
      ))}
    </div>
  );
}
