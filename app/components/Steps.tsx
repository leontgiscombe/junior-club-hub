// A job done a step at a time: the numbered steps along the top, and Back and
// Next along the bottom.

/** The numbered steps; tap one to go straight to it. */
export function StepBar({
  steps,
  step,
  canMove = true,
  onChange,
  className = "mb-4",
}: {
  steps: { id: string; label: string }[];
  step: number;
  /** false keeps the later steps shut until this one is done */
  canMove?: boolean;
  onChange: (index: number) => void;
  className?: string;
}) {
  return (
    <ol aria-label="Steps" className={`flex items-start ${className}`}>
      {steps.map((s, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <li key={s.id} className="relative flex flex-1 flex-col items-center">
            {i > 0 && (
              <span
                aria-hidden="true"
                className={`absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 ${i <= step ? "bg-green-600" : "bg-gray-200 dark:bg-white/15"}`}
              />
            )}
            <button
              type="button"
              onClick={() => onChange(i)}
              disabled={!canMove && i > step}
              aria-current={current ? "step" : undefined}
              aria-label={`Step ${i + 1}: ${s.label}`}
              className={`relative z-10 grid h-8 w-8 place-items-center rounded-full text-sm font-bold cursor-pointer disabled:cursor-default ${
                current || done
                  ? "bg-green-600 text-white"
                  : "bg-white text-gray-500 ring-1 ring-gray-200 dark:bg-[#1c1c1e] dark:text-gray-400 dark:ring-white/15"
              } ${current ? "ring-4 ring-green-600/25" : ""}`}
            >
              {done ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              ) : (
                i + 1
              )}
            </button>
            <span
              className={`mt-1 text-center text-xs font-semibold ${current ? "text-gray-900 dark:text-gray-50" : "text-gray-500 dark:text-gray-400"}`}
            >
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Back and Next; on the last step, Next becomes the finishing button if there is one. */
export function StepButtons({
  step,
  count,
  canMove = true,
  nextLabel = "Next",
  onChange,
  finish,
  className = "mt-4",
}: {
  step: number;
  count: number;
  canMove?: boolean;
  nextLabel?: string;
  onChange: (index: number) => void;
  finish?: { label: string; onClick: () => void; disabled?: boolean };
  className?: string;
}) {
  const last = step === count - 1;
  return (
    <div className={`flex gap-2 ${className}`}>
      {step > 0 && (
        <button
          type="button"
          onClick={() => onChange(step - 1)}
          className="flex-1 rounded-xl border border-gray-300 bg-white py-3 font-bold text-gray-700 hover:bg-gray-50 cursor-pointer dark:bg-[#1c1c1e] dark:text-gray-200 dark:border-white/15 dark:hover:bg-white/5"
        >
          Back
        </button>
      )}
      {!last ? (
        <button
          type="button"
          onClick={() => onChange(step + 1)}
          disabled={!canMove}
          className="flex-[2] rounded-xl bg-green-600 py-3 font-bold text-white hover:bg-green-700 disabled:opacity-40 cursor-pointer"
        >
          {nextLabel}
        </button>
      ) : (
        finish && (
          <button
            type="button"
            onClick={finish.onClick}
            disabled={finish.disabled}
            className="flex-[2] rounded-xl bg-green-600 py-3 font-bold text-white hover:bg-green-700 disabled:opacity-40 cursor-pointer"
          >
            {finish.label}
          </button>
        )
      )}
    </div>
  );
}
