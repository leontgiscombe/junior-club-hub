"use client";

// Find your club: type part of its name and pick it from the list.
import { useEffect, useState } from "react";

export default function FindClub() {
  const [q, setQ] = useState("");
  const [clubs, setClubs] = useState<{ name: string; url: string }[] | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/clubs?q=${encodeURIComponent(q.trim())}`);
      setClubs(res.ok ? (await res.json()).clubs : []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          if (e.target.value.trim().length < 2) setClubs(null);
        }}
        placeholder="Your club's name"
        className="w-full rounded-2xl border border-gray-200 px-4 py-3.5 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-400"
      />
      {clubs && (
        <div className="mt-3 flex flex-col gap-2">
          {clubs.length === 0 && <p className="text-sm text-gray-500">No club by that name yet.</p>}
          {clubs.map((c) => (
            <a
              key={c.url}
              href={c.url}
              className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 font-bold text-gray-900 shadow-sm hover:border-green-400"
            >
              {c.name}
              <span className="text-green-700">→</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
