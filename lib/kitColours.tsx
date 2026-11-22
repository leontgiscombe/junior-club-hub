// The shirt colours a coach can pick for each side of a game (app/fixtures):
// a name families read ("Wear: red") and a colour to draw the shirt in.
// No server-only imports.
export const KIT_COLOURS = {
  red: { label: "Red", fill: "#dc2626" },
  claret: { label: "Claret", fill: "#7f1d1d" },
  orange: { label: "Orange", fill: "#f97316" },
  yellow: { label: "Yellow", fill: "#facc15" },
  green: { label: "Green", fill: "#16a34a" },
  sky: { label: "Sky blue", fill: "#38bdf8" },
  blue: { label: "Blue", fill: "#2563eb" },
  navy: { label: "Navy", fill: "#1e3a8a" },
  purple: { label: "Purple", fill: "#7c3aed" },
  pink: { label: "Pink", fill: "#ec4899" },
  black: { label: "Black", fill: "#111827" },
  grey: { label: "Grey", fill: "#9ca3af" },
  white: { label: "White", fill: "#ffffff" },
} as const;
export type KitColour = keyof typeof KIT_COLOURS;
export const isKitColour = (v: unknown): v is KitColour => typeof v === "string" && v in KIT_COLOURS;

/** A shirt in a kit colour (white gets an outline so it shows on white). */
export function Shirt({ colour, className = "h-6 w-6" }: { colour: string; className?: string }) {
  const kit = isKitColour(colour) ? KIT_COLOURS[colour] : null;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M8 3 4 5.5 2.5 10l3 1.2V21h13v-9.8l3-1.2L20 5.5 16 3a4 4 0 0 1-8 0z"
        fill={kit?.fill ?? "none"}
        stroke={kit && colour !== "white" ? "rgba(0,0,0,.25)" : "#9ca3af"}
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeDasharray={kit ? undefined : "2 2"}
      />
    </svg>
  );
}
