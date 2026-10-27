// Each part of the hub's icon tile colour, the same wherever its tile shows
// (Home, Home's shortcuts, Coach Admin), so a colour always means the same
// thing. Deep shades that sit beside the club's green without fighting it.
export const TILE_COLOURS = {
  matches: "bg-green-700",
  hub: "bg-green-700",
  trainingLog: "bg-teal-700",
  plans: "bg-cyan-700",
  stats: "bg-indigo-600",
  results: "bg-sky-700",
  potm: "bg-amber-600",
  awards: "bg-rose-600",
  camera: "bg-violet-600",
  kit: "bg-blue-700",
  members: "bg-fuchsia-700",
  finances: "bg-emerald-600",
  owes: "bg-red-600",
  spending: "bg-purple-700",
  settings: "bg-gray-500",
  help: "bg-gray-500",
  account: "bg-gray-500",
  coach: "bg-gray-800 dark:bg-gray-600",
} as const;
