import Link from "next/link";
import Image from "next/image";
import { Anton } from "next/font/google";
import { CLUB } from "@/club.config";

// the same heavy lettering as the home page and the posters
const display = Anton({ weight: "400", subsets: ["latin"] });

/** The kit pages' banner: the home page's paint strokes, crest and lettering. */
export default function KitHeader({
  back,
  title,
  subtitle,
}: {
  back: { href: string; label: string };
  title: string;
  subtitle: string;
}) {
  return (
    <header className="relative overflow-hidden bg-[#060906] px-6 pb-14 pt-6 text-center text-white">
      <Image
        src="/poster/brush-background.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-top opacity-70"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-green-950/30 via-transparent to-green-950/80" />
      <div className="relative">
        <div className="mx-auto w-full max-w-md text-left">
          <Link href={back.href} className="text-sm font-medium text-green-100 hover:text-white">
            ← {back.label}
          </Link>
        </div>
        <Image
          src={CLUB.crest.src}
          alt={CLUB.crest.alt}
          width={CLUB.crest.width}
          height={CLUB.crest.height}
          className="mx-auto mt-3 h-20 w-auto"
          priority
        />
        <h1
          className={`${display.className} mt-3 text-4xl uppercase leading-none tracking-wide drop-shadow-[3px_3px_0_rgba(0,0,0,0.8)]`}
        >
          {title}
        </h1>
        <p className={`${display.className} mt-1 text-lg uppercase tracking-wider text-[#3ee04f]`}>
          {subtitle}
        </p>
        <p className="mx-auto mt-3 inline-block rounded-full border border-white/25 bg-black/30 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-green-100">
          {CLUB.kitSeason} season
        </p>
      </div>
    </header>
  );
}

export function KitFooter() {
  return (
    <footer className="mt-10 bg-[#060906] px-6 py-8 text-center">
      <p className={`${display.className} text-lg uppercase tracking-wide text-[#3ee04f]`}>
        {CLUB.slogan}
      </p>
      <p className="mt-2 text-sm text-gray-400">{CLUB.fullName}</p>
    </footer>
  );
}
