// Grey placeholder shapes while a page loads, like a phone app's, instead of
// "Loading…" or a flash of the sign-in box.

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
