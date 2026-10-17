"use client";

import Link from "next/link";
import { TopBar } from "../components/SettingsUI";

export const surface = "rounded-lg bg-white shadow-sm dark:bg-[#1c1c1e]";
export const muted = "text-gray-500 dark:text-gray-400";
export const field = "mt-1 min-h-11 w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-base text-gray-900 dark:border-white/15 dark:bg-[#1c1c1e] dark:text-gray-50";
export const command = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40";

export function PreviewFrame({ title, area, onBack, children }: {
  title: string; area: "training" | "account" | "kit"; onBack?: () => void; children: React.ReactNode;
}) {
  return <div className="themed min-h-screen bg-[#f2f2f7] text-gray-900 dark:bg-black dark:text-gray-50">
    {onBack ? <TopBar title={title} onBack={onBack} /> : <TopBar title={title} href="/" />}
    <main className="mx-auto max-w-2xl px-4 pb-12 pt-4">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-200"><span className="h-2 w-2 rounded-full bg-amber-500" />Preview · Sample data</span>
        <Link href={area === "kit" ? "/kit" : area === "training" ? "/preview/account" : "/preview/training"} className="min-h-8 py-1 text-xs font-semibold text-green-700 underline underline-offset-4 dark:text-green-400">{area === "kit" ? "Current Kit" : area === "training" ? "Account preview" : "Training preview"}</Link>
      </div>
      {children}
    </main>
  </div>;
}

export function PreviewRow({ title, detail, icon, onClick, children }: {
  title: string; detail?: string; icon?: React.ReactNode; onClick: () => void; children?: React.ReactNode;
}) {
  return <button type="button" onClick={onClick} className="flex min-h-18 w-full items-center gap-3 px-4 py-3 text-left">
    {icon && <span className="shrink-0 text-green-700 dark:text-green-400">{icon}</span>}
    <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold">{title}</span>{detail && <span className={`mt-1 block text-xs ${muted}`}>{detail}</span>}</span>
    {children}<span aria-hidden="true" className="shrink-0 text-gray-400">›</span>
  </button>;
}