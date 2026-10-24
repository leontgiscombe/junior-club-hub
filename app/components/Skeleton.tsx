// Grey placeholder shapes while a page loads, like a phone app's, instead of
// "Loading…" or a flash of the sign-in box: the page's own shape, so it seems
// to arrive at once. The loading.tsx files show them straight away when
// someone taps through to a page, while it fetches.

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

/**
 * A tab bar page loading (Home, Kit, Search…): the header row (your photo,
 * Search, the crest), the large title, then cards — `grid`, Coach Admin's tiles.
 */
export function PageSkeleton({ grid = false }: { grid?: boolean }) {
  const bar = "animate-pulse rounded-full bg-gray-200 dark:bg-white/10";
  const card = "animate-pulse rounded-3xl bg-white shadow-sm dark:bg-[#1c1c1e]";
  return (
    <main className="themed wp-page min-h-screen bg-[#f2f2f7] dark:bg-black" aria-busy="true" aria-label="Loading">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between pt-2">
          <span className={`h-11 w-11 ${bar}`} />
          <span className="flex gap-3">
            <span className={`h-11 w-11 ${bar}`} />
            <span className={`h-11 w-11 ${bar}`} />
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <span className={`h-9 w-44 ${bar}`} />
          <span className={`h-4 w-32 ${bar}`} />
        </div>
        {grid ? (
          <div className={`grid grid-cols-3 gap-x-3 gap-y-5 p-4 ${card}`}>
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className="flex flex-col items-center gap-2">
                <span className="h-14 w-14 rounded-2xl bg-gray-200 dark:bg-white/10" />
                <span className="h-3 w-14 rounded-full bg-gray-200 dark:bg-white/10" />
              </span>
            ))}
          </div>
        ) : (
          <>
            <span className={`h-5 w-24 ${bar}`} />
            <div className={`h-36 ${card}`} />
            <div className={`h-24 ${card}`} />
            <div className={`h-24 ${card}`} />
          </>
        )}
      </div>
    </main>
  );
}

/** A few rows loading inside a card or list: a round picture and two lines each. */
export function RowsSkeleton({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`flex flex-col divide-y divide-gray-100 dark:divide-white/10 ${className}`} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-3 py-3">
          <span className="h-10 w-10 shrink-0 rounded-xl bg-gray-200 dark:bg-white/10" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="h-3.5 w-2/3 rounded-full bg-gray-200 dark:bg-white/10" />
            <span className="h-3 w-1/3 rounded-full bg-gray-200 dark:bg-white/10" />
          </span>
        </div>
      ))}
    </div>
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
