// Line icons for the coaches' tools, in the tab bar's and Settings' style,
// instead of emoji (which look different on every phone). The players' Training
// Hub, the posters and Presentation Mode keep their emoji: fun suits them there.
// No hooks: server and client pages both use them.

const line = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function Svg({ children, className = "h-4 w-4" }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...line}>
      {children}
    </svg>
  );
}

const PATHS = {
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  boot: <><path d="M4 6h5l1 6 9 3a2 2 0 0 1 1 2v1H4z" /><path d="M4 18h16M8 12h2" /></>,
  ball: <><circle cx="12" cy="12" r="9" /><path d="m12 7 4 3-1.5 4.5h-5L8 10z" /><path d="M12 3v4M16 10l4.5-1.5M14.5 14.5l2.5 4M9.5 14.5 7 18.5M8 10 3.5 8.5" /></>,
  assist: <><path d="M4 12h12M12 6l6 6-6 6" /></>,
  glove: <><path d="M7 21v-6l-2-3V7a1.5 1.5 0 0 1 3 0v4V4.5a1.5 1.5 0 0 1 3 0V10V4a1.5 1.5 0 0 1 3 0v6V5.5a1.5 1.5 0 0 1 3 0V14l-2 3v4" /></>,
  stop: <><circle cx="12" cy="12" r="9" /><path d="m6 6 12 12" /></>,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M10 17h4" /></>,
  trend: <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  bolt: <><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></>,
  medal: <><circle cx="12" cy="15" r="5" /><path d="m8 3 4 7 4-7M12 13v4" /></>,
  shirt: <><path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0z" /></>,
  shorts: <><path d="M5 4h14l1 15h-6l-2-7-2 7H4z" /><path d="M5 7h14" /></>,
  socks: <><path d="M9 3h6v9l3 4a3 3 0 0 1-2 5h-3l-4-5z" /><path d="M9 7h6" /></>,
  file: <><path d="M14 3H6v18h12V7z" /><path d="M14 3v4h4M9 13h6M9 17h6" /></>,
  image: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-8 8" /></>,
  people: <><circle cx="9" cy="8" r="3.2" /><path d="M3 19a6 6 0 0 1 12 0" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14a5 5 0 0 1 5 5" /></>,
  cake: <><path d="M4 21h16v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z" /><path d="M4 16c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 4 0M12 11V7M12 4.5v.01" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  camera: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7l2-3h4l2 3" /><circle cx="12" cy="13.5" r="3.5" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  inbox: <><path d="M3 13h5l2 3h4l2-3h5" /><path d="M5 5h14l2 8v6H3v-6z" /></>,
  goal: <><path d="M3 20V6h18v14" /><path d="M3 10h18M3 14h18M8 6v14M13 6v14M18 6v14" /></>,
} as const;

export type IconName = keyof typeof PATHS;

/** One of the line icons, at a size given by className (default 16px). */
export function Icon({ name, className }: { name: IconName; className?: string }) {
  return <Svg className={className}>{PATHS[name]}</Svg>;
}

/** The password screens' badge: a lock on the club's green. */
export function GateIcon() {
  return (
    <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-green-700 text-white shadow-sm">
      <Icon name="lock" className="h-7 w-7" />
    </span>
  );
}

/** Nothing here yet: an icon, a line on what goes here, and the button that adds it. */
export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-gray-200/70 text-gray-500 dark:bg-white/10 dark:text-gray-400">
        <Icon name={icon} className="h-8 w-8" />
      </span>
      <p className="mt-4 text-[17px] font-bold text-gray-900 dark:text-gray-50">{title}</p>
      {body && <p className="mt-1 max-w-xs text-sm text-gray-500 dark:text-gray-400">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** The green pill button an empty screen offers. */
export const emptyAction = "inline-flex h-10 items-center gap-1.5 rounded-full bg-green-700 px-5 text-sm font-bold text-white hover:bg-green-800";
