"use client";

// "Set up your club", on Home and Coach Admin for the club's admins
// (lib/setupChecklist.ts): each step ticks itself when it's done, a tap goes
// straight to where it's done, and the ones about checking something have a
// Done button. Gone once everything's done, or hidden by the admin.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SetupStep } from "@/lib/setupChecklist";
import { ask } from "@/lib/dialog";

export default function SetupCard({ steps }: { steps: SetupStep[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);

  async function send(body: Record<string, string>) {
    setBusy(true);
    await fetch("/api/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    router.refresh();
    setBusy(false);
  }

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm dark:bg-[#1c1c1e]" aria-label="Set up your club">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50">Set Up Your Club</h2>
        <button
          onClick={async () => {
            if (await ask("Hide the set-up steps? You can find everything in Coach Admin → Settings.")) send({ action: "hide" });
          }}
          disabled={busy}
          className="text-sm font-semibold text-gray-400 hover:text-gray-600 disabled:opacity-40 dark:hover:text-gray-200"
        >
          Hide
        </button>
      </div>
      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
        {done} of {steps.length} done{next ? ` · next: ${next.title.toLowerCase()}` : ""}
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
        <div className="h-full rounded-full bg-green-600 transition-[width]" style={{ width: `${Math.round((done / steps.length) * 100)}%` }} />
      </div>
      <ol className="mt-3 divide-y divide-gray-100 dark:divide-white/10">
        {steps.map((s) => {
          const inner = (
            <>
              <span
                className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  s.done ? "bg-green-600 text-white" : s === next ? "border-2 border-green-600 text-green-700 dark:text-green-400" : "border-2 border-gray-200 text-gray-400 dark:border-white/15"
                }`}
                aria-hidden="true"
              >
                {s.done ? "✓" : steps.indexOf(s) + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block font-semibold ${s.done ? "text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-gray-50"}`}>{s.title}</span>
                {!s.done && <span className="block text-sm text-gray-500 dark:text-gray-400">{s.hint}</span>}
              </span>
            </>
          );
          const linkClass = "press flex min-w-0 flex-1 items-start gap-3 text-left";
          return (
            <li key={s.id} className="flex items-center gap-2 py-3">
              {s.external ? (
                <a href={s.href} className={linkClass}>
                  {inner}
                </a>
              ) : (
                <Link href={s.href} className={linkClass}>
                  {inner}
                </Link>
              )}
              {s.manual && !s.done ? (
                <button
                  onClick={() => send({ action: "tick", step: s.id })}
                  disabled={busy}
                  className="shrink-0 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700 disabled:opacity-40 dark:bg-white/10 dark:text-gray-200"
                >
                  Done
                </button>
              ) : (
                !s.done && (
                  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                )
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
