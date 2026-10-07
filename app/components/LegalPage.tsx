// The privacy policy's and terms' shared layout: plain, readable, printable.
import Link from "next/link";
import { LEGAL_UPDATED } from "@/lib/legal";

export function LegalPage({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <article className="mx-auto max-w-2xl rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10">
        <Link href="/" className="text-sm font-semibold text-gray-500 hover:text-green-700">
          ← Home
        </Link>
        <h1 className="mt-3 text-3xl font-extrabold text-gray-900">{title}</h1>
        <p className="mt-1 text-sm text-gray-400">Last updated {LEGAL_UPDATED}</p>
        <p className="mt-4 text-gray-700">{intro}</p>
        <div className="mt-6 flex flex-col gap-6 text-[15px] leading-relaxed text-gray-700">{children}</div>
        <p className="mt-10 border-t border-gray-100 pt-4 text-sm text-gray-500">
          <Link href="/privacy" className="font-semibold text-green-700 hover:underline">Privacy Policy</Link>
          {" · "}
          <Link href="/terms" className="font-semibold text-green-700 hover:underline">Terms of Use</Link>
        </p>
      </article>
    </main>
  );
}

export function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-extrabold text-gray-900">{title}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

export function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="ml-5 list-disc space-y-1.5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
