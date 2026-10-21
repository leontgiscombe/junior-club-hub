// Drill diagrams: each drill describes its practice area in yards — cones,
// players, goals and the passes, runs, dribbles and shots between them — and
// diagramSvg() draws it as an SVG, so the pack needs no image files.

type Point = [number, number];

export type Team = "a" | "b" | "n" | "gk" | "coach";
export type ConeColor = "yellow" | "orange" | "red" | "blue" | "white";
export type Side = "top" | "bottom" | "left" | "right";
type ArrowKind = "pass" | "run" | "dribble" | "shot";

export type Item =
  | { t: "cone"; at: Point; color: ConeColor }
  | { t: "player"; at: Point; team: Team; label: string; ball: boolean }
  | { t: "queue"; at: Point; team: Team; count: number; dir: Side; ball: boolean }
  | { t: "ball"; at: Point }
  | { t: "pole"; at: Point }
  | { t: "goal"; at: Point; side: Side; width: number }
  | { t: "arrow"; kind: ArrowKind; from: Point; to: Point; bend: number }
  | { t: "zone"; at: Point; w: number; h: number; label: string }
  | { t: "line"; from: Point; to: Point; dashed: boolean }
  | { t: "label"; at: Point; text: string };

export interface Diagram {
  w: number; // the area's width and height, in yards
  h: number;
  items: Item[];
}

// --- building a diagram ---------------------------------------------------

export function diagram(w: number, h: number, ...items: (Item | Item[])[]): Diagram {
  return { w, h, items: items.flat() };
}

type PlayerOpts = { label?: string; ball?: boolean };
const player =
  (team: Team) =>
  (x: number, y: number, opts: PlayerOpts | string = {}): Item => {
    const o = typeof opts === "string" ? { label: opts } : opts;
    return { t: "player", at: [x, y], team, label: o.label ?? "", ball: o.ball ?? false };
  };

/** Players: team A (blue), team B (red), a neutral or server (yellow), a goalkeeper, the coach. */
export const a = player("a");
export const b = player("b");
export const n = player("n");
export const gk = player("gk");
export const coach = (x: number, y: number): Item => player("coach")(x, y, "C");

/** A line of players waiting their turn, the first at (x, y), queuing away in `dir`. */
export function queue(x: number, y: number, team: Team, count: number, dir: Side, ball = false): Item {
  return { t: "queue", at: [x, y], team, count, dir, ball };
}

export const cone = (x: number, y: number, color: ConeColor = "yellow"): Item => ({ t: "cone", at: [x, y], color });
export const cones = (points: Point[], color: ConeColor = "yellow"): Item[] => points.map(([x, y]) => cone(x, y, color));

/** Cones round the edge of a w × h box from (x, y) — at its corners, or every `step` yards. */
export function box(x: number, y: number, w: number, h: number, color: ConeColor = "yellow", step = 0): Item[] {
  if (!step) return cones([[x, y], [x + w, y], [x, y + h], [x + w, y + h]], color);
  const out: Point[] = [];
  for (let i = 0; i <= w; i += step) out.push([x + i, y], [x + i, y + h]);
  for (let j = step; j < h; j += step) out.push([x, y + j], [x + w, y + j]);
  return cones(out, color);
}

/** A gate: two cones `width` yards apart, centred on (x, y). */
export function gate(x: number, y: number, width = 2, vertical = false, color: ConeColor = "red"): Item[] {
  const d = width / 2;
  return vertical ? cones([[x, y - d], [x, y + d]], color) : cones([[x - d, y], [x + d, y]], color);
}

export const ball = (x: number, y: number): Item => ({ t: "ball", at: [x, y] });
export const pole = (x: number, y: number): Item => ({ t: "pole", at: [x, y] });

/** A goal on the line at (x, y), its net behind the line on `side`. Mini goals are 2 yards wide. */
export const goal = (x: number, y: number, side: Side, width = 4): Item => ({ t: "goal", at: [x, y], side, width });
export const mini = (x: number, y: number, side: Side): Item => goal(x, y, side, 2);

const arrow =
  (kind: ArrowKind) =>
  (x1: number, y1: number, x2: number, y2: number, bend = 0): Item => ({
    t: "arrow",
    kind,
    from: [x1, y1],
    to: [x2, y2],
    bend,
  });

/** Movement: a pass (dashed), a run without the ball (solid), a dribble (wavy), a shot. `bend` curves it, in yards. */
export const pass = arrow("pass");
export const run = arrow("run");
export const dribble = arrow("dribble");
export const shot = arrow("shot");

export const zone = (x: number, y: number, w: number, h: number, label = ""): Item => ({
  t: "zone",
  at: [x, y],
  w,
  h,
  label,
});
export const line = (x1: number, y1: number, x2: number, y2: number, dashed = false): Item => ({
  t: "line",
  from: [x1, y1],
  to: [x2, y2],
  dashed,
});
export const label = (x: number, y: number, text: string): Item => ({ t: "label", at: [x, y], text });

// --- drawing it -----------------------------------------------------------

const WIDTH = 600;
const HEADER = 54;
const LEGEND = 44;
const KEY_ROW = 22;
const MARGIN = 30; // grass round the area, for goals and players outside it
const MAX_AREA_W = WIDTH - 2 * MARGIN;
const MAX_AREA_H = 380;

const TEAM_FILL: Record<Team, string> = {
  a: "#2563eb",
  b: "#dc2626",
  n: "#facc15",
  gk: "#7c3aed",
  coach: "#111827",
};
const TEAM_NAME: Record<Team, string> = {
  a: "Team A",
  b: "Team B",
  n: "Neutral / server",
  gk: "Goalkeeper",
  coach: "Coach",
};
const CONE_FILL: Record<ConeColor, string> = {
  yellow: "#fde047",
  orange: "#fb923c",
  red: "#ef4444",
  blue: "#3b82f6",
  white: "#f8fafc",
};
const ARROW_STYLE: Record<ArrowKind, { color: string; width: number; dash: string; name: string }> = {
  pass: { color: "#ffffff", width: 2.2, dash: "7 5", name: "Pass" },
  run: { color: "#111827", width: 2.2, dash: "", name: "Run" },
  dribble: { color: "#ffffff", width: 2, dash: "", name: "Dribble" },
  shot: { color: "#fde047", width: 3, dash: "", name: "Shot" },
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const r1 = (v: number) => Math.round(v * 10) / 10;

function ballSvg(x: number, y: number, r = 5): string {
  return (
    `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r}" fill="#fff" stroke="#111827" stroke-width="1.4"/>` +
    `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r * 0.38}" fill="#111827"/>`
  );
}

function playerSvg(x: number, y: number, team: Team, text: string, withBall: boolean): string {
  const ink = team === "n" ? "#111827" : "#fff";
  let s = `<circle cx="${r1(x)}" cy="${r1(y)}" r="11" fill="${TEAM_FILL[team]}" stroke="#fff" stroke-width="2"/>`;
  if (text) {
    s += `<text x="${r1(x)}" y="${r1(y + 3.8)}" font-size="${text.length > 2 ? 8 : 11}" font-weight="700" text-anchor="middle" fill="${ink}">${esc(text)}</text>`;
  }
  if (withBall) s += ballSvg(x + 11, y + 9);
  return s;
}

/** Points along a straight or bent path, in pixels. */
function pathPoints(from: Point, to: Point, bendPx: number, steps: number): Point[] {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  // control point: off the midpoint, square to the line
  const cx = (x1 + x2) / 2 - ((y2 - y1) / len) * bendPx * 2;
  const cy = (y1 + y2) / 2 + ((x2 - x1) / len) * bendPx * 2;
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push([u * u * x1 + 2 * u * t * cx + t * t * x2, u * u * y1 + 2 * u * t * cy + t * t * y2]);
  }
  return pts;
}

function arrowSvg(kind: ArrowKind, from: Point, to: Point, bendPx: number): string {
  const style = ARROW_STYLE[kind];
  let pts = pathPoints(from, to, bendPx, 60);
  // stop short of the players or cones at each end
  const trim = (list: Point[], px: number) => {
    let d = 0;
    for (let i = 1; i < list.length; i++) {
      d += Math.hypot(list[i][0] - list[i - 1][0], list[i][1] - list[i - 1][1]);
      if (d >= px) return list.slice(i);
    }
    return list.slice(-2);
  };
  pts = trim(pts, 12);
  pts = trim(pts.reverse(), 14).reverse();
  if (pts.length < 2) return "";

  if (kind === "dribble") {
    // a wave along the path, flat at the very end so the head lines up
    let along = 0;
    pts = pts.map((p, i) => {
      if (i === 0) return p;
      const prev = pts[i - 1];
      const dx = p[0] - prev[0];
      const dy = p[1] - prev[1];
      const seg = Math.hypot(dx, dy) || 1;
      along += seg;
      const fade = i > pts.length - 5 ? 0 : 1;
      const off = Math.sin(along / 4.5) * 3.5 * fade;
      return [p[0] - (dy / seg) * off, p[1] + (dx / seg) * off];
    });
  }

  const d = pts.map((p, i) => `${i ? "L" : "M"}${r1(p[0])} ${r1(p[1])}`).join(" ");
  const [ex, ey] = pts[pts.length - 1];
  const [px, py] = pts[Math.max(0, pts.length - 4)];
  const ang = Math.atan2(ey - py, ex - px);
  const head = 9;
  const hx = (a: number) => r1(ex - head * Math.cos(ang + a));
  const hy = (a: number) => r1(ey - head * Math.sin(ang + a));
  const dash = style.dash ? ` stroke-dasharray="${style.dash}"` : "";
  return (
    `<path d="${d}" fill="none" stroke="${style.color}" stroke-width="${style.width}"${dash} stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M${r1(ex)} ${r1(ey)} L${hx(0.45)} ${hy(0.45)} L${hx(-0.45)} ${hy(-0.45)} Z" fill="${style.color}"/>`
  );
}

/** The diagram as an SVG document, with the drill's title above it and a key below. */
export function diagramSvg(title: string, d: Diagram): string {
  const s = Math.min(MAX_AREA_W / d.w, MAX_AREA_H / d.h);
  const areaW = d.w * s;
  const areaH = d.h * s;
  const ox = (WIDTH - areaW) / 2;
  const oy = HEADER + MARGIN;
  const key = keySvg(d.items);
  const height = Math.round(HEADER + areaH + 2 * MARGIN + key.height);
  const X = (x: number) => ox + x * s;
  const Y = (y: number) => oy + y * s;
  const P = ([x, y]: Point): Point => [X(x), Y(y)];

  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${height}" width="${WIDTH}" height="${height}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">`,
    `<rect width="${WIDTH}" height="${height}" fill="#ffffff"/>`,
    `<text x="20" y="25" font-size="17" font-weight="700" fill="#111827">${esc(title)}</text>`,
    `<text x="20" y="44" font-size="12" fill="#6b7280">${r1(d.w)} × ${r1(d.h)} yard area</text>`,
    // grass, with mowing stripes across the area
    `<rect x="${r1(ox - MARGIN)}" y="${HEADER}" width="${r1(areaW + 2 * MARGIN)}" height="${r1(areaH + 2 * MARGIN)}" rx="10" fill="#2f8a43"/>`
  );
  const stripes = Math.max(4, Math.round(d.w / 5));
  for (let i = 0; i < stripes; i += 2) {
    out.push(
      `<rect x="${r1(ox + (areaW / stripes) * i)}" y="${r1(oy)}" width="${r1(areaW / stripes)}" height="${r1(areaH)}" fill="#ffffff" opacity="0.06"/>`
    );
  }
  out.push(
    `<rect x="${r1(ox)}" y="${r1(oy)}" width="${r1(areaW)}" height="${r1(areaH)}" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.9"/>`
  );

  // drawn in layers, so players and balls sit on top of the lines and arrows
  const layer = (i: Item) =>
    i.t === "zone" || i.t === "line" ? 0 : i.t === "goal" ? 1 : i.t === "arrow" ? 2 : i.t === "label" ? 4 : 3;
  const items = [...d.items].sort((p, q) => layer(p) - layer(q));

  for (const item of items) {
    switch (item.t) {
      case "zone": {
        out.push(
          `<rect x="${r1(X(item.at[0]))}" y="${r1(Y(item.at[1]))}" width="${r1(item.w * s)}" height="${r1(item.h * s)}" fill="#ffffff" fill-opacity="0.13" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="6 4" stroke-opacity="0.8"/>`
        );
        if (item.label) {
          out.push(
            `<text x="${r1(X(item.at[0] + item.w / 2))}" y="${r1(Y(item.at[1]) + 15)}" font-size="11" font-weight="700" text-anchor="middle" fill="#ffffff" opacity="0.9">${esc(item.label)}</text>`
          );
        }
        break;
      }
      case "line": {
        const [x1, y1] = P(item.from);
        const [x2, y2] = P(item.to);
        out.push(
          `<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" stroke="#ffffff" stroke-width="2" opacity="0.85"${item.dashed ? ' stroke-dasharray="8 6"' : ""}/>`
        );
        break;
      }
      case "goal": {
        const [x, y] = P(item.at);
        const half = (item.width * s) / 2;
        const depth = Math.max(10, Math.min(18, item.width * s * 0.22));
        const horizontal = item.side === "top" || item.side === "bottom";
        const out1 = item.side === "top" || item.side === "left" ? -depth : depth;
        const gx = horizontal ? x - half : out1 < 0 ? x + out1 : x;
        const gy = horizontal ? (out1 < 0 ? y + out1 : y) : y - half;
        const gw = horizontal ? half * 2 : depth;
        const gh = horizontal ? depth : half * 2;
        out.push(
          `<rect x="${r1(gx)}" y="${r1(gy)}" width="${r1(gw)}" height="${r1(gh)}" fill="#ffffff" fill-opacity="0.25" stroke="#ffffff" stroke-width="3"/>`
        );
        break;
      }
      case "arrow": {
        out.push(arrowSvg(item.kind, P(item.from), P(item.to), item.bend * s));
        break;
      }
      case "cone": {
        const [x, y] = P(item.at);
        out.push(
          `<path d="M${r1(x)} ${r1(y - 6)} L${r1(x + 5.5)} ${r1(y + 4.5)} L${r1(x - 5.5)} ${r1(y + 4.5)} Z" fill="${CONE_FILL[item.color]}" stroke="#1f2937" stroke-width="1" stroke-linejoin="round"/>`
        );
        break;
      }
      case "pole": {
        const [x, y] = P(item.at);
        out.push(
          `<rect x="${r1(x - 2.5)}" y="${r1(y - 13)}" width="5" height="17" rx="2" fill="#f97316" stroke="#1f2937" stroke-width="1"/>`,
          `<ellipse cx="${r1(x)}" cy="${r1(y + 4)}" rx="6" ry="2.5" fill="#1f2937" opacity="0.6"/>`
        );
        break;
      }
      case "ball": {
        const [x, y] = P(item.at);
        out.push(ballSvg(x, y));
        break;
      }
      case "player": {
        const [x, y] = P(item.at);
        out.push(playerSvg(x, y, item.team, item.label, item.ball));
        break;
      }
      case "queue": {
        const [x, y] = P(item.at);
        const [dx, dy] = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] }[item.dir];
        // drawn back to front, so the player at the head of the line is on top
        for (let k = item.count - 1; k >= 0; k--) {
          out.push(playerSvg(x + dx * 20 * k, y + dy * 20 * k, item.team, "", item.ball && k === 0));
        }
        break;
      }
      case "label": {
        const [x, y] = P(item.at);
        out.push(
          `<text x="${r1(x)}" y="${r1(y + 4)}" font-size="11" font-weight="700" text-anchor="middle" fill="#ffffff" stroke="#14532d" stroke-width="3" paint-order="stroke">${esc(item.text)}</text>`
        );
        break;
      }
    }
  }

  out.push(key.draw(height - key.height + 22), `</svg>`);
  return out.join("");
}

/** The key below a diagram: only what it uses, wrapped onto as many rows as it needs. */
function keySvg(items: Item[]): { height: number; draw: (top: number) => string } {
  const teams = new Set(items.flatMap((i) => (i.t === "player" || i.t === "queue" ? [i.team] : [])));
  const arrows = new Set(items.flatMap((i) => (i.t === "arrow" ? [i.kind] : [])));
  // each entry draws itself at (x, y) and says how wide it is
  const entries: { width: number; draw: (x: number, y: number) => string }[] = [];
  for (const team of ["a", "b", "n", "gk", "coach"] as Team[]) {
    if (!teams.has(team)) continue;
    entries.push({
      width: 26 + TEAM_NAME[team].length * 6.2,
      draw: (x, y) =>
        `<circle cx="${x + 7}" cy="${y}" r="7" fill="${TEAM_FILL[team]}" stroke="#d1d5db"/>` +
        `<text x="${x + 19}" y="${y + 4}" font-size="11.5" fill="#374151">${TEAM_NAME[team]}</text>`,
    });
  }
  for (const kind of ["pass", "run", "dribble", "shot"] as ArrowKind[]) {
    if (!arrows.has(kind)) continue;
    const style = ARROW_STYLE[kind];
    // white arrows are drawn dark in the key, which sits on white
    const color = style.color === "#ffffff" ? "#374151" : kind === "shot" ? "#ca8a04" : style.color;
    entries.push({
      width: 40 + style.name.length * 6.5,
      draw: (x, y) => {
        const path = kind === "dribble" ? `M${x} ${y} q3.5 -4 7 0 t7 0 t7 0` : `M${x} ${y} L${x + 21} ${y}`;
        return (
          `<path d="${path}" fill="none" stroke="${color}" stroke-width="2"${style.dash ? ' stroke-dasharray="5 3"' : ""}/>` +
          `<path d="M${x + 27} ${y} L${x + 20} ${y - 4} L${x + 20} ${y + 4} Z" fill="${color}"/>` +
          `<text x="${x + 32}" y="${y + 4}" font-size="11.5" fill="#374151">${style.name}</text>`
        );
      },
    });
  }
  const placed: { x: number; row: number; draw: (x: number, y: number) => string }[] = [];
  let x = 20;
  let row = 0;
  for (const e of entries) {
    if (x > 20 && x + e.width > WIDTH - 10) {
      x = 20;
      row++;
    }
    placed.push({ x, row, draw: e.draw });
    x += e.width;
  }
  return {
    height: LEGEND + row * KEY_ROW,
    draw: (top) => placed.map((p) => p.draw(p.x, top + p.row * KEY_ROW)).join(""),
  };
}
