/* MISSION CONTROL · Robot HQ 2D (villagemegax)
   Markas robot 16-bit, gaya Mega Man X tapi desain ORISINAL (sprite & props AI-generated, lalu diproses jadi pixel grid asli).
   Karakter: assets/sprites/<id>.png = satu baris sel 64x96 (lihat sprites.json), semua frame dirakit dari pose yang sama
   (bob, kedip, jalan 4 frame dari geser kaki, lambaian 2 frame) jadi konsisten. Teleport beam digambar di kode.
   Lantai, dinding, konsol, kapsul, teleporter digambar prosedural di canvas 1x lalu diskalakan bulat (pixel tajam).
   Perilaku agent dari status.json (+ summaries.json), dicek tiap 60 detik. Lokasinya:
     <meta name="vmx-data" content="..."> kalau ada (root situs: content=""), kalau nggak ada dicoba
     "status.json" (folder yang sama, mode root) lalu "../status.json" (mode subfolder). Yang berhasil diingat.
     kerja  -> ke konsol Command Center miliknya, duduk
     santai -> keliling markas / duduk di sofa inti energi / teleport ke pad seberang
     tidur  -> masuk kapsul isi ulang miliknya, kaca menutup, ikon baterai CHG (pengganti zzz)
   URL: ?demo=1 status contoh · ?time=day|dusk|night · ?zoom=0.5|1|2|3 */
import { AGENTS, LOOKS } from "./agents.js";

const Q = new URLSearchParams(location.search);
const DEMO = Q.has("demo");
const MOBILE = matchMedia("(max-width:640px)").matches || matchMedia("(pointer:coarse)").matches;
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const DATA_META = document.querySelector('meta[name="vmx-data"]');
let DATA_BASE = DATA_META ? DATA_META.content : null;      // null = deteksi otomatis ("" lalu "../")
const IS_ROOT = () => DATA_BASE === "";                    // di root situs nggak ada dashboard lama buat dituju
const POLL_MS = 60000, MIN = 60000, SLEEP_AFTER_H = 48;
const T = 32, MW = 1248, MH = 800, GW = MW / T, GH = MH / T;
const CW = 64, CH = 96, BASE = 94;           // sel sprite karakter, baris kaki
const SPEED = 78;                            // px dunia / detik
const ZOOMS = [0.5, 1, 1.5, 2, 3];            // 1.5 = satu-satunya langkah non-bulat (lihat applyZoom/offX)
const FR = {};                               // nama frame -> index (dari sprites.json)
/* KAIRO pilot (cuma nerd): sheet animasi AI terpisah assets/sprites/<id>_kairo.png + kairo.json
   (idle 4f, jalan samping 6f, jalan belakang 4f, teleport-in 7f, defeat 6f). Timing dalam tick 60 fps.
   Agent tanpa entri kairo.json tetap pakai frame lama. */
const KAIRO = {}, KTOPS = {};
const ANIM_KEY = "vmx-anim";                 // HUD ANIM: NEW/OLD (default NEW), disimpan di localStorage
let ANIM_NEW = (() => { try { return localStorage.getItem(ANIM_KEY) !== "old"; } catch (e) { return true; } })();
const TPA = .3;                              // detik berkas jatuh dari langit sebelum frame teleport KAIRO jalan

/* ---------------- util ---------------- */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const R = Math.round;
function relTime(ms) { if (!ms) return "belum ada data"; const m = Math.floor((Date.now() - ms) / MIN); if (m < 1) return "barusan"; if (m < 60) return m + " menit lalu"; const h = Math.floor(m / 60); if (h < 24) return h + " jam lalu"; return Math.floor(h / 24) + " hari lalu"; }
function wib(ms) { try { return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms)) + " WIB"; } catch (e) { return ""; } }
function wibHour() { try { const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()).split(":"); return +p[0] + p[1] / 60; } catch (e) { return new Date().getHours(); } }
function showErr(html) { const e = $("err"); e.innerHTML = html; e.hidden = false; }
function loadImg(url) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("gagal muat " + url)); i.src = url; }); }
function mk(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.imageSmoothingEnabled = false; return [c, x]; }
// elips pixel (tanpa anti-alias): isi baris per baris
function pxEllipse(x, cx, cy, rx, ry, col) { x.fillStyle = col; for (let y = -ry; y <= ry; y++) { const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)))); x.fillRect(R(cx - w), R(cy + y), w * 2 + 1, 1); } }
function pxRing(x, cx, cy, rx, ry, col, th = 1) { x.fillStyle = col; const n = Math.ceil(2 * Math.PI * Math.max(rx, ry) * 1.3); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; for (let k = 0; k < th; k++) x.fillRect(R(cx + Math.cos(a) * (rx - k)), R(cy + Math.sin(a) * (ry - k * ry / rx)), 1, 1); } }
function pxText(x, s, px, py, col, size = 8, align = "left", shadow = null) {
  x.font = size + 'px "PS2P"'; x.textBaseline = "top"; x.textAlign = align;
  if (shadow) { x.fillStyle = shadow; x.fillText(s, px + 1, py + 1); }
  x.fillStyle = col; x.fillText(s, px, py);
}

/* ---------------- waktu (WIB) · markas indoor: siang terang, sore hangat, malam redup + lampu ---------------- */
function sky() {
  const q = Q.get("time");
  if (q === "day") return { k: "day", dark: 0 };
  if (q === "dusk") return { k: "dusk", dark: .2, tint: [255, 140, 70] };
  if (q === "night") return { k: "night", dark: .5 };
  const h = wibHour();
  if (h >= 6.5 && h < 16.5) return { k: "day", dark: 0 };
  if (h >= 16.5 && h < 18.5) return { k: "dusk", dark: .08 + .2 * (h - 16.5) / 2, tint: [255, 140, 70] };
  if (h >= 5 && h < 6.5) return { k: "dawn", dark: .12 + .25 * (1 - (h - 5) / 1.5), tint: [255, 170, 120] };
  return { k: "night", dark: .5 };
}
let SKY = sky();
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
/* ---------------- palet ---------------- */
const P = { ink: "#121638", white: "#f4f8ff", w2: "#e4eefb", w3: "#cddff4", seam: "#a9c2e2", blue: "#7fa8e0", royal: "#2b63c8", deep: "#173f8f", navy: "#0d2a5e",
  cyan: "#58e8ff", cyanL: "#c4f8ff", yel: "#ffd447", hz: "#1b2350", red: "#ff5a6e", green: "#5cf08a" };
let IMG = {}, PROPSZ = {}, SPR = null;

/* ---------------- lantai + dinding (canvas statis 1x, digambar ulang kalau waktu berubah) ---------------- */
let GROUND = null;
function paintSkyWindow(x, x0, y0, w, h) {
  const k = SKY.k;
  const bands = k === "night" ? ["#0a1033", "#111a48", "#18245c", "#1d2c6a"] : k === "dusk" ? ["#5b4aa8", "#c46a8a", "#ff9a6a", "#ffc27a"] : k === "dawn" ? ["#7aa0e0", "#c8a8d8", "#ffc8a0", "#ffe0b8"] : ["#4aa8ff", "#6cbcff", "#94d2ff", "#bfe6ff"];
  for (let i = 0; i < h; i++) { x.fillStyle = bands[Math.min(3, Math.floor(i / h * 4))]; x.fillRect(x0, y0 + i, w, 1); }
  if (k === "night") { x.fillStyle = "#fff"; for (let i = 0; i < 14; i++) x.fillRect(x0 + (i * 37 % w), y0 + (i * 23 % (h - 10)) + 3, 1, 1); x.fillStyle = "#ffe9a8"; x.fillRect(x0 + w - 30, y0 + 12, 8, 8); x.fillStyle = bands[0]; x.fillRect(x0 + w - 27, y0 + 12, 5, 5); }
  else { x.fillStyle = k === "day" ? "#fff" : "#ffe0d0"; for (const [cx, cy, s] of [[x0 + 24, y0 + 30, 1], [x0 + w - 50, y0 + 58, 1.3], [x0 + 70, y0 + 80, .8]]) { x.fillRect(cx, cy, 26 * s | 0, 6); x.fillRect(cx + 6, cy - 4, 14 * s | 0, 4); } }
  // kusen jendela
  x.fillStyle = P.ink; x.fillRect(x0 - 3, y0 - 3, w + 6, 3); x.fillRect(x0 - 3, y0 + h, w + 6, 3); x.fillRect(x0 - 3, y0, 3, h); x.fillRect(x0 + w, y0, 3, h);
  x.fillStyle = P.white; x.fillRect(x0 + (w >> 1) - 2, y0, 4, h); x.fillRect(x0, y0 + (h >> 1) - 2, w, 4);
  x.fillStyle = "rgba(255,255,255,.35)"; for (let i = 0; i < 18; i++) x.fillRect(x0 + 8 + i, y0 + 6 + i, 2, 1);
}
function paintGround() {
  const [c, x] = mk(MW, MH); GROUND = c;
  // lantai panel putih-biru
  for (let ty = 0; ty < GH; ty++) for (let tx = 0; tx < GW; tx++) {
    const px = tx * T, py = ty * T, bay = px < BAY || px >= MW - BAY, deck = py < DECK_Y && px >= BAY && px < MW - BAY;
    x.fillStyle = bay ? "#cfdff4" : deck ? "#d7e6f8" : ((tx + ty) % 2 ? "#eaf2fc" : "#e6effb"); x.fillRect(px, py, T, T);
    x.fillStyle = bay ? "#b4c9e6" : P.seam; x.fillRect(px + T - 1, py, 1, T); x.fillRect(px, py + T - 1, T, 1);
    x.fillStyle = "#f9fcff"; x.fillRect(px, py, T - 1, 1); x.fillRect(px, py, 1, T - 1);
    x.fillStyle = "#9db6d8"; x.fillRect(px + 3, py + 3, 1, 1); x.fillRect(px + T - 5, py + 3, 1, 1); x.fillRect(px + 3, py + T - 5, 1, 1); x.fillRect(px + T - 5, py + T - 5, 1, 1);
    if (!bay && !deck && (tx * 7 + ty * 3) % 11 === 0) { x.fillStyle = "#dbe8f8"; x.fillRect(px + 8, py + 8, 15, 15); x.fillStyle = "#c6d9f1"; x.fillRect(px + 8, py + 22, 15, 1); x.fillRect(px + 22, py + 8, 1, 15); }
  }
  // panggung command center: tepi depan + garis hazard
  x.fillStyle = P.royal; x.fillRect(BAY, DECK_Y, MW - 2 * BAY, 6); x.fillStyle = P.deep; x.fillRect(BAY, DECK_Y + 6, MW - 2 * BAY, 3);
  for (let i = BAY; i < MW - BAY; i += 8) { x.fillStyle = (i / 8) % 2 ? P.yel : P.hz; x.fillRect(i, DECK_Y - 8, 8, 6); }
  for (const c2 of CONSOLES) { x.fillStyle = "rgba(43,99,200,.14)"; x.fillRect(c2.x - 62, WALL_Y + 8, 124, DECK_Y - WALL_Y - 16); }
  // strip cahaya cyan (jalur)
  const strip = (x0, y0, w, h) => { x.fillStyle = P.cyan; x.fillRect(x0, y0, w, h); x.fillStyle = P.cyanL; if (w > h) x.fillRect(x0, y0 + (h >> 1), w, 1); else x.fillRect(x0 + (w >> 1), y0, 1, h); };
  strip(BAY, DECK_Y + 14, MW - 2 * BAY, 3); strip(CORE.x - 2, DECK_Y + 17, 3, CORE.y - 140 - DECK_Y - 17);
  strip(PADS[0].x, PADS[0].y, 150, 3); strip(PADS[1].x - 150, PADS[1].y, 150, 3); strip(BAY, DECK_Y + 17, 3, POD_Y - 60 - DECK_Y - 17); strip(MW - BAY - 3, DECK_Y + 17, 3, POD_Y - 60 - DECK_Y - 17);
  strip(PODX0, POD_Y + 34, PODX1 - PODX0, 3);
  // alas teluk kapsul
  x.fillStyle = "#cfdff4"; x.fillRect(PODX0, POD_Y - 60, PODX1 - PODX0, 70); x.fillStyle = "#b4c9e6"; x.fillRect(PODX0, POD_Y + 10, PODX1 - PODX0, 2);
  // lingkaran inti energi di lantai
  pxEllipse(x, CORE.x, CORE.y - 20, 150, 80, "#d4e3f7"); pxRing(x, CORE.x, CORE.y - 20, 150, 80, P.seam, 2);
  pxRing(x, CORE.x, CORE.y - 20, 136, 72, P.cyan, 2); pxRing(x, CORE.x, CORE.y - 20, 104, 55, "#9fdcf5", 1);
  // teks lantai
  pxText(x, "ENERGY CORE", CORE.x, CORE.y + 40, "#9cb8dc", 8, "center");
  pxText(x, "TELEPORT", PADS[0].x, PADS[0].y + 22, "#7f9cc8", 8, "center"); pxText(x, "TELEPORT", PADS[1].x, PADS[1].y + 22, "#7f9cc8", 8, "center");
  pxText(x, "RECHARGE BAY", CORE.x, POD_Y + 44, "#7f9cc8", 8, "center");

  // dinding belakang
  x.fillStyle = P.deep; x.fillRect(0, 0, MW, 22); x.fillStyle = P.royal; x.fillRect(0, 18, MW, 4);
  for (let px = 0; px < MW; px += 64) { x.fillStyle = P.white; x.fillRect(px, 22, 64, 126); x.fillStyle = P.w2; x.fillRect(px + 62, 22, 2, 126); x.fillRect(px, 84, 64, 2); x.fillStyle = "#fff"; x.fillRect(px + 2, 24, 58, 2); x.fillStyle = "#c4d6ee"; x.fillRect(px + 4, 128, 56, 8); }
  x.fillStyle = P.royal; x.fillRect(0, 148, MW, 20); x.fillStyle = P.deep; x.fillRect(0, 168, MW, 8); x.fillStyle = P.cyan; x.fillRect(0, 156, MW, 3);
  x.fillStyle = P.navy; x.fillRect(0, 176, MW, 8); x.fillStyle = "#5c7fb8"; x.fillRect(0, 176, MW, 2);
  for (let px = 16; px < MW; px += 48) { x.fillStyle = P.cyanL; x.fillRect(px, 162, 6, 2); }
  pxText(x, "MISSION CONTROL", MW / 2, 3, "#ffffff", 16, "center", P.ink);
  paintSkyWindow(x, 52, 34, 144, 90); paintSkyWindow(x, MW - 196, 34, 144, 90);
  pxText(x, "ROBOT HQ · R&D LAB", MW / 2, 139, "#5f7fb8", 8, "center");
  // rangka monitor besar (isi dinamis di drawScreens)
  x.fillStyle = P.ink; x.fillRect(SCR.x - 6, SCR.y - 6, SCR.w + 12, SCR.h + 12); x.fillStyle = "#3c4f80"; x.fillRect(SCR.x - 4, SCR.y - 4, SCR.w + 8, 2);
  // dinding samping & depan
  for (const wx of [0, MW - 40]) { x.fillStyle = P.navy; x.fillRect(wx, WALL_Y - 14, 40, MH); x.fillStyle = P.royal; x.fillRect(wx + (wx ? 0 : 36), WALL_Y - 14, 4, MH); x.fillStyle = "#3b6fc8"; for (let y = WALL_Y; y < MH; y += 64) x.fillRect(wx + 8, y, 24, 2); }
  x.fillStyle = P.navy; x.fillRect(0, MH - 32, MW, 32); x.fillStyle = P.royal; x.fillRect(0, MH - 32, MW, 4); x.fillStyle = P.cyan; x.fillRect(40, MH - 24, MW - 80, 2);
  return c;
}
const SCR = { x: MW / 2 - 296, y: 28, w: 592, h: 104 };

/* ---------------- objek prosedural (di-cache sebagai canvas 1x) ---------------- */
function outlineRect(x, x0, y0, w, h, fill, edge = P.ink) { x.fillStyle = edge; x.fillRect(x0, y0, w, h); x.fillStyle = fill; x.fillRect(x0 + 1, y0 + 1, w - 2, h - 2); }
function makeConsole(acc) {
  // AI-made console sprite (assets/props/console.png, same pipeline as the other props) + per-agent accent LED strip
  const im = IMG.prop_console, [c, x] = mk(im.width, im.height); x.drawImage(im, 0, 0);
  x.fillStyle = acc; x.fillRect(47, 65, 18, 2); x.fillStyle = "rgba(255,255,255,.75)"; x.fillRect(47, 65, 18, 1);
  return { c, w: im.width, h: im.height, ox: -Math.floor(im.width / 2), oy: -im.height + 1 };   // offset to (center x, base y)
}
function makePod(id, acc) {
  const name = (AGENTS.find(a => a.id === id).name || id).toUpperCase();
  // badan belakang
  const [b, x] = mk(84, 140); const cx = 42, by = 132;      // by = y alas di kanvas
  pxEllipse(x, cx, by - 6, 37, 11, P.ink); pxEllipse(x, cx, by - 7, 35, 9, "#dbe7f8"); pxEllipse(x, cx, by - 9, 28, 6, "#b7cbe8"); pxRing(x, cx, by - 9, 28, 6, P.cyan);
  outlineRect(x, cx - 26, by - 102, 52, 92, "#3d6fc4"); x.fillStyle = "#7fa8e0"; x.fillRect(cx - 22, by - 98, 44, 84);
  x.fillStyle = "#a9c6ee"; x.fillRect(cx - 22, by - 98, 44, 3); x.fillStyle = "#5a86d0"; x.fillRect(cx - 21, by - 60, 42, 1); x.fillRect(cx - 21, by - 36, 42, 1);
  x.fillStyle = P.cyan; x.fillRect(cx - 20, by - 94, 2, 76); x.fillRect(cx + 18, by - 94, 2, 76);
  // tutup atas
  outlineRect(x, cx - 32, by - 112, 64, 16, P.white); x.fillStyle = P.w3; x.fillRect(cx - 31, by - 100, 62, 3); x.fillStyle = P.royal; x.fillRect(cx - 31, by - 106, 62, 2);
  // kaca (terpisah, digeser saat buka)
  const [g, gx] = mk(52, 86);
  gx.fillStyle = "rgba(170,236,255,.22)"; gx.fillRect(0, 0, 52, 86); gx.fillStyle = "rgba(255,255,255,.7)"; gx.fillRect(6, 4, 3, 74); gx.fillRect(12, 4, 1, 50);
  gx.fillStyle = "rgba(255,255,255,.35)"; gx.fillRect(42, 10, 2, 66); gx.fillStyle = "rgba(88,232,255,.85)"; gx.fillRect(0, 0, 1, 86); gx.fillRect(51, 0, 1, 86); gx.fillRect(0, 85, 52, 1);
  // papan nama
  const tw = name.length * 8 + 8; const [n, nx] = mk(tw, 13);
  outlineRect(nx, 0, 0, tw, 13, P.navy); nx.fillStyle = acc; nx.fillRect(1, 11, tw - 2, 1);
  pxText(nx, name, tw / 2, 2, "#ffffff", 8, "center");
  return { back: b, glass: g, plate: n };
}
function makePad() {
  const [c, x] = mk(100, 40); const cx = 50, cy = 20;
  pxEllipse(x, cx, cy + 2, 46, 17, P.ink); pxEllipse(x, cx, cy + 1, 44, 15, P.white); pxEllipse(x, cx, cy, 36, 12, P.navy); pxEllipse(x, cx, cy, 34, 11, "#1a4fa8");
  x.fillStyle = P.w3; x.fillRect(cx - 44, cy + 3, 88, 2);
  return c;
}
let DESKS = {}, PODIMG = {}, PADIMG, SHADOW;
function buildObjects() {
  for (const a of AGENTS) { DESKS[a.id] = makeConsole(a.accent); PODIMG[a.id] = makePod(a.id, a.accent); }
  PADIMG = makePad();
  const [s, x] = mk(36, 12); pxEllipse(x, 18, 6, 15, 4, "rgba(20,40,90,.25)"); SHADOW = s;
}
/* ---------------- kursi sofa ---------------- */
const SEATS = { sofa: SOFAS.flatMap((s, i) => [{ x: s.x - 22, y: s.y - 2, flip: false, sofa: i, by: null }, { x: s.x + 22, y: s.y - 2, flip: true, sofa: i, by: null }]) };
function claim(list, g) { const free = list.filter(s => !s.by || s.by === g); if (!free.length) return null; const s = pick(free); s.by = g; return s; }
function release(g) { for (const l of Object.values(SEATS)) for (const s of l) if (s.by === g) s.by = null; }

/* ---------------- agent ---------------- */
let TOPS = {};                                         // baris teratas tiap frame (buat posisi label)
class Agent {
  constructor(a, i) {
    this.a = a; this.i = i; this.id = a.id; this.pod = PODS[a.id]; this.desk = CONSOLES.find(c => c.id === a.id);
    this.x = this.pod.x; this.y = this.pod.y + 30; this.flip = false;
    this.pose = "stand"; this.anim = "idle"; this.t = Math.random() * 10; this.blinkT = rand(1, 4);
    this.tasks = []; this.task = null; this.path = null; this.mode = null; this.where = "Markas"; this.seat = null;
    this.hidden = false; this.fx = null; this.nextTalk = rand(6, 20); this.bubbleT = 0;
    const el = document.createElement("div"); el.className = "lbl"; el.style.setProperty("--a", a.accent);
    el.innerHTML = `<div class="bub"></div><div class="nm"><i class="dot"></i>${esc(a.name)}</div>`;
    $("labels").appendChild(el); this.el = el; this.bub = el.querySelector(".bub"); this.dot = el.querySelector(".dot");
    el.querySelector(".nm").addEventListener("click", ev => { ev.stopPropagation(); select(this); });
  }
  /* ---- antrian tugas ---- */
  setTasks(list) { this.tasks = list; this.task = null; this.path = null; }
  push(...t) { this.tasks.push(...t); }
  getUp() {
    const P2 = this.pod, out = [];
    if (this.pose === "charge" && this.k) out.push({ fn: () => { P2.want = 1; P2.busy = 0; this.quiet(); } }, { wait: .4 }, { pose: "stand" }, { beam: "out" },
      { fn: () => { P2.want = 0; const t = this.onlineSpot(); this.x = t.x; this.y = t.y; } }, { wait: .3 }, { beam: "in", pad: this.onlinePad }, { wait: .2 });
    else if (this.pose === "charge") out.push({ fn: () => { P2.want = 1; P2.busy = 0; this.quiet(); } }, { wait: .5 }, { pose: "stand" }, { move: { x: P2.x, y: P2.y + 30 } }, { fn: () => P2.want = 0 });
    else if (this.pose === "sit" && this.seat && this.seat.sofa != null) out.push({ pose: "stand" }, { move: { x: this.seat.x, y: this.seat.y + 26 } });
    else if (this.pose === "sit") out.push({ pose: "stand" }, { move: { x: this.desk.x + SEAT_DX, y: DESK.walkY } });
    release(this); this.seat = null;
    return out;
  }
  onlineSpot() {           // KAIRO: ke mana nerd teleport waktu online lagi (depan konsol kalau kerja, pad kalau santai)
    this.onlinePad = null;
    if (this.mode === "work") return { x: this.desk.x + SEAT_DX, y: DESK.walkY };
    const k = this.x < CX ? 0 : 1; this.onlinePad = k; return { x: PADS[k].x, y: PADS[k].y - 4 };
  }
  setMode(mode, first) {
    if (mode === this.mode) return; this.mode = mode;
    if (first) return this.placeFirst();
    this.plan();
  }
  plan() {
    const m = this.mode, up = this.getUp();
    if (m === "work") this.setTasks([...up, ...this.workTasks()]);
    else if (m === "sleep") this.setTasks([...up, ...this.sleepTasks()]);
    else { this.setTasks(up); this.decide(); }
  }
  workTasks() {
    const d = this.desk;
    return [{ walk: { x: d.x + SEAT_DX, y: DESK.walkY }, where: "Command Center · konsol" }, { fn: () => { this.x = d.x + SEAT_DX; this.y = DESK.seatY; this.flip = false; } }, { pose: "sit" }, { wait: Infinity, work: true }];
  }
  sleepTasks() {
    const p = this.pod;
    if (this.k) return [{ kfx: "def" }, { fn: () => { this.x = p.x; this.y = p.y - 4; this.flip = this.i % 2 === 1; p.want = 1; this.where = "Kapsul isi ulang"; } }, { wait: .45 },
      { beam: "in" }, { fn: () => { this.flip = this.i % 2 === 1; } }, { wait: .25 }, { fn: () => { p.want = 0; p.busy = 1; } }, { pose: "charge" }, { fn: () => this.say("CHG", 0, "chg") }, { wait: Infinity }];
    return [{ walk: { x: p.x, y: p.y + 30 }, where: "Kapsul isi ulang" }, { fn: () => p.want = 1 }, { wait: .55 }, { move: { x: p.x, y: p.y - 4 } },
      { fn: () => { this.flip = this.i % 2 === 1; p.want = 0; p.busy = 1; } }, { pose: "charge" }, { fn: () => this.say("CHG", 0, "chg") }, { wait: Infinity }];
  }
  decide() {
    if (this.mode !== "idle") return;
    const r = Math.random();
    if (r < .4) { const s = claim(SEATS.sofa, this); if (s) { this.seat = s; return this.push({ walk: { x: s.x, y: s.y + 26 }, where: "Lounge inti energi" }, { move: { x: s.x, y: s.y } }, { fn: () => this.flip = s.flip }, { pose: "sit" }, { wait: rand(12, 26) }, ...[{ fn: () => { this.tasks.unshift(...this.getUp()); } }], { fn: () => this.decide() }); } }
    if (r < .58) {
      const a = Math.random() < .5 ? 0 : 1, b = 1 - a, A = PADS[a], B = PADS[b];
      return this.push({ walk: { x: A.x, y: A.y - 4 }, where: "Teleporter" }, { beam: "out", pad: a }, { fn: () => { this.x = B.x; this.y = B.y - 4; } }, { beam: "in", pad: b }, { wait: rand(1, 2) }, { fn: () => this.decide() });
    }
    const w = pick(WANDER);
    this.push({ walk: { x: w[0], y: w[1] }, where: "Keliling markas" }, { wait: rand(3, 8), look: true }, { fn: () => this.decide() });
  }
  placeFirst() {          // pertama dibuka: langsung di tempatnya; yang santai muncul lewat teleport
    const m = this.mode;
    if (m === "work" && this.k) { this.x = this.desk.x + SEAT_DX; this.y = DESK.walkY; this.hidden = true; this.where = "Command Center · konsol";
      this.setTasks([{ wait: .6 }, { beam: "in" }, { wait: .3 }, ...this.workTasks()]); }
    else if (m === "work") { this.x = this.desk.x + SEAT_DX; this.y = DESK.seatY; this.flip = false; this.pose = "sit"; this.where = "Command Center · konsol"; this.setTasks([{ wait: Infinity, work: true }]); }
    else if (m === "sleep") { const p = this.pod; this.x = p.x; this.y = p.y - 4; this.flip = this.i % 2 === 1; this.pose = "charge"; p.busy = 1; this.where = "Kapsul isi ulang"; this.say("CHG", 0, "chg"); this.setTasks([{ wait: Infinity }]); }
    else { const k = this.i % 2, Pd = PADS[k]; this.x = Pd.x + (this.i % 3 - 1) * 4; this.y = Pd.y - 4; this.hidden = true; this.where = "Teleporter";
      this.setTasks([{ wait: .4 + this.i * .55 }, { beam: "in", pad: k }, { wait: 1 }, { fn: () => this.decide() }]); }
  }
  /* ---- gerak ---- */
  startWalk(tgt) {
    const [sx, sy] = nearestFree(...toTile(this.x, this.y)), [gx, gy] = nearestFree(...toTile(tgt.x, tgt.y));
    const p = smooth(astar(sx, sy, gx, gy));
    this.path = (p ? p.slice(1).map(([x, y]) => tileC(x, y)) : []).concat([{ x: tgt.x, y: tgt.y }]);
  }
  stepTo(tgt, dt) {
    const dx = tgt.x - this.x, dy = tgt.y - this.y, d = Math.hypot(dx, dy), st = SPEED * dt;
    if (Math.abs(dx) > .3) this.flip = dx < 0;
    this.up = dy < -.3 && Math.abs(dy) > Math.abs(dx) * .9;
    if (d <= st) { this.x = tgt.x; this.y = tgt.y; return true; }
    this.x += dx / d * st; this.y += dy / d * st; return false;
  }
  say(text, dur = 4, cls = "") { this.bub.className = "bub show " + cls; this.bub.textContent = text; this.bubbleT = dur; this.bubbleSticky = !dur; }
  quiet() { this.bub.className = "bub"; this.bubbleSticky = false; this.bubbleT = 0; }
  react() {
    if (this.pose === "charge") { this.say("Lagi ngecas…", 3, "chg"); setTimeout(() => this.pose === "charge" && this.say("CHG", 0, "chg"), 3200); return; }
    this.say(pick(this.a.lines), 4);
    if (!this.fx && !this.hidden && (!this.task || !this.task.walk && !this.task.move)) { this.waveT = 1.6; this.waveFlip = this.flip; }
  }
  update(dt) {
    this.t += dt;
    if (this.bubbleT > 0) { this.bubbleT -= dt; if (this.bubbleT <= 0 && !this.bubbleSticky) this.quiet(); }
    if (this.waveT > 0) this.waveT -= dt;
    this.blinkT -= dt; if (this.blinkT < -.13) this.blinkT = rand(2.5, 5.5);
    if (this.fx) { this.fx.t += dt; if (this.fx.t >= this.fx.dur) { const f = this.fx; this.fx = null; if (f.kind === "out" || f.kind === "def") this.hidden = true; } else return; }
    this.anim = "idle"; this.up = false;
    if (!this.task) { this.task = this.tasks.shift() || null; if (!this.task) return; this.task.t = 0; }
    const k = this.task; k.t += dt;
    if (k.fn) { k.fn(); return this.next(); }
    if (k.pose) { this.pose = k.pose; return this.next(); }
    if (k.walk) {
      if (!this.path) { this.startWalk(k.walk); this.where = k.where || this.where; this.pose = "stand"; }
      this.anim = "walk"; if (this.stepTo(this.path[0], dt)) { this.path.shift(); if (!this.path.length) { this.path = null; this.next(); } }
      return;
    }
    if (k.move) { this.anim = "walk"; if (this.stepTo(k.move, dt * .8)) this.next(); return; }
    if (k.beam) {
      if (!k.started) { k.started = true; if (k.pad != null) PADS[k.pad].t = 1.2;
        const kd = this.k ? this.kdur("tp") : 0;
        this.fx = { kind: k.beam, t: 0, dur: this.k ? (k.beam === "in" ? TPA + kd + .1 : kd + TPA) : k.beam === "in" ? .62 : .55 };
        if (k.beam === "in") { this.hidden = false; if (k.pad != null) { this.flip = Math.random() < .5; this.where = "Teleporter"; } } return; }
      return this.next();
    }
    if (k.kfx) {
      if (!k.started) { k.started = true; this.pose = "stand"; this.fx = { kind: k.kfx, t: 0, dur: this.kdur(k.kfx) + .15 }; return; }
      return this.next();
    }
    if (k.wait != null) {
      if (k.work && k.t > (k.nextEmo || (k.nextEmo = rand(5, 12)))) { k.nextEmo = k.t + rand(8, 16); this.say(this.a.emotes.work, 1.6, "emo"); }
      if (this.mode !== "sleep") { this.nextTalk -= dt; if (this.nextTalk <= 0) { this.nextTalk = rand(16, 40); if (Math.random() < .5) this.say(Math.random() < .3 ? this.a.emotes.idle : pick(this.a.lines), 3.5, ""); } }
      if (k.t >= k.wait) this.next();
    }
  }
  next() { this.task = null; }
  frame() {
    if (this.waveT > 0 && this.pose === "stand") return Math.floor(this.t * 4) % 2 ? FR.wave1 : FR.wave0;
    if (this.anim === "walk") { const f = Math.floor(this.t * 7.5) % 4; return (this.up ? FR.back0 : FR.walk0) + f; }
    if (this.pose === "sit") return this.blinkT < 0 && FR.sitblink != null ? FR.sitblink : Math.floor(this.t * .9 + this.i * .3) % 2 ? FR.sit1 : FR.sit0;
    if (this.pose === "charge") return FR.charge;
    if (this.blinkT < 0) return FR.blink;
    return Math.floor(this.t * 1.7 + this.i) % 2 ? FR.idle1 : FR.idle0;
  }
  /* ---- KAIRO (frame AI) ---- */
  get k() { return ANIM_NEW ? KAIRO[this.id] || null : null; }      // OLD = frame lama dari kode (sheet <id>.png)
  kdur(seq) { const K = this.k; return K.seq[seq].length * K.ticks[seq] / 60; }
  kseq(seq, t) { const K = this.k, s = K.seq[seq], i = Math.floor(t * 60 / K.ticks[seq]); return s[K.loop[seq] ? i % s.length : Math.min(i, s.length - 1)]; }
  kframe() {               // -> index di sheet KAIRO, atau null = pakai sheet lama (duduk, lambai, ngecas)
    if (!this.k || this.fx) return null;
    if (this.waveT > 0 && this.pose === "stand") return null;
    if (this.anim === "walk") return this.kseq(this.up ? "back" : "walk", this.t);
    if (this.pose !== "stand") return null;
    if (this.blinkT < 0) return this.k.seq.blink[0];
    return this.kseq("idle", this.t);
  }
  get sortY() { return this.y; }
  box() { return { x0: this.x - 18, x1: this.x + 18, y0: this.y - 84, y1: this.y + 4 }; }
  headY() { const kf = this.kframe(), top = kf != null && KTOPS[this.id] ? KTOPS[this.id][kf] : TOPS[this.id] ? TOPS[this.id][this.frame()] : 10; return this.y - (BASE - top); }
}
/* ---------------- kamera ---------------- */
const canvas = $("scene"), ctx = canvas.getContext("2d");
let DPR = 1, VW = 0, VH = 0;
const HOME = { x: MW / 2, y: MH / 2 };
const cam = { x: HOME.x, y: HOME.y, z: 1, s: 1, fitZ: 1, auto: true };
/* zoom "fit": skala device-pixel BULAT terbesar yang muat seluruh markas (dinding luar boleh kepotong 24/12 px).
   1280x800 @1x dan laptop retina 1440x900 @2x -> x1 tajam. Kalau layar lebih kecil dari peta (s<1), dipakai skala pecahan
   dengan smoothing (diperkecil halus, bukan pixel bergerigi). Mobile tetap mulai dari x0.5 di tengah markas. */
function fitZoom() {
  if (MOBILE) return DPR >= 2 ? .5 : 1;
  const dev = Math.min(VW / (MW - 48), VH / (MH - 24));
  return (dev >= 1 ? Math.floor(dev) : Math.floor(dev * 100) / 100) / DPR;
}
function zoomList() { return [...new Set([...ZOOMS, cam.fitZ])].sort((a, b) => a - b); }
function zoomInit() { const q = parseFloat(Q.get("zoom")); cam.auto = !ZOOMS.includes(q); return cam.auto ? cam.fitZ : q; }
function applyZoom() {
  const raw = cam.z * DPR;
  // skala device-pixel bulat = pixel tajam. Pengecualian: x1.5 di layar DPR 1 tetap 1.5 (pixel dunia jadi pola 2-1-2-1 device px);
  // grid-nya dikunci ke dunia lewat offX/offY kelipatan 3 + sprite bergerak di koordinat genap, jadi polanya stabil (nggak "berkilau" saat geser).
  // Di DPR 2, x1.5 = skala 3 (bulat, tajam penuh).
  cam.s = raw < 1 ? raw : Math.abs(raw - Math.round(raw)) < .01 ? Math.round(raw) : DPR === 1 && Math.abs(raw - 1.5) < .01 ? 1.5 : Math.max(1, Math.round(raw));
  $("zoomLbl").textContent = "×" + +(cam.s / DPR).toFixed(2);
  clampCam();
}
function clampCam() {
  const hw = VW / 2 / cam.s, hh = VH / 2 / cam.s;
  cam.x = MW > hw * 2 ? clamp(cam.x, hw, MW - hw) : MW / 2;
  cam.y = MH > hh * 2 ? clamp(cam.y, hh, MH - hh) : MH / 2;
}
function resize() { DPR = Math.min(3, window.devicePixelRatio || 1); VW = Math.round(innerWidth * DPR); VH = Math.round(innerHeight * DPR); canvas.width = VW; canvas.height = VH; cam.fitZ = fitZoom(); if (cam.auto) cam.z = cam.fitZ; applyZoom(); }
function setZoom(z, ax, ay, auto = false) { cam.auto = auto; const before = ax != null ? screenToWorld(ax, ay) : null; cam.z = z; applyZoom(); if (before) { const after = screenToWorld(ax, ay); cam.x += before.x - after.x; cam.y += before.y - after.y; clampCam(); } }
function stepZoom(d, ax, ay) { const L = zoomList(); let i = L.indexOf(cam.z); if (i < 0) i = L.findIndex(z => z >= cam.z); const j = clamp(i + d, 0, L.length - 1); setZoom(L[j], ax, ay, L[j] === cam.fitZ); }
const GQ = () => cam.s >= 1 && cam.s % 1 ? Math.round(cam.s * 2) : 1;   // x1.5 -> offset kelipatan 3 device px (2 pixel dunia)
const offX = () => { const q = GQ(); return Math.round((VW / 2 - cam.x * cam.s) / q) * q; }, offY = () => { const q = GQ(); return Math.round((VH / 2 - cam.y * cam.s) / q) * q; };
function screenToWorld(cx, cy) { return { x: (cx * DPR - offX()) / cam.s, y: (cy * DPR - offY()) / cam.s }; }
function worldToScreen(x, y) { return { x: (x * cam.s + offX()) / DPR, y: (y * cam.s + offY()) / DPR }; }

/* ---------------- layar monitor besar (animasi, digambar 1x) ---------------- */
const [SCRC, sx] = mk(SCR.w, SCR.h);
function drawScreens(t) {
  const x = sx; x.fillStyle = "#081a40"; x.fillRect(0, 0, SCR.w, SCR.h);
  // A: grafik
  const A = { x: 0, w: 196 }; x.fillStyle = "#0c2552"; x.fillRect(A.x + 2, 2, A.w - 4, SCR.h - 4);
  x.fillStyle = "#16386f"; for (let i = 0; i < 6; i++) x.fillRect(A.x + 4, 12 + i * 16, A.w - 8, 1); for (let i = 0; i < 8; i++) x.fillRect(A.x + 8 + i * 24, 4, 1, SCR.h - 8);
  for (let i = 0; i < A.w - 12; i += 2) { const v = Math.sin((i + t * 40) * .05) * 18 + Math.sin((i + t * 25) * .13) * 9; x.fillStyle = P.cyan; x.fillRect(A.x + 6 + i, R(56 + v), 2, 2); const w2 = Math.cos((i + t * 30) * .04) * 14; x.fillStyle = P.yel; x.fillRect(A.x + 6 + i, R(76 + w2), 2, 1); }
  for (let i = 0; i < 10; i++) { const h = R(10 + 8 * (1 + Math.sin(t * 1.3 + i))); x.fillStyle = i % 2 ? "#5cf08a" : "#58e8ff"; x.fillRect(A.x + 10 + i * 17, SCR.h - 6 - h, 10, h); }
  pxText(x, "SYS LOAD", A.x + 6, 4, "#9fd8ff", 8);
  // B: radar (titik = posisi kru)
  const B = { x: 200, w: 192, cx: 296, cy: 52 }; x.fillStyle = "#06264a"; x.fillRect(B.x + 2, 2, B.w - 4, SCR.h - 4);
  for (const r of [16, 32, 48]) pxRing(x, B.cx, B.cy, r, r, "#1d5a8a");
  x.fillStyle = "#1d5a8a"; x.fillRect(B.cx - 50, B.cy, 100, 1); x.fillRect(B.cx, B.cy - 50, 1, 100);
  const ang = t * 1.6; for (let r = 0; r < 48; r++) { x.fillStyle = r % 2 ? "#58e8ff" : "#3fbfe0"; x.fillRect(R(B.cx + Math.cos(ang) * r), R(B.cy + Math.sin(ang) * r), 2, 2); }
  for (const g of AG) { if (g.hidden) continue; const px = B.cx + (g.x - MW / 2) / MW * 92, py = B.cy + (g.y - MH / 2) / MH * 92; x.fillStyle = g.a.accent; x.fillRect(R(px) - 1, R(py) - 1, 3, 3); }
  pxText(x, "RADAR", B.x + 6, 4, "#9fd8ff", 8);
  // C: status kru (bar energi)
  const C = { x: 396, w: 196 }; x.fillStyle = "#0c2552"; x.fillRect(C.x + 2, 2, C.w - 4, SCR.h - 4);
  pxText(x, "CREW STATUS", C.x + 6, 4, "#9fd8ff", 8);
  AG.forEach((g, i) => {
    const y = 16 + i * 13, m = g.info ? g.info.mode : "idle"; pxText(x, g.a.name.toUpperCase().slice(0, 8), C.x + 6, y, g.a.accent, 8);
    const col = m === "work" ? P.green : m === "sleep" ? "#8fd8ff" : P.yel, n = m === "work" ? 8 : m === "sleep" ? 1 + Math.floor(t * 2 + i) % 8 : 5;
    for (let k = 0; k < 8; k++) { x.fillStyle = k < n ? col : "#1d3a6a"; x.fillRect(C.x + 104 + k * 10, y, 8, 7); }
  });
  x.fillStyle = "rgba(255,255,255,.05)"; for (let y = 0; y < SCR.h; y += 2) x.fillRect(0, y, SCR.w, 1);
}

/* ---------------- render ---------------- */
let AG = [], SEL = null, FOLLOW = false;
const light = document.createElement("canvas"), lctx = light.getContext("2d");
const DRONE = { x: 600, y: 520 };
function drawSprite(c, img, f, x, y, flip) {
  if (GQ() > 1) { x = Math.round(x / 2) * 2; y = Math.round(y / 2) * 2; }   // x1.5: sprite selalu kena pola 2-1 yang sama

  if (flip) { c.save(); c.translate(R(x), 0); c.scale(-1, 1); c.drawImage(img, f * CW, 0, CW, CH, -CW / 2, R(y) - BASE, CW, CH); c.restore(); }
  else c.drawImage(img, f * CW, 0, CW, CH, R(x) - CW / 2, R(y) - BASE, CW, CH);
}
function drawAgent(c, g, t) {
  if (g.hidden && !g.fx) return;
  const img = IMG["spr_" + g.id], wht = IMG["wht_" + g.id];
  if (g.pose !== "charge" && !(g.pose === "sit")) c.drawImage(SHADOW, R(g.x) - 18, R(g.y) - 6);
  if (g === SEL) { c.fillStyle = P.yel; for (const [dx, dy] of [[-16, 0], [15, 0], [-13, 3], [12, 3], [-13, -3], [12, -3]]) c.fillRect(R(g.x) + dx, R(g.y) + dy, 2, 1); }
  const f = g.frame();
  if (g.k && g.fx) return drawKairoFx(c, g);
  const kf = g.kframe();
  if (kf != null) return drawSprite(c, IMG["k_" + g.id], kf, g.x, g.y, g.flip);
  if (g.fx) {   // teleport ala 16-bit: berkas cahaya turun / naik + kedip siluet putih
    const F = g.fx, u = F.t / F.dur, col = g.a.accent, x = R(g.x), y = R(g.y);
    const bar = (top, bot, w) => { c.fillStyle = col; c.fillRect(x - (w >> 1), R(top), w, R(bot - top)); c.fillStyle = "#fff"; c.fillRect(x - (w >> 1) + 2, R(top), Math.max(1, w - 4), R(bot - top)); };
    if (F.kind === "in") {
      if (u < .5) { const yb = y - 700 + (700) * (u / .5); bar(yb - 60, yb, 8); }
      else if (u < .72) { bar(y - 72, y, 8); c.fillStyle = col; c.fillRect(x - 14, y - 2, 28, 2); }
      else if (u < .86) drawSprite(c, wht, FR.idle0, g.x, g.y, g.flip);
      else drawSprite(c, img, FR.idle0, g.x, g.y, g.flip);
    } else {
      if (u < .2) drawSprite(c, wht, FR.idle0, g.x, g.y, g.flip);
      else if (u < .4) bar(y - 72, y, 8);
      else { const yb = y - 700 * ((u - .4) / .6); bar(yb - 72, yb, 8); }
    }
    return;
  }
  drawSprite(c, img, f, g.x, g.y, g.waveT > 0 && g.pose === "stand" ? g.waveFlip : g.flip);
}
/* KAIRO teleport / defeat: berkas (frame 0 sheet) jatuh dari langit, lalu frame AI materialisasi; "out" = kebalikannya */
function drawKairoFx(c, g) {
  const F = g.fx, K = g.k, img = IMG["k_" + g.id], tp = K.seq.tp, kd = g.kdur("tp");
  if (F.kind === "def") return drawSprite(c, img, g.kseq("def", F.t), g.x, g.y, g.flip);
  if (F.kind === "in") {
    if (F.t < TPA) return drawSprite(c, img, tp[0], g.x, g.y - 700 * (1 - F.t / TPA), g.flip);
    return drawSprite(c, img, F.t - TPA < kd ? tp[Math.min(tp.length - 1, 1 + Math.floor((F.t - TPA) * 60 / K.ticks.tp))] : tp[tp.length - 1], g.x, g.y, g.flip);
  }
  if (F.t < kd) return drawSprite(c, img, tp[Math.max(0, tp.length - 1 - Math.floor(F.t * 60 / K.ticks.tp))], g.x, g.y, g.flip);
  drawSprite(c, img, tp[0], g.x, g.y - 700 * ((F.t - kd) / TPA), g.flip);
}
function drawConsole(k, t) {
  const c = ctx;
  const D = DESKS[k.id], x0 = k.x + D.ox, y0 = DESK.y + D.oy, ph = k.x * .013;
  c.drawImage(D.c, x0, y0);
  // side monitor: scrolling code lines (screen area of the console sprite: x 25..42, y 7..18)
  const sc = Math.floor(t * 3 + ph * 7);
  for (let i = 0; i < 5; i++) { const w = 4 + ((sc + i) * 7 % 11); c.fillStyle = i === 4 ? "#ffffff" : (i + sc) % 3 ? "#7fe8ff" : "#3fb6ff"; c.fillRect(x0 + 27, y0 + 8 + i * 2, w, 1); }
  if (Math.floor(t * 2 + ph) % 2) { c.fillStyle = "#ffffff"; c.fillRect(x0 + 27 + 4 + (sc * 7 % 11), y0 + 16, 2, 1); }
  // translucent holo screen in front of the operator (mirrored: we see it from behind), with flicker + scanline
  const fl = .5 + .08 * Math.sin(t * 9 + ph * 3) + (Math.floor(t * 13 + ph) % 23 === 0 ? -.2 : 0);
  c.globalAlpha = fl; c.drawImage(IMG.prop_console_holo, x0, y0); c.globalAlpha = 1;
  const sy = Math.floor((t * 14 + ph * 40) % 20); c.fillStyle = "rgba(200,250,255,.55)"; c.fillRect(x0 + 58, y0 + 5 + sy, 33, 1);
}
function drawPod(c, p, t, part) {
  const I = PODIMG[p.id], x0 = R(p.x) - 42, y0 = R(p.y) - 132, top = y0 + 20;
  if (part === "back") { c.drawImage(I.back, x0, y0); return; }
  // cahaya isi ulang di dalam kapsul
  if (p.busy) { const k = .5 + .5 * Math.sin(t * 3); c.globalCompositeOperation = "lighter"; c.fillStyle = `rgba(60,200,255,${.18 + .12 * k})`; c.fillRect(R(p.x) - 25, R(p.y) - 96, 50, 86);
    const sy = R(p.y) - 14 - ((t * 40) % 82); c.fillStyle = "rgba(140,255,200,.55)"; c.fillRect(R(p.x) - 25, sy, 50, 2); c.globalCompositeOperation = "source-over"; }
  c.save(); c.beginPath(); c.rect(R(p.x) - 26, R(p.y) - 96, 52, 88); c.clip();
  c.drawImage(I.glass, R(p.x) - 26, R(p.y) - 96 - R(p.open * 84)); c.restore();
  c.drawImage(I.back, 10, 20, 64, 17, x0 + 10, top, 64, 17);     // tutup atas di depan kaca
  const lampOn = p.busy ? (Math.floor(t * 2) % 2 ? P.green : "#2a9a50") : P.cyan; c.fillStyle = P.ink; c.fillRect(R(p.x) - 3, top - 3, 6, 4); c.fillStyle = lampOn; c.fillRect(R(p.x) - 2, top - 2, 4, 2);
  c.drawImage(I.plate, R(p.x) - (I.plate.width >> 1), top - 16);
}
function drawPad(c, Pd, t) {
  c.drawImage(PADIMG, Pd.x - 50, Pd.y - 20);
  const k = Math.floor(t * 4) % 3;
  for (let i = 0; i < 3; i++) pxRing(c, Pd.x, Pd.y, 12 + i * 8, 4 + i * 3, i === k ? P.cyanL : P.cyan);
}
function drawBeam(c, Pd) {
  if (Pd.t <= 0) return; const a = Math.min(1, Pd.t) * .55;
  c.fillStyle = `rgba(88,232,255,${a * .5})`; c.fillRect(Pd.x - 26, Pd.y - 160, 52, 160);
  c.fillStyle = `rgba(220,252,255,${a})`; c.fillRect(Pd.x - 12, Pd.y - 160, 24, 160);
}
function render(t) {
  const c = ctx;
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = "#081634"; c.fillRect(0, 0, VW, VH);
  c.imageSmoothingEnabled = cam.s < 1;
  c.setTransform(cam.s, 0, 0, cam.s, offX(), offY());
  c.drawImage(GROUND, 0, 0);
  drawScreens(t); c.drawImage(SCRC, SCR.x, SCR.y);
  // denyut cahaya di strip lantai
  const u = (t * 120) % (MW - 2 * BAY); c.fillStyle = "#ffffff"; c.fillRect(BAY + R(u), DECK_Y + 14, 10, 3);
  const v = (t * 30) % 40; c.fillRect(CORE.x - 2, DECK_Y + 17 + R(v), 3, 6); const w = (t * 90) % (PODX1 - PODX0 - 10); c.fillRect(PODX0 + R(w), POD_Y + 34, 10, 3);
  for (let i = 0; i < 6; i++) { const a = t * .7 + i * Math.PI / 3; c.fillStyle = i % 2 ? P.cyanL : P.cyan; c.fillRect(R(CORE.x + Math.cos(a) * 136) - 1, R(CORE.y - 20 + Math.sin(a) * 72) - 1, 3, 3); }
  for (const Pd of PADS) drawPad(c, Pd, t);
  // y-sort semua objek + karakter
  const L = [];
  for (const k of CONSOLES) L.push({ y: DESK.y, f: () => drawConsole(k, t) });
  for (const p of Object.values(PODS)) { L.push({ y: p.y - 60, f: () => drawPod(c, p, t, "back") }); L.push({ y: p.y + .5, f: () => drawPod(c, p, t, "front") }); }
  SOFAS.forEach(s => { const im = IMG.prop_sofa; L.push({ y: s.y - 30, f: () => c.drawImage(im, s.x - (im.width >> 1), s.y - im.height + 6) });
    L.push({ y: s.y + .5, f: () => c.drawImage(im, 0, 36, im.width, im.height - 36, s.x - (im.width >> 1), s.y - im.height + 6 + 36, im.width, im.height - 36) }); });
  for (const [n, x, y] of PROPS_AT) { const im = IMG["prop_" + n]; L.push({ y, f: () => c.drawImage(im, x - (im.width >> 1), y - im.height) }); }
  L.push({ y: CORE.y, f: () => { const im = IMG.prop_core; c.drawImage(im, CORE.x - (im.width >> 1), CORE.y - im.height + 8);
    const k = .5 + .5 * Math.sin(t * 2.4); c.globalCompositeOperation = "lighter"; c.fillStyle = `rgba(80,200,255,${.10 + .12 * k})`; c.fillRect(CORE.x - 40, CORE.y - 132, 80, 92); c.globalCompositeOperation = "source-over"; } });
  for (const Pd of PADS) L.push({ y: Pd.y + 2, f: () => drawBeam(c, Pd) });
  const dy = R(Math.sin(t * 2) * 3); L.push({ y: DRONE.y, f: () => { c.drawImage(SHADOW, R(DRONE.x) - 18, R(DRONE.y) - 6); const im = IMG.prop_drone; c.drawImage(im, R(DRONE.x) - (im.width >> 1), R(DRONE.y) - 46 + dy); } });
  for (const g of AG) L.push({ y: g.sortY, f: () => drawAgent(c, g, t) });
  L.sort((a, b) => a.y - b.y); for (const it of L) it.f();
  // senja / malam: gelapkan, lalu "lubangi" dengan lampu markas
  if (SKY.dark > 0.01) {
    if (light.width !== VW || light.height !== VH) { light.width = VW; light.height = VH; }
    const l = lctx; l.setTransform(1, 0, 0, 1, 0, 0); l.globalCompositeOperation = "source-over"; l.clearRect(0, 0, VW, VH);
    l.fillStyle = SKY.tint ? `rgba(${R(SKY.tint[0] * .3)},${R(SKY.tint[1] * .22)},${R(SKY.tint[2] * .3 + 50)},${SKY.dark})` : `rgba(8,14,52,${SKY.dark})`;
    l.fillRect(0, 0, VW, VH); l.setTransform(cam.s, 0, 0, cam.s, offX(), offY()); l.globalCompositeOperation = "destination-out";
    for (const Lt of LIGHTS) { const r = Lt.r * (Lt.pulse ? 1 + .03 * Math.sin(t * 2.4) : 1), g = l.createRadialGradient(0, 0, 0, 0, 0, r);
      // 2 pita cahaya bertingkat (gaya 16-bit) -> lebih tenang daripada 3 cincin yang saling tumpuk
      g.addColorStop(0, `rgba(0,0,0,${Lt.a})`); g.addColorStop(.55, `rgba(0,0,0,${Lt.a})`); g.addColorStop(.551, `rgba(0,0,0,${Lt.a * .45})`);
      g.addColorStop(.99, `rgba(0,0,0,${Lt.a * .45})`); g.addColorStop(1, "rgba(0,0,0,0)");
      l.save(); l.translate(Lt.x, Lt.y); l.scale(1, Lt.k || .62); l.fillStyle = g; l.beginPath(); l.arc(0, 0, r, 0, Math.PI * 2); l.fill(); l.restore(); }
    c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(light, 0, 0);
    c.setTransform(cam.s, 0, 0, cam.s, offX(), offY()); c.globalCompositeOperation = "lighter";
    for (const Lt of LIGHTS) if (Lt.glow && !Lt.k) { const r = Lt.r * .55, g = c.createRadialGradient(Lt.x, Lt.y, 0, Lt.x, Lt.y, r);
      g.addColorStop(0, `rgba(${Lt.glow},${.11 * SKY.dark / .5})`); g.addColorStop(1, `rgba(${Lt.glow},0)`); c.fillStyle = g; c.fillRect(Lt.x - r, Lt.y - r, r * 2, r * 2); }
    c.globalCompositeOperation = "source-over";
  }
}
function buildLights() {
  // malam yang kalem: sedikit kolam cahaya besar (elips pipih per zona) daripada banyak lingkaran yang saling tumpuk
  LIGHTS.length = 0;
  LIGHTS.push({ x: CORE.x, y: CORE.y - 50, r: 250, a: .9, glow: "80,200,255", pulse: true });          // inti energi + sofa
  LIGHTS.push({ x: CX, y: DESK.top - 10, r: 560, k: .3, a: .85, glow: "90,180,255" });                // deretan konsol + layar
  LIGHTS.push({ x: CX, y: POD_Y - 50, r: 470, k: .2, a: .8, glow: "120,230,255" });                   // teluk kapsul
  LIGHTS.push({ x: CX, y: SCR.y + 52, r: 340, k: .28, a: .8 });                                       // layar besar di dinding
  for (const Pd of PADS) LIGHTS.push({ x: Pd.x, y: Pd.y - 10, r: 92, a: .75, glow: "88,232,255" });
  for (const [n, x, y] of PROPS_AT) if (n === "vending") LIGHTS.push({ x, y: y - 36, r: 64, a: .55 }); else if (n === "lamp") LIGHTS.push({ x, y: y - 56, r: 46, a: .6, glow: "120,220,255" });
}
/* ---------------- label DOM ---------------- */
function placeLabels() {
  const zz = cam.s / DPR, far = zz < .9, k = zz < .8 ? .72 : zz < 1.5 ? 1 : 1.25;   // label ikut skala zoom
  for (const g of AG) {
    const u = g.fx ? g.fx.t / g.fx.dur : 0, kin = g.k ? .75 : .72, hid = (g.hidden && !g.fx) || (g.fx && (g.fx.kind === "def" ? u > .3 : g.fx.kind === "out" ? u > (g.k ? .05 : .2) : u < kin));
    const p = worldToScreen(g.x, g.pose === "charge" ? g.pod.y - 134 : g.headY() - 3);
    g.el.style.transform = `translate(${Math.round(p.x)}px,${Math.round(p.y)}px) translate(-50%,-100%) scale(${k})`;
    g.el.style.opacity = hid ? 0 : 1;
    g.el.classList.toggle("far", far);
  }
}

/* ---------------- status ---------------- */
let LIVE = null, SUMS = null, ERR = null;
function demoStatus() {
  const now = Date.now(), h = 3600000;
  const m = { nerd: ["Online", now - 3 * MIN, "Bikin markas Robot HQ versi 16-bit"], kurir: ["On mission", now - 40 * MIN, "Ngumpulin lowongan frontend"], sisotoy: ["Standby", now - 5 * h, ""], alcapone: ["Online", now - 8 * MIN, "Review rencana minggu ini"], kuku: ["Standby", now - 20 * h, ""], makelar: ["Offline", null, ""], jack: ["Standby", null, ""] };
  const agents = {}; for (const [k, [status, lastActive, summary]] of Object.entries(m)) agents[k] = { status, lastActive, summary };
  return { generatedAt: now, agents };
}
function classify(a) {
  const r = LIVE && LIVE.agents && typeof LIVE.agents === "object" ? LIVE.agents[a.id] : null;
  const raw = r && typeof r === "object" ? r : {};
  const la = typeof raw.lastActive === "number" && raw.lastActive > 0 ? raw.lastActive : null;
  const sm = SUMS && raw.id && SUMS[raw.id] && typeof SUMS[raw.id] === "object" ? SUMS[raw.id] : null;
  const summary = (typeof raw.summary === "string" && raw.summary) || (sm && typeof sm.summary === "string" ? sm.summary : "");
  const st = typeof raw.status === "string" ? raw.status : "";
  let mode, label; const age = la ? (Date.now() - la) / MIN : null;
  if (/offline/i.test(st)) { mode = "sleep"; label = "Offline"; }
  else if ((sm && sm.working === true) || (age !== null && age < 15)) { mode = "work"; label = "Online"; }
  else if (age !== null && age < 120) { mode = "work"; label = "On mission"; }
  else if (age === null && /online|mission|working|busy/i.test(st)) { mode = "work"; label = st; }
  else if (age === null) { mode = "sleep"; label = "Belum ada aktivitas"; }
  else if (age > SLEEP_AFTER_H * 60) { mode = "sleep"; label = "Standby · lama nggak aktif"; }
  else { mode = "idle"; label = "Standby"; }
  return { mode, label, lastActive: la, summary, raw: st, found: !!r };
}
async function fetchJSON(u) { const res = await fetch(u + "?t=" + Date.now(), { cache: "no-store" }); if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); }
async function fetchStatus() {
  if (DATA_BASE !== null) return fetchJSON(DATA_BASE + "status.json");
  let err;
  for (const b of ["", "../"]) { try { const j = await fetchJSON(b + "status.json"); DATA_BASE = b; homeLink(); return j; } catch (e) { err = e; } }
  throw err;
}
function homeLink() { document.querySelectorAll("a.back").forEach(a => a.hidden = IS_ROOT()); }
async function loadStatus(first) {
  if (DEMO) { LIVE = demoStatus(); ERR = null; }
  else {
    try { const j = await fetchStatus(); if (!j || typeof j !== "object" || typeof j.agents !== "object") throw new Error("format salah"); LIVE = j; ERR = null; }
    catch (e) { ERR = e instanceof SyntaxError ? "JSON rusak" : (e.message || "gagal"); }
    try { SUMS = await fetchJSON((DATA_BASE || "") + "summaries.json"); } catch (e) { }
  }
  applyStatus(first);
}
function applyStatus(first) {
  for (const g of AG) { g.info = classify(g.a); g.setMode(g.info.mode, first); g.dot.className = "dot " + modeCls(g.info.mode); if (g.info.mode !== "sleep" && g.bub.classList.contains("chg")) g.quiet(); }
  renderHud(); renderParty(); if (SEL) renderInfo(SEL);
}
const modeCls = m => m === "work" ? "s-work" : m === "sleep" ? "s-sleep" : "s-idle";
const modeTxt = m => m === "work" ? "kerja" : m === "sleep" ? "ngecas (tidur)" : "santai";
const skyTxt = k => ({ day: "siang", dusk: "sore", dawn: "subuh", night: "malam" })[k] || k;
function renderHud() {
  const c = { work: 0, idle: 0, sleep: 0 }; AG.forEach(a => c[a.info.mode]++);
  $("stats").innerHTML = `<span class="chip">Kru <b>${AG.length}</b></span><span class="chip">Kerja <b>${c.work}</b></span><span class="chip">Standby <b>${c.idle}</b></span><span class="chip">Ngecas <b>${c.sleep}</b></span>`;
  const el = $("sync");
  if (DEMO) { el.className = "sync warn"; el.innerHTML = 'Mode demo (status contoh) · <a href="./">pakai data asli</a> · ' + skyTxt(SKY.k); return; }
  if (!LIVE) { el.className = "sync bad"; el.textContent = "Status nggak kebaca (" + (ERR || "memuat") + ")"; return; }
  const gen = typeof LIVE.generatedAt === "number" ? LIVE.generatedAt : null, stale = gen && (Date.now() - gen) / MIN > 90;
  el.className = "sync " + (stale ? "warn" : "ok");
  el.textContent = (gen ? "Sync: " + wib(gen) + " (" + relTime(gen) + ")" : "Sync: waktu nggak diketahui") + (ERR ? " · refresh gagal" : "") + " · " + skyTxt(SKY.k);
}
const portrait = id => `assets/sprites/${id}_portrait.png`;
function renderParty() {
  $("pcount").textContent = "(" + AG.length + ")";
  $("party").innerHTML = AG.map((g, i) => `<li tabindex="0" data-i="${i}" class="${g === SEL ? "sel" : ""}"><div class="av"><img src="${portrait(g.id)}" alt=""></div><div class="pn" style="color:${g.a.accent}">${esc(g.a.name)}<div class="st"><i class="dot ${modeCls(g.info.mode)}"></i>${esc(modeTxt(g.info.mode))}</div></div></li>`).join("");
}
$("party").addEventListener("click", e => { const li = e.target.closest("li"); if (li) select(AG[+li.dataset.i]); });
$("party").addEventListener("keydown", e => { const li = e.target.closest("li"); if (li && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); select(AG[+li.dataset.i]); } });
$("partyToggle").addEventListener("click", () => { const w = $("partyWin"); const c = w.classList.toggle("collapsed"); $("partyToggle").textContent = c ? "+" : "–"; $("partyToggle").setAttribute("aria-expanded", String(!c)); });
if (MOBILE || innerHeight < 900) $("partyToggle").click();   // layar laptop: party dilipat biar peta utuh kelihatan

/* ---------------- panel info ---------------- */
function locTxt(g) { const k = g.task; if (g.hidden) return "Lagi teleport…"; if (k && k.walk) return "Jalan ke " + (k.where || g.where).toLowerCase(); return g.where; }
function renderInfo(g) {
  const I = g.info, a = g.a;
  const box = $("info"); box.style.setProperty("--a", a.accent);
  $("infoBody").innerHTML = `<div class="head"><div class="pt"><img src="${portrait(a.id)}" alt="Potret ${esc(a.name)}"></div>
    <div><h2 id="infoName">${esc(a.name)}</h2><div class="ttl">${esc(a.title)}</div><span class="pill ${modeCls(I.mode)}">${esc(I.label)} · ${esc(modeTxt(I.mode))}</span></div></div>
    <div class="rows">
      <div class="r"><span class="k">AKTIF</span><span>${I.lastActive ? esc(relTime(I.lastActive)) + " · " + esc(wib(I.lastActive)) : "belum ada data"}</span></div>
      <div class="r"><span class="k">TUGAS</span><span>${I.summary ? esc(I.summary) : "belum ada ringkasan"}</span></div>
      <div class="r"><span class="k">LOKASI</span><span>${esc(locTxt(g))}</span></div>
      ${I.raw ? `<div class="r"><span class="k">STATUS</span><span>${esc(I.raw)} (status.json)</span></div>` : ""}
      <div class="r"><span class="k">GAYA</span><span>${esc(LOOKS[a.id] || "")}</span></div>
    </div>
    <div class="hint">${DEMO ? "Mode demo: status contoh, bukan data asli." : "Data dari status.json, dicek tiap 60 detik."} Klik karakternya buat nyapa.</div>`;
}
function select(g) {
  if (SEL && SEL !== g) SEL.el.classList.remove("sel");
  SEL = g; g.el.classList.add("sel"); FOLLOW = true;
  renderInfo(g); $("info").hidden = false; renderParty(); g.react();
}
function deselect() { if (!SEL) return; SEL.el.classList.remove("sel"); SEL = null; FOLLOW = false; $("info").hidden = true; renderParty(); }
$("infoClose").addEventListener("click", deselect);
addEventListener("keydown", e => {
  if (e.key === "Escape") deselect();
  if (e.key === "+" || e.key === "=") stepZoom(1); if (e.key === "-") stepZoom(-1);
  const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (k && !e.target.closest("li")) { FOLLOW = false; cam.x += k[0] * 96; cam.y += k[1] * 96; clampCam(); }
});
setInterval(() => { if (SEL) renderInfo(SEL); }, 5000);

/* ---------------- input: pan, pinch, wheel, klik ---------------- */
const ptrs = new Map(); let drag = null, pinch = null, downAt = null;
function hit(cx, cy) {
  const w = screenToWorld(cx, cy); let best = null, by = -1;
  for (const g of AG) { if (g.hidden) continue; const b = g.box(); if (w.x >= b.x0 && w.x <= b.x1 && w.y >= b.y0 && w.y <= b.y1 && g.y > by) { by = g.y; best = g; } }
  return best;
}
canvas.addEventListener("pointerdown", e => {
  canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (ptrs.size === 1) { drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y }; downAt = [e.clientX, e.clientY]; }
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: cam.z }; drag = null; downAt = null; }
});
canvas.addEventListener("pointermove", e => {
  if (!ptrs.has(e.pointerId)) { canvas.classList.toggle("hover", !!hit(e.clientX, e.clientY)); return; }
  ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (pinch && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), r = d / pinch.d;
    const target = pinch.z * r; let best = cam.z;
    for (const z of zoomList()) if (Math.abs(Math.log(z / target)) < Math.abs(Math.log(best / target)) - .15) best = z;
    if (best !== cam.z) setZoom(best, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  } else if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.hypot(dx, dy) > 4) FOLLOW = false;
    if (!FOLLOW) { cam.x = drag.cx - dx * DPR / cam.s; cam.y = drag.cy - dy * DPR / cam.s; clampCam(); }
  }
});
function endPtr(e) {
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinch = null;
  if (ptrs.size === 0) {
    if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 6) { const g = hit(e.clientX, e.clientY); if (g) select(g); else if (SEL && !MOBILE) deselect(); }
    drag = null; downAt = null;
  } else if (ptrs.size === 1) { const [p] = [...ptrs.values()]; drag = { x: p[0], y: p[1], cx: cam.x, cy: cam.y }; }
}
canvas.addEventListener("pointerup", endPtr); canvas.addEventListener("pointercancel", endPtr);
let wheelLock = 0;
canvas.addEventListener("wheel", e => { e.preventDefault(); const now = performance.now(); if (now - wheelLock < 180) return; wheelLock = now; stepZoom(e.deltaY < 0 ? 1 : -1, e.clientX, e.clientY); }, { passive: false });
$("zoomIn").addEventListener("click", () => stepZoom(1));
$("zoomOut").addEventListener("click", () => stepZoom(-1));
$("zoomLbl").addEventListener("click", () => setZoom(cam.fitZ, null, null, true));
$("homeBtn").addEventListener("click", () => { FOLLOW = false; deselect(); cam.x = HOME.x; cam.y = HOME.y; setZoom(cam.fitZ, null, null, true); });
addEventListener("resize", resize);

/* ---------------- loop ---------------- */
let last = performance.now(), T0 = last, TT = 0, PAUSE = false;
function tick(dt) {
  TT += dt;
  for (const g of AG) g.update(dt);
  for (const p of Object.values(PODS)) p.open += (p.want - p.open) * Math.min(1, dt * 6);
  for (const Pd of PADS) Pd.t = Math.max(0, Pd.t - dt);
  const a = TT * .25; DRONE.x = CX + Math.cos(a) * 380; DRONE.y = 420 + Math.sin(a * 2) * 36 + (Math.cos(a) > 0 ? 0 : 0);
  if (FOLLOW && SEL) { cam.x += (SEL.x - cam.x) * Math.min(1, dt * 5); cam.y += (SEL.y - 40 - cam.y) * Math.min(1, dt * 5); clampCam(); }
}
function frame(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  if (!PAUSE) tick(dt);
  render(TT); placeLabels();
  requestAnimationFrame(frame);
}

/* ---------------- musik latar (loop, volume 0.4, pilihan disimpan di localStorage) ----------------
   Coba autoplay saat load; kalau diblokir browser, mulai di klik/tap/tombol pertama di mana saja. */
const MUSIC_KEY = "vmx-music", BGM = new Audio("assets/audio/hq-theme.mp3");
BGM.loop = true; BGM.volume = .4; BGM.preload = "auto";
let musicOn = (() => { try { return localStorage.getItem(MUSIC_KEY) !== "off"; } catch (e) { return true; } })();
function musicUI() {
  const b = $("muteBtn"), playing = !BGM.paused;
  b.classList.toggle("muted", !musicOn); b.classList.toggle("wait", musicOn && !playing);
  b.setAttribute("aria-pressed", String(musicOn)); b.title = !musicOn ? "Musik mati (klik buat nyalain)" : playing ? "Musik nyala (klik buat matiin)" : "Musik nunggu klik/tap pertama";
}
function playMusic() { if (!musicOn) return; BGM.play().then(musicUI, () => { musicUI(); armUnlock(); }); }
function armUnlock() {
  const go = e => { if (e && e.target && e.target.closest && e.target.closest("#muteBtn")) return;   // tombol musik punya logikanya sendiri
    for (const ev of ["pointerdown", "keydown", "touchstart"]) removeEventListener(ev, go, true); playMusic(); };
  for (const ev of ["pointerdown", "keydown", "touchstart"]) addEventListener(ev, go, true);
}
$("muteBtn").addEventListener("click", () => {
  if (musicOn && BGM.paused) { playMusic(); return; }                       // masih diblokir -> klik ini = izin putar
  musicOn = !musicOn; try { localStorage.setItem(MUSIC_KEY, musicOn ? "on" : "off"); } catch (e) {}
  if (musicOn) playMusic(); else { BGM.pause(); musicUI(); }
});
document.addEventListener("visibilitychange", () => { if (document.hidden) BGM.pause(); else if (musicOn) playMusic(); });
BGM.addEventListener("play", musicUI); BGM.addEventListener("pause", musicUI);
musicUI(); playMusic();

(async function start() {
  try {
    const meta = await (await fetch("assets/sprites/sprites.json")).json(); meta.frames.forEach((n, i) => FR[n] = i);
    PROPSZ = await (await fetch("assets/props/props.json")).json();
    try {   // KAIRO pilot: opsional, kalau gagal semua agent tetap pakai frame lama
      const km = await (await fetch("assets/sprites/kairo.json")).json();
      for (const [id, k] of Object.entries(km.agents || {})) { IMG["k_" + id] = await loadImg("assets/sprites/" + k.sheet); KAIRO[id] = k; }
    } catch (e) { console.warn("kairo.json:", e.message); }
    await Promise.all([
      ...AGENTS.map(async a => { IMG["spr_" + a.id] = await loadImg("assets/sprites/" + a.id + ".png"); }),
      ...Object.keys(PROPSZ).map(async n => { IMG["prop_" + n] = await loadImg("assets/props/" + n + ".png"); }),
      document.fonts.load('8px "PS2P"'), document.fonts.load('16px "PS2P"')]);
  } catch (e) { showErr("Aset markas gagal dimuat: " + esc(e.message) + (IS_ROOT() ? "" : '<br><a href="../">Balik ke dashboard</a>')); return; }
  homeLink();
  // siluet putih (teleport) + baris teratas tiap frame (posisi label)
  for (const a of AGENTS) {
    const im = IMG["spr_" + a.id], [w, wx] = mk(im.width, im.height); wx.drawImage(im, 0, 0); const d = wx.getImageData(0, 0, im.width, im.height).data;
    TOPS[a.id] = []; for (let f = 0; f < im.width / CW; f++) { let top = 0; scan: for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (d[(y * im.width + f * CW + x) * 4 + 3] > 0) { top = y; break scan; } TOPS[a.id].push(top); }
    wx.globalCompositeOperation = "source-in"; wx.fillStyle = "#ffffff"; wx.fillRect(0, 0, im.width, im.height); IMG["wht_" + a.id] = w;
  }
  for (const id of Object.keys(KAIRO)) {
    const im = IMG["k_" + id], [, kx] = mk(im.width, im.height); kx.drawImage(im, 0, 0); const d = kx.getImageData(0, 0, im.width, im.height).data;
    KTOPS[id] = []; for (let f = 0; f < im.width / CW; f++) { let top = 0; scan: for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (d[(y * im.width + f * CW + x) * 4 + 3] > 0) { top = y; break scan; } KTOPS[id].push(top); }
  }
  // tombol ANIM: NEW/OLD (cuma muncul kalau sheet KAIRO berhasil dimuat)
  const ab = $("animBtn"), animUI = () => { ab.textContent = "ANIM:" + (ANIM_NEW ? "NEW" : "OLD"); ab.classList.toggle("old", !ANIM_NEW); ab.setAttribute("aria-pressed", String(ANIM_NEW)); };
  if (Object.keys(KAIRO).length) { ab.hidden = false; animUI(); }
  ab.addEventListener("click", () => { ANIM_NEW = !ANIM_NEW; try { localStorage.setItem(ANIM_KEY, ANIM_NEW ? "new" : "old"); } catch (e) {} animUI(); });
  buildGrid(); buildObjects(); paintGround(); buildLights();
  resize(); cam.z = zoomInit(); applyZoom();
  if (MOBILE && cam.auto) { cam.x = HOME.x; cam.y = HOME.y - 20; clampCam(); }
  AG = AGENTS.map((a, i) => new Agent(a, i));
  AG.forEach(g => g.info = classify(g.a));
  await loadStatus(true);
  setInterval(() => loadStatus(false), POLL_MS);
  setInterval(() => { const s = sky(); if (s.k !== SKY.k || Math.abs(s.dark - SKY.dark) > .02) { SKY = s; paintGround(); renderHud(); } }, 60000);
  window.VMX = { AG, cam, KAIRO, get animNew() { return ANIM_NEW; }, setZoom, select, deselect, PODS, PADS, get SKY() { return SKY; }, get music() { return { on: musicOn, playing: !BGM.paused, t: BGM.currentTime, vol: BGM.volume, loop: BGM.loop }; },
    step(n = 1, dt = 1 / 30) { for (let i = 0; i < n; i++) tick(dt); render(TT); placeLabels(); },
    pause(v = true) { PAUSE = v; }, view(x, y, z) { FOLLOW = false; if (z) setZoom(z); cam.x = x; cam.y = y; clampCam(); } };
  requestAnimationFrame(t => { last = t; frame(t); });
  document.body.dataset.ready = "1";
})();
