"use client";

// A person's name as two boxes, first and last, side by side. It's kept as one
// "First Last" string everywhere else, so this splits it to show and joins it
// back up on every change.
import { useState } from "react";

const join = (first: string, last: string) => `${first.trim()} ${last.trim()}`.trim();

/** "Mary Ann Smith" -> ["Mary Ann", "Smith"]: the last word is the surname. */
function split(name: string): [string, string] {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return [words[0] ?? "", ""];
  return [words.slice(0, -1).join(" "), words[words.length - 1]];
}

export default function NameFields({
  value,
  onChange,
  className,
  label = "",
  required = false,
  autoComplete = false,
}: {
  value: string;
  onChange: (name: string) => void;
  /** the input boxes' classes */
  className: string;
  /** whose name, for screen readers: "Child 1's" */
  label?: string;
  required?: boolean;
  /** the browser may fill in the person's own name */
  autoComplete?: boolean;
}) {
  const [parts, setParts] = useState(() => split(value));
  // a name set from outside (loaded, or reset) shows; one typed here stays as typed
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (value !== join(parts[0], parts[1])) setParts(split(value));
  }
  const set = (first: string, last: string) => {
    setParts([first, last]);
    setSeen(join(first, last));
    onChange(join(first, last));
  };
  const whose = label ? `${label} ` : "";
  return (
    <div className="flex min-w-0 flex-1 basis-56 gap-2">
      <input
        value={parts[0]}
        onChange={(e) => set(e.target.value, parts[1])}
        maxLength={30}
        required={required}
        placeholder="First name"
        aria-label={`${whose}first name`}
        autoComplete={autoComplete ? "given-name" : "off"}
        autoCapitalize="words"
        className={`${className} min-w-0 flex-1`}
      />
      <input
        value={parts[1]}
        onChange={(e) => set(parts[0], e.target.value)}
        maxLength={30}
        required={required}
        placeholder="Last name"
        aria-label={`${whose}last name`}
        autoComplete={autoComplete ? "family-name" : "off"}
        autoCapitalize="words"
        className={`${className} min-w-0 flex-1`}
      />
    </div>
  );
}
