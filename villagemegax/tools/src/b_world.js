/* ---------------- tata letak markas (koordinat dunia, px) ---------------- */
const IDS = AGENTS.map(a => a.id);
const CX = MW / 2;                                       // poros tengah markas
const BAY = 160;                                        // lebar teluk samping (lantai lebih gelap)
const WALL_Y = 184;                                     // dinding belakang sampai sini
const SEAT_DX = 7;                                      // operator duduk sedikit ke kanan: di antara monitor & layar holo
const DESK = { top: 230, y: 298, w: 112, seatY: 264, walkY: 218 };
const CONSOLES = IDS.map((id, i) => ({ id, x: CX + (i - 3) * 135 }));
const DECK_Y = 344;                                     // tepi depan panggung Command Center
const CORE = { x: CX, y: 520 };
const SOFAS = [{ x: 297, y: 522 }, { x: 460, y: 522 }, { x: 788, y: 522 }, { x: 951, y: 522 }];
const POD_Y = 704;                                      // baris kapsul isi ulang (menghadap kamera, jalur di depannya)
const PODS = {}; IDS.forEach((id, i) => PODS[id] = { id, x: CX + (i - 3) * 120, y: POD_Y, side: "L" });
for (const p of Object.values(PODS)) { p.open = 0; p.want = 0; p.busy = 0; }
const PODX0 = CX - 3 * 120 - 60, PODX1 = CX + 3 * 120 + 60;   // alas teluk kapsul
const PADS = [{ x: 96, y: 540, t: 0 }, { x: MW - 96, y: 540, t: 0 }];
const PROPS_AT = [   // [nama prop, x tengah, y alas]
  ["server", 70, 760], ["server", 110, 760], ["server", MW - 110, 760], ["server", MW - 70, 760],
  ["plant", 178, 328], ["plant", MW - 178, 328], ["plant", 200, 640], ["plant", MW - 200, 640],
  ["vending", 76, 410], ["cooler", 124, 406], ["crates2", MW - 120, 412], ["crate", MW - 72, 408],
  ["lamp", 378, 534], ["lamp", MW - 378, 534], ["table", 214, 470], ["plant", 160, 764], ["plant", MW - 160, 764]];
const WANDER = [[290, 400], [480, 400], [770, 400], [960, 400], [220, 452], [1028, 452], [220, 600], [1028, 600], [624, 600], [400, 562], [848, 562],
  [340, 748], [900, 748], [624, 748], [200, 540], [1048, 540]];
const LIGHTS = [];

/* ---------------- grid jalan (A*) ---------------- */
let GRID;
function buildGrid() {
  GRID = Array.from({ length: GH }, () => new Array(GW).fill(false));
  const block = (x0, y0, x1, y1) => { for (let ty = Math.floor(y0 / T); ty <= Math.floor((y1 - 1) / T); ty++) for (let tx = Math.floor(x0 / T); tx <= Math.floor((x1 - 1) / T); tx++) if (GRID[ty] && tx >= 0 && tx < GW) GRID[ty][tx] = true; };
  block(0, 0, MW, WALL_Y); block(0, 0, 40, MH); block(MW - 40, 0, MW, MH); block(0, MH - 32, MW, MH);
  for (const c of CONSOLES) block(c.x - DESK.w / 2, DESK.top + 20, c.x + DESK.w / 2, DESK.y);
  block(CORE.x - 64, CORE.y - 60, CORE.x + 64, CORE.y + 4);
  for (const s of SOFAS) block(s.x - 44, s.y - 30, s.x + 44, s.y);
  for (const Pd of PADS) block(Pd.x - 4, Pd.y - 2, Pd.x + 4, Pd.y + 2);
  for (const p of Object.values(PODS)) block(p.x - 32, p.y - 40, p.x + 32, p.y + 4);
  for (const [n, x, y] of PROPS_AT) { const [w] = PROPSZ[n] || [32]; if (n !== "lamp") block(x - w / 2 + 4, y - 22, x + w / 2 - 4, y); else block(x - 6, y - 10, x + 6, y); }
}
const walkable = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH && !GRID[y][x];
function astar(sx, sy, gx, gy) {
  if (!walkable(gx, gy)) return null;
  const W = GW, N = W * GH, g = new Float32Array(N).fill(1e9), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const open = [[0, sx, sy]]; g[sy * W + sx] = 0;
  const h = (x, y) => { const dx = Math.abs(x - gx), dy = Math.abs(y - gy); return dx + dy - .59 * Math.min(dx, dy); };
  const nb = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.41], [1, -1, 1.41], [-1, 1, 1.41], [-1, -1, 1.41]];
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [, x, y] = open.splice(bi, 1)[0], id = y * W + x;
    if (closed[id]) continue; closed[id] = 1;
    if (x === gx && y === gy) { const p = []; let c = id; while (c !== -1) { p.push([c % W, Math.floor(c / W)]); c = came[c]; } return p.reverse(); }
    for (const [dx, dy, cost] of nb) {
      const nx = x + dx, ny = y + dy; if (!walkable(nx, ny)) continue;
      if (dx && dy && (!walkable(x + dx, y) || !walkable(x, y + dy))) continue;
      const ni = ny * W + nx, ng = g[id] + cost; if (ng < g[ni]) { g[ni] = ng; came[ni] = id; open.push([ng + h(nx, ny), nx, ny]); }
    }
  }
  return null;
}
function los(a, b) {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 3);
  for (let i = 1; i < n; i++) { const t = i / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
    for (const [ox, oy] of [[-.3, -.3], [.3, -.3], [-.3, .3], [.3, .3]]) if (!walkable(Math.floor(x + .5 + ox), Math.floor(y + .5 + oy))) return false; }
  return true;
}
function smooth(p) { if (!p || p.length < 3) return p; const out = [p[0]]; let i = 0; while (i < p.length - 1) { let j = p.length - 1; while (j > i + 1 && !los(p[i], p[j])) j--; out.push(p[j]); i = j; } return out; }
const toTile = (x, y) => [clamp(Math.floor(x / T), 0, GW - 1), clamp(Math.floor((y - 4) / T), 0, GH - 1)];
const tileC = (tx, ty) => ({ x: tx * T + 16, y: ty * T + 20 });
function nearestFree(tx, ty) { if (walkable(tx, ty)) return [tx, ty]; for (let r = 1; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (walkable(tx + dx, ty + dy)) return [tx + dx, ty + dy]; return [tx, ty]; }
