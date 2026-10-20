"use client";
// Home's card for a parent whose child (in the squad) has no device of their
// own yet: set one up for the Training Hub (PlayerDevices' sheet, with the
// code). Not now hides it on this phone; once every child has a device, Home
// doesn't draw it at all.
import { useState } from "react";
import { useRouter } from "next/navigation";
import PlayerDevices from "./PlayerDevices";
import { DEVICE_PROMPT_COOKIE } from "@/lib/homeWidgets";

type Kid = { playerId: string; name: string };

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
const and = (names: string[]) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

export default function DevicePrompt({ kids }: { kids: Kid[] }) {
  const router = useRouter();
  const [gone, setGone] = useState(false);
  if (gone || !kids.length) return null;

  const notNow = () => {
    document.cookie = `${DEVICE_PROMPT_COOKIE}=off; path=/; max-age=31536000; samesite=lax`;
    setGone(true);
  };
  const names = and(kids.map((k) => firstName(k.name)));
  const button = "press min-h-10 rounded-full bg-green-600 px-4 text-sm font-bold text-white";
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm dark:bg-[#1c1c1e]">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-green-50 text-green-700 dark:bg-green-400/10 dark:text-green-400">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
            <path d="M11 18.5h2" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Give {names} the Training Hub</span>
          <span className="mt-0.5 block text-sm text-gray-500 dark:text-gray-400">
            On {kids.length > 1 ? "their own phones or tablets" : "their own phone or tablet"} — quizzes, skill challenges and how we play.
            No email or password needed.
          </span>
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 pl-16">
        {kids.map((k) => (
          <PlayerDevices
            key={k.playerId}
            playerId={k.playerId}
            name={k.name}
            label={kids.length > 1 ? `Set Up ${firstName(k.name)}'s` : "Set Up a Device"}
            className={button}
            // a device set up there takes this card (or that child) away
            onClose={() => router.refresh()}
          />
        ))}
        <button type="button" onClick={notNow} className="press min-h-10 px-3 text-sm font-semibold text-gray-500 dark:text-gray-400">
          Not now
        </button>
      </div>
    </section>
  );
}
