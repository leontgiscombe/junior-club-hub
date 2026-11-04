// Draws the App Store promotional images for the six club subscriptions
// (docs/SUBSCRIPTIONS.md): one 1024×1024 image each, all different and none
// the app icon, as App Review asks. Run: node scripts/iap-promo-images.mjs
// Writes docs/app-store/iap-promo/<plan>-<period>.png (Playwright's Chromium).
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

// Playwright isn't a project dependency: use any installed copy (npx/global).
const { chromium } = createRequire(import.meta.url)("playwright");
const OUT =new URL("../docs/app-store/iap-promo/", import.meta.url).pathname;

const PLANS = {
  starter: { name: "Starter", teams: "Up to 3 teams", shirts: 3, a: "#22c55e", b: "#0b3d24" },
  club: { name: "Club", teams: "Up to 10 teams", shirts: 10, a: "#38bdf8", b: "#0b2a4a" },
  large: { name: "Large Club", teams: "Unlimited teams", shirts: 21, a: "#c084fc", b: "#2e1047" },
};
const PERIODS = {
  monthly: { label: "Monthly", note: "Renews every month", glyph: "M" },
  yearly: { label: "Yearly", note: "One payment a year", glyph: "12" },
};

const shirt = (fill) => `<svg viewBox="0 0 100 100" width="100%" height="100%"><path fill="${fill}" stroke="rgba(0,0,0,.25)" stroke-width="3" d="M34 10 L18 18 L4 38 L18 48 L24 40 L24 92 L76 92 L76 40 L82 48 L96 38 L82 18 L66 10 Q50 26 34 10 Z"/><path fill="rgba(255,255,255,.55)" d="M34 10 Q50 26 66 10 L62 9 Q50 20 38 9 Z"/></svg>`;

function page(plan, period) {
  const p = PLANS[plan], t = PERIODS[period];
  const yearly = period === "yearly";
  const n = p.shirts;
  const cols = n <= 3 ? 3 : n <= 10 ? 5 : 7;
  const size = n <= 3 ? 190 : n <= 10 ? 120 : 92;
  // Monthly is dark, yearly light, so no two of the six look alike.
  const fg = yearly ? p.b : "#fff";
  const accent = yearly ? p.b : p.a;
  const shirts = Array.from({ length: n }, (_, i) => `<div class="s" style="width:${size}px;height:${size}px;transform:rotate(${((i * 37) % 13) - 6}deg)">${shirt(yearly ? (i % 2 ? "#ffffff" : p.b) : (i % 2 ? "#ffffff" : p.a))}</div>`).join("");
  const bg = yearly
    ? `radial-gradient(circle at 80% 15%, #ffffffcc, transparent 50%), linear-gradient(160deg, ${p.a}, #f5f7fa 85%)`
    : `radial-gradient(circle at 20% 85%, ${p.a}55, transparent 45%), linear-gradient(20deg, #05070d 25%, ${p.b})`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;box-sizing:border-box}
body{width:1024px;height:1024px;overflow:hidden;font-family:"DejaVu Sans","Helvetica Neue",Arial,sans-serif;color:${fg};background:${bg};position:relative}
.pitch{position:absolute;inset:0;opacity:.13;background:
  repeating-linear-gradient(${yearly ? 90 : 0}deg, transparent 0 128px, ${fg} 128px 130px)}
.circle{position:absolute;width:520px;height:520px;border:6px solid ${fg};opacity:.2;border-radius:50%;${yearly ? "right:-180px;top:-180px" : "left:-180px;bottom:-180px"}}
.top{position:absolute;top:70px;left:80px;right:80px;display:flex;justify-content:space-between;align-items:center}
.brand{font-size:30px;font-weight:700;letter-spacing:4px;opacity:.8;text-transform:uppercase}
.badge{display:flex;align-items:center;gap:14px;padding:14px 28px;border-radius:999px;background:${yearly ? p.b : "rgba(255,255,255,.12)"};color:#fff;border:3px solid ${yearly ? p.b : p.a};font-size:34px;font-weight:800}
.cal{width:46px;height:46px;border-radius:8px;background:${p.a};color:#05070d;font-size:${t.glyph.length > 1 ? 22 : 26}px;display:grid;place-items:center;font-weight:900}
.grid{position:absolute;left:0;right:0;top:${n <= 3 ? 250 : n <= 10 ? 220 : 190}px;display:grid;grid-template-columns:repeat(${cols}, ${size}px);justify-content:center;gap:${n <= 3 ? 40 : 18}px}
.s{filter:drop-shadow(0 10px 18px rgba(0,0,0,${yearly ? .25 : .5}))}
.bottom{position:absolute;left:80px;right:80px;bottom:80px}
h1{font-size:${p.name.length > 6 ? 116 : 140}px;line-height:1;font-weight:900;letter-spacing:-2px}
h1 span{color:${accent}}
.teams{margin-top:18px;font-size:50px;font-weight:700;color:${accent}}
.note{margin-top:10px;font-size:32px;opacity:.75}
</style></head><body>
<div class="pitch"></div><div class="circle"></div>
<div class="top"><div class="brand">Club Hub</div><div class="badge"><div class="cal">${t.glyph}</div>${t.label}</div></div>
<div class="grid">${shirts}</div>
<div class="bottom"><h1>${p.name}<span>.</span></h1><div class="teams">${p.teams}</div><div class="note">${t.note}</div></div>
</body></html>`;
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
for (const plan of Object.keys(PLANS)) {
  for (const period of Object.keys(PERIODS)) {
    await tab.setContent(page(plan, period));
    const file = `${OUT}${plan}-${period}.png`;
    await tab.screenshot({ path: file });
    // App Store Connect wants a flat RGB image: drop the alpha channel.
    execFileSync("python3", ["-c", "import sys;from PIL import Image;Image.open(sys.argv[1]).convert('RGB').save(sys.argv[1])", file]);
    console.log(file);
  }
}
await browser.close();
