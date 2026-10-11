// Takes the plain background off an uploaded crest, in the browser. Most
// crests arrive as the badge on a white (or other single-colour) square: the
// colour all round the edge is found, every pixel of it joined to the edge is
// made see-through (so white inside the badge's outline stays), its fringe is
// softened, and the empty margin is trimmed. A photo, or a crest that's
// already see-through, is left alone (null).

/** How far (0–441, RGB distance) a pixel can be from the background and still count as it. */
const TOLERANCE = 48;

export function removeBackground(source: HTMLCanvasElement): HTMLCanvasElement | null {
  const w = source.width;
  const h = source.height;
  if (w < 8 || h < 8) return null;
  const image = source.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, w, h);
  const d = image.data;

  // the pixels round the edge
  const edge: number[] = [];
  for (let x = 0; x < w; x++) edge.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) edge.push(y * w, y * w + w - 1);
  const clear = (p: number) => d[p * 4 + 3] < 16;
  if (edge.filter(clear).length > edge.length / 2) return null; // already see-through

  // the edge's commonest colour (to the nearest 16 per channel), averaged
  const buckets = new Map<number, number[]>();
  for (const p of edge) {
    if (clear(p)) continue;
    const key = ((d[p * 4] >> 4) << 8) | ((d[p * 4 + 1] >> 4) << 4) | (d[p * 4 + 2] >> 4);
    const list = buckets.get(key);
    if (list) list.push(p);
    else buckets.set(key, [p]);
  }
  const top = [...buckets.values()].sort((a, b) => b.length - a.length)[0];
  if (!top) return null;
  const bg = [0, 1, 2].map((c) => top.reduce((sum, p) => sum + d[p * 4 + c], 0) / top.length);
  const dist = (p: number) =>
    Math.hypot(d[p * 4] - bg[0], d[p * 4 + 1] - bg[1], d[p * 4 + 2] - bg[2]);
  const isBg = (p: number) => clear(p) || dist(p) <= TOLERANCE;

  // most of the edge has to be that colour, or it isn't a plain background
  if (edge.filter(isBg).length < edge.length * 0.6) return null;

  // everything of that colour joined to the edge
  const gone = new Uint8Array(w * h);
  const stack = edge.filter(isBg);
  for (const p of stack) gone[p] = 1;
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    for (const n of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
      if (n < 0 || n >= w * h || gone[n] || !isBg(n)) continue;
      gone[n] = 1;
      stack.push(n);
    }
  }
  let removed = 0;
  for (let p = 0; p < w * h; p++) removed += gone[p];
  if (removed < w * h * 0.02) return null; // hardly any background: leave it be

  for (let p = 0; p < w * h; p++) {
    if (gone[p]) {
      d[p * 4 + 3] = 0;
      continue;
    }
    // the badge's own edge, blended into the background: fade it rather than leave a halo
    const x = p % w;
    const touching =
      (x > 0 && gone[p - 1]) || (x < w - 1 && gone[p + 1]) || (p >= w && gone[p - w]) || (p + w < w * h && gone[p + w]);
    if (touching) {
      const t = Math.min(1, Math.max(0, (dist(p) - TOLERANCE) / TOLERANCE));
      d[p * 4 + 3] = Math.round(d[p * 4 + 3] * (0.35 + 0.65 * t));
    }
  }

  // trim to what's left, with a little room round it
  let [x0, y0, x1, y1] = [w, h, -1, -1];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (d[(y * w + x) * 4 + 3] > 16) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null; // nothing left: it wasn't a background after all
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.02);
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad);
  y1 = Math.min(h - 1, y1 + pad);

  const work = document.createElement("canvas");
  work.width = w;
  work.height = h;
  work.getContext("2d")!.putImageData(image, 0, 0);
  const out = document.createElement("canvas");
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext("2d")!.drawImage(work, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}
