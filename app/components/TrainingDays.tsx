"use client";

// A team's weekly training: a day (each only once) and, if known, its start
// and end times, up to MAX_TRAINING_DAYS of them. In Settings → Teams and
// when signing a club up.
import { MAX_TRAINING_DAYS, WEEKDAYS, type TrainingSlot } from "@/lib/clubSettings";

export default function TrainingDays({
  training,
  onChange,
  input,
}: {
  training: TrainingSlot[];
  onChange: (training: TrainingSlot[]) => void;
  input: string;
}) {
  const set = (n: number, patch: Partial<TrainingSlot>) =>
    onChange(training.map((s, k) => (k === n ? { ...s, ...patch } : s)));
  // the next day not taken, Monday first
  const free = [1, 2, 3, 4, 5, 6, 0].find((d) => !training.some((s) => s.day === d));
  const small = input.replace("mt-1 w-full", "w-full").replace("px-3", "px-2");
  // iOS Safari gives time boxes a width of their own, wider than half the row: drop its styling so they fit
  const timeBox = "block min-w-0 max-w-full appearance-none min-h-11 text-left [&::-webkit-date-and-time-value]:text-left";
  return (
    <div>
      <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Training</span>
      <div className="mt-1 flex flex-col gap-2">
        {training.map((s, n) => (
          <div key={n} className="rounded-xl bg-gray-50 p-2.5 dark:bg-white/5">
            <div className="flex items-center gap-2">
              <select
                value={s.day}
                aria-label="Day"
                onChange={(e) => set(n, { day: Number(e.target.value) })}
                className={`${small} min-w-0 flex-1 bg-white font-semibold dark:bg-[#1c1c1e]`}
              >
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <option key={d} value={d} disabled={d !== s.day && training.some((o) => o.day === d)}>
                    {WEEKDAYS[d]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onChange(training.filter((_, k) => k !== n))}
                aria-label={`Remove ${WEEKDAYS[s.day]}`}
                className="h-9 w-9 shrink-0 cursor-pointer rounded-lg text-lg text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-white/10"
              >
                ×
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="min-w-0">
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Starts</span>
                <input
                  type="time"
                  value={s.start ?? ""}
                  onChange={(e) => set(n, { start: e.target.value || undefined, ...(e.target.value ? {} : { end: undefined }) })}
                  className={`${small} ${timeBox} bg-white dark:bg-[#1c1c1e]`}
                />
              </label>
              <label className="min-w-0">
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Ends</span>
                <input
                  type="time"
                  value={s.end ?? ""}
                  disabled={!s.start}
                  onChange={(e) => set(n, { end: e.target.value || undefined })}
                  className={`${small} ${timeBox} bg-white disabled:opacity-40 dark:bg-[#1c1c1e]`}
                />
              </label>
            </div>
          </div>
        ))}
        {training.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No regular training.</p>}
      </div>
      {training.length < MAX_TRAINING_DAYS && free !== undefined && (
        <button
          type="button"
          onClick={() => onChange([...training, { day: free }])}
          className="mt-2 cursor-pointer text-sm font-semibold text-green-700 hover:underline dark:text-green-400"
        >
          + Add a training day
        </button>
      )}
      <span className="mt-1 block text-xs text-gray-400">
        The Training Log, training plans and everyone&apos;s Up next follow these. A change applies from today;
        sessions already past stay as they were.
      </span>
    </div>
  );
}
