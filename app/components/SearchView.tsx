"use client";

// The Search page: a box at the top, and what matches as you type — pages and
// settings (found here, lib/searchIndex.ts), Help topics, and the club's own
// data from /api/search — grouped, each opening where it lives.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { TopBar } from "./SettingsUI";
import { score, type PageEntry } from "@/lib/searchIndex";

type Hit = { kind: string; title: string; sub: string; href?: string; external?: boolean; score: number };

const MAX_PAGES = 8;

export default function SearchView({
  pages,
  help,
  searchData,
  hint,
}: {
  pages: PageEntry[];
  help: { id: string; title: string; words: string }[];
  searchData: boolean;
  hint: string;
}) {
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ q: string; results: Hit[] }>({ q: "", results: [] });
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLInputElement>(null);

  useEffect(() => box.current?.focus(), []);

  // the club's data: asked for once typing pauses
  useEffect(() => {
    const query = q.trim();
    if (!searchData || query.length < 2) return;
    let stale = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
        const json = res.ok ? await res.json() : { results: [] };
        if (!stale) setData({ q: query, results: json.results ?? [] });
      } finally {
        if (!stale) setLoading(false);
      }
    }, 250);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [q, searchData]);

  const query = q.trim();
  const pageHits: Hit[] = query
    ? pages
        .map((p) => ({ kind: "Pages & Settings", title: p.title, sub: p.where, href: p.href, external: p.external, score: score(query, p.title, `${p.where} ${p.words}`) }))
        .filter((h) => h.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_PAGES)
    : [];
  const helpHits: Hit[] = query
    ? help
        .map((h) => ({ kind: "Help", title: h.title, sub: "Help", href: `/admin/help#${h.id}`, score: score(query, h.title, h.words) }))
        .filter((h) => h.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
    : [];
  const dataHits = query.length >= 2 && data.q === query ? data.results : [];
  const groups = new Map<string, Hit[]>();
  for (const h of [...pageHits, ...dataHits, ...helpHits]) groups.set(h.kind, [...(groups.get(h.kind) ?? []), h]);
  const waiting = searchData && query.length >= 2 && (loading || data.q !== query);

  return (
    <main className="themed min-h-screen bg-gray-100 pb-16 dark:bg-black dark:text-gray-50">
      <TopBar title="Search" href="/" />
      <div className="mx-auto max-w-xl px-4">
        <label className="relative mt-2 block">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={box}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the hub"
            aria-label="Search the hub"
            enterKeyHint="search"
            className="w-full rounded-2xl bg-white py-3 pl-11 pr-4 text-[17px] text-gray-900 shadow-sm ring-1 ring-black/5 focus:outline-none focus:ring-2 focus:ring-green-400 dark:bg-[#1c1c1e] dark:text-gray-50 dark:ring-white/10"
          />
        </label>

        {!query && <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">{hint}</p>}

        {[...groups].map(([kind, hits]) => (
          <section key={kind} className="mt-5">
            <h2 className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{kind}</h2>
            <div className="divide-y divide-gray-100 overflow-hidden rounded-3xl bg-white shadow-sm dark:divide-white/10 dark:bg-[#1c1c1e]">
              {hits.map((h, i) => {
                const inner = (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{h.title}</span>
                      <span className="block truncate text-sm text-gray-500 dark:text-gray-400">{h.sub}</span>
                    </span>
                    {h.href && (
                      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                    )}
                  </>
                );
                const row = "flex items-center gap-3 px-4 py-3";
                return !h.href ? (
                  <div key={i} className={row}>
                    {inner}
                  </div>
                ) : h.external ? (
                  <a key={i} href={h.href} className={`press ${row}`}>
                    {inner}
                  </a>
                ) : (
                  <Link key={i} href={h.href} className={`press ${row}`}>
                    {inner}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        {query && !groups.size && !waiting && (
          <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">Nothing found for “{query}”.</p>
        )}
        {waiting && <p className="mt-4 text-center text-xs text-gray-400">Searching…</p>}
      </div>
    </main>
  );
}
