// The club's colour (Coach Admin → Settings) turned into a full palette.
// The hub is styled with Tailwind's green scale and a few brand colours, all
// read through CSS variables, so laying a palette made from the club's colour
// over those variables recolours every page. With no colour chosen, nothing
// is overridden and the hub stays green.

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

// Lightness of each step in OKLCH, and how much of the colour's chroma it
// keeps — modelled on Tailwind's own scales.
const LIGHTNESS = [0.982, 0.962, 0.925, 0.871, 0.792, 0.723, 0.627, 0.527, 0.448, 0.393, 0.266];
const CHROMA = [0.12, 0.25, 0.45, 0.75, 1, 1.05, 1, 0.85, 0.7, 0.6, 0.45];

export const HEX = /^#[0-9a-f]{6}$/i;

/** A hex colour as OKLCH: lightness 0–1, chroma, hue in degrees. */
export function hexToOklch(hex: string): { l: number; c: number; h: number } {
  const n = parseInt(hex.slice(1), 16);
  const lin = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = lin;
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: h < 0 ? h + 360 : h };
}

const oklch = (l: number, c: number, h: number) =>
  `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`;

/** The CSS variables that recolour the hub for `hex`, or none for the default green. */
export function clubColourVars(hex: string | undefined): Record<string, string> {
  if (!hex || !HEX.test(hex)) return {};
  const { l, c, h } = hexToOklch(hex);
  // a grey or black colour still gets a faint tint, so the scale has depth
  const chroma = Math.min(Math.max(c, 0.02), 0.25);
  // Step 600 (most buttons) is the club's own shade, kept dark enough for
  // white text and light enough to read as a colour; the darker steps follow
  // it down, the light tints stay as they are.
  const anchor = Math.min(Math.max(l, 0.35), 0.65);
  const lightness = LIGHTNESS.map((base, i) =>
    i >= 6 ? (anchor * base) / LIGHTNESS[6] : i === 5 ? (LIGHTNESS[4] + anchor) / 2 : base,
  );
  const vars: Record<string, string> = {};
  STEPS.forEach((step, i) => {
    vars[`--color-green-${step}`] = oklch(lightness[i], chroma * CHROMA[i], h);
  });
  vars["--club-bright"] = oklch(0.8, Math.min(chroma * 1.1, 0.25), h);
  vars["--club-night"] = oklch(0.16, Math.min(chroma * 0.15, 0.03), h);
  vars["--club-brush-filter"] = "grayscale(1)";
  return vars;
}

/** The hub's own green, spelt out — for previewing it over a saved colour. */
export const DEFAULT_COLOUR_VARS: Record<string, string> = {
  "--color-green-50": "oklch(0.982 0.018 155.826)",
  "--color-green-100": "oklch(0.962 0.044 156.743)",
  "--color-green-200": "oklch(0.925 0.084 155.995)",
  "--color-green-300": "oklch(0.871 0.15 154.449)",
  "--color-green-400": "oklch(0.792 0.209 151.711)",
  "--color-green-500": "oklch(0.723 0.219 149.579)",
  "--color-green-600": "oklch(0.627 0.194 149.214)",
  "--color-green-700": "oklch(0.527 0.154 150.069)",
  "--color-green-800": "oklch(0.448 0.119 151.328)",
  "--color-green-900": "oklch(0.393 0.095 152.535)",
  "--color-green-950": "oklch(0.266 0.065 152.934)",
  "--club-bright": "#3ee04f",
  "--club-night": "#060906",
  "--club-brush-filter": "none",
};

/** Ready-made colours for the Settings page. */
export const PRESET_COLOURS: { name: string; hex: string }[] = [
  { name: "Green", hex: "#16a34a" },
  { name: "Red", hex: "#dc2626" },
  { name: "Claret", hex: "#7f1d3a" },
  { name: "Royal blue", hex: "#1d4ed8" },
  { name: "Sky blue", hex: "#0ea5e9" },
  { name: "Navy", hex: "#1e3a8a" },
  { name: "Orange", hex: "#ea580c" },
  { name: "Amber", hex: "#d97706" },
  { name: "Purple", hex: "#7e22ce" },
  { name: "Black", hex: "#262626" },
];
