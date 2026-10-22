"use client";

// A drill as coaches read it — on the training plans page and against each
// session in the training log.
import { DRILL_KINDS, bandName, topicName, type Drill, type DrillKind } from "@/lib/trainingPlanTypes";

const KIND_STYLES: Record<DrillKind, string> = {
  "warm-up": "bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300",
  technical: "bg-sky-50 text-sky-800 dark:bg-sky-400/10 dark:text-sky-300",
  game: "bg-green-50 text-green-800 dark:bg-green-400/10 dark:text-green-300",
};

function kindName(kind: DrillKind) {
  return DRILL_KINDS.find((k) => k.slug === kind)?.name ?? kind;
}

export function KindBadge({ kind }: { kind: DrillKind }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${KIND_STYLES[kind]}`}
    >
      {kindName(kind)}
    </span>
  );
}

/** Everything about a drill, laid out to be read on a phone at the pitch. */
export function DrillDetails({ drill, adminKey }: { drill: Drill; adminKey: string }) {
  const fileUrl = (name: string) =>
    `/api/training/files?key=${encodeURIComponent(adminKey)}&name=${encodeURIComponent(name)}`;
  // the drill pack's own files, then the photos and PDFs coaches have added
  const uploadUrl = (id: string) =>
    `/api/training/files?key=${encodeURIComponent(adminKey)}&drill=${encodeURIComponent(drill.id)}&file=${encodeURIComponent(id)}`;
  const all = [
    ...drill.files.map((f) => ({ key: f.name, label: f.label, type: f.type, url: fileUrl(f.name) })),
    ...(drill.uploads ?? []).map((u) => ({ key: u.id, label: u.label, type: u.type, url: uploadUrl(u.id) })),
  ];
  const images = all.filter((f) => f.type === "image");
  const pdfs = all.filter((f) => f.type === "pdf");
  const facts = [
    drill.topic ? `⚽ ${topicName(drill.topic)}` : "",
    drill.minutes ? `⏱ ${drill.minutes} min` : "",
    drill.players ? `👥 ${drill.players} players` : "",
    drill.ageGroup ? `🎂 ${bandName(drill.ageGroup)}` : "",
  ].filter(Boolean);
  return (
    <div className="flex flex-col gap-3 text-sm text-gray-700 dark:text-gray-200">
      {/* the session-plan pages first: the diagram is what's wanted at the pitch */}
      {images.map((f) => (
        <a
          key={f.key}
          href={f.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`${f.label} — open full size`}
          className="block overflow-hidden rounded-xl border border-gray-100 dark:border-white/10"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- served behind the admin password, so not through the image optimiser */}
          <img src={f.url} alt={`${drill.title}: ${f.label}`} loading="lazy" className="w-full" />
        </a>
      ))}
      {facts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {facts.map((f) => (
            <span key={f} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-300">
              {f}
            </span>
          ))}
        </div>
      )}
      {drill.equipment && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Equipment</p>
          <p className="mt-0.5 whitespace-pre-line">{drill.equipment}</p>
        </div>
      )}
      {drill.setup && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Setup</p>
          <p className="mt-0.5 whitespace-pre-line">{drill.setup}</p>
        </div>
      )}
      {drill.howItWorks && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            How it works
          </p>
          <p className="mt-0.5 whitespace-pre-line">{drill.howItWorks}</p>
        </div>
      )}
      {drill.coachingPoints.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Coaching points
          </p>
          <ul className="mt-1 flex flex-col gap-1">
            {drill.coachingPoints.map((p, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-bold text-green-600 dark:text-green-400" aria-hidden="true">✓</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {drill.progressions.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Progressions
          </p>
          <ul className="mt-0.5 list-disc pl-5">
            {drill.progressions.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      {drill.videoUrl && (
        <a
          href={drill.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start rounded-full bg-green-600 px-3 py-1 text-xs font-bold text-white hover:bg-green-700"
        >
          ▶ Watch video
        </a>
      )}
      {pdfs.map((f) => (
        <a
          key={f.key}
          href={f.url}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start rounded-full border border-gray-200 px-3 py-1 text-xs font-bold text-gray-700 hover:border-green-400 hover:text-green-700 dark:text-gray-200 dark:border-white/15"
        >
          📄 {f.label}
        </a>
      ))}
    </div>
  );
}
