/* NEO HQ · Mission Control versi kota mini isometrik.
   Kota cyberpunk chibi di atas alas diorama: markas Hunter Base (Command Desk, Holo Table, server, kapsul charge),
   teleportation chamber di markas, meja holo di plaza, gedung neon, mobil terbang, drone, hujan, dan maskot BIP yang patroli di dalam markas.
   Semua gedung/prop digambar prosedural di canvas 2D; kru pakai sheet assets/sprites/<id>_kairo.png (kairo.json), diperkecil 50%.
   Status dari status.json (+ summaries.json), dicek tiap 60 detik, lokasi lewat <meta name="vmx-data"> seperti versi lama.
     kerja  -> ke Command Desk / Holo Table di markas
     santai -> keliling kota, nongkrong di plaza, atau teleport pulang ke chamber dari mana saja
     tidur  -> masuk kapsul charge
   URL: ?demo=1 status contoh. Versi lama (top-down) ada di classic.html. */

import { AGENTS, LOOKS } from "./agents.js";
import { initDialog, openDialog, closeDialog, dialogOpen, statusLine } from "./dialog-ui.js";

const TW = 64, TH = 32, MW = 17, MH = 14;
const P = (x, y, z = 0) => [(x - y) * TW / 2, (x + y) * TH / 2 - z];
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
let g; // current 2d context
let t = 0;
/* selalu malam; ?time=day|dusk|dawn buat lihat suasana lain */
const TIME_Q = new URLSearchParams(location.search).get("time");
const PHASES = {
  day:   { k: "day",   label: "siang", neon: 0.35, lit: 0.8,  sky: ["#6f93f0", "#b4c0ff", "#ffd6ec"], city: ["#8d98dc", "#a4aeea"], stars: 0,   wash: "rgba(175,195,255,.28)", body: "sun" },
  dusk:  { k: "dusk",  label: "senja", neon: 0.8,  lit: 0.55, sky: ["#24175a", "#9c3f88", "#ff9a6a"], city: ["#3a2060", "#4e2a74"], stars: 0.2, wash: "rgba(255,130,90,.14)", body: "sun" },
  dawn:  { k: "dawn",  label: "subuh", neon: 0.6,  lit: 0.62, sky: ["#1c2a6a", "#7466bc", "#ffc4a0"], city: ["#2a2a6a", "#3a3a80"], stars: 0.35, wash: "rgba(200,180,255,.16)", body: "moon" },
  night: { k: "night", label: "malam", neon: 1,    lit: 0.42, sky: ["#07051a", "#170d3a", "#2a0f45"], city: ["#120a30", "#1a1040"], stars: 1,   wash: null, body: "moon" },
};
const SKY = PHASES[TIME_Q] || PHASES.night;
const hash = (a, b = 0, c = 0) => { const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return s - Math.floor(s); };
const flick = (seed, rate = 0.04) => (hash(seed, Math.floor(t * 9)) < rate ? 0.25 : 1);


/* ---------- map ---------- */
const R = (x0, y0, x1, y1) => ({ x0, y0, x1, y1 });
const inR = (r, x, y) => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1;
const HQ = R(0, 0, 10, 8), PLAZA = R(12, 10, 17, 14), PARK = R(5, 10, 10, 14);
function ground(x, y) {
  if (inR(HQ, x, y)) return "H";
  if (y === 8 || y === 9 || x === 10 || x === 11) return "S";
  if (inR(PLAZA, x, y)) return "P";
  if (inR(PARK, x, y)) return "G";
  return "W";
}
const blocked = Array.from({ length: MH }, () => new Uint8Array(MW));
const block = (r) => { for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) if (x >= 0 && y >= 0 && x < MW && y < MH) blocked[y][x] = 1; };
const statics = [];

const BUILD = [
  { k: "tier", x0: 1, y0: 11, x1: 4, y1: 14, h: 150, c: ["#3a3072", "#2a2357", "#1d1842"], store: "#ff3ea5", win: "grid",
    tiers: [[0.45, 96, "band"], [0.9, 74, "tall"]], spire: 1, balcony: 1, awning: "#ff3ea5", ac: 1,
    signs: [{ k: "v", text: "HOTEL", col: "#ff3ea5", u: 0.5, v: 140 }, { k: "h", f: "R", text: "NEO INN", col: "#35f2ff", u: 1.5, v: 120, s: 10 }] },
  { k: "round", x0: 15, y0: 0, x1: 17, y1: 2, h: 300, r: 0.9, store: "#35f2ff" },
  { k: "shop", x0: 12, y0: 2, x1: 15, y1: 5, h: 74, c: ["#3b2c62", "#2b2050", "#1e1640"], store: "#ffb547", win: "grid", awning: "#ffb547", lights: 1, garden: 1, ac: 1, board: "KUKU TV",
    signs: [{ k: "h", f: "L", text: "KOPI", col: "#ffb547", u: 1.5, v: 64, s: 12 }, { k: "h", f: "R", text: "BUKA 24J", col: "#35f2ff", u: 1.5, v: 60, s: 7 }] },
];

function poly(pts, fill) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.fillStyle = fill; g.fill(); }
function box(x0, y0, x1, y1, z0, h, top, left, right, edge) {
  poly([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z0 + h), P(x0, y1, z0 + h)], left);
  poly([P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z0 + h), P(x1, y0, z0 + h)], right);
  poly([P(x0, y0, z0 + h), P(x1, y0, z0 + h), P(x1, y1, z0 + h), P(x0, y1, z0 + h)], top);
  if (edge) {
    g.strokeStyle = edge; g.lineWidth = 1; g.beginPath();
    const a = P(x0, y1, z0 + h), b = P(x1, y1, z0 + h), c = P(x1, y0, z0 + h), d = P(x1, y1, z0);
    g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.moveTo(b[0], b[1]); g.lineTo(d[0], d[1]); g.stroke();
  }
}
// draw in a wall's own plane: L = face at y=y1 running +x, R = face at x=x1 running from front corner toward y0
function face(b, f, u, v, fn) {
  const z = v + (b.z0 || 0);
  g.save();
  if (f === "L") { const o = P(b.x0, b.y1); g.transform(1, 0.5, 0, 1, o[0] + u * 32, o[1] + u * 16 - z); }
  else { const o = P(b.x1, b.y1); g.transform(1, -0.5, 0, 1, o[0] + u * 32, o[1] - u * 16 - z); }
  fn(); g.restore();
}
function glow(x, y, rx, ry, col, a) {
  g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = Math.min(1, a * SKY.neon);
  g.translate(x, y); g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx); gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill(); g.restore();
}
function neonText(text, x, y, col, size, a = 1, align = "center") {
  g.save(); g.globalAlpha = a; g.font = `${size}px "PS2P"`; g.textAlign = align; g.textBaseline = "middle";
  g.shadowColor = col; g.shadowBlur = 10 * SKY.neon; g.fillStyle = col; g.fillText(text, x, y);
  g.shadowBlur = 0; g.globalAlpha = a * 0.85; g.fillStyle = "#fff"; g.fillText(text, x, y - 0.5); g.restore();
}
const winCol = (k) => (k > 0.86 ? "rgba(255,110,200,.85)" : k > 0.66 ? "rgba(255,196,107,.85)" : "rgba(111,246,255,.75)");
function windows(b, f, seed, style = "grid", v0 = 56) {
  const len = f === "L" ? b.x1 - b.x0 : b.y1 - b.y0, top = b.h - 12;
  if (style === "band") {
    for (let v = v0 + 14, j = 0; v < top; v += 22, j++) face(b, f, 0, v, () => {
      const w = len * 32;
      g.fillStyle = "#120e28"; g.fillRect(4, -12, w - 8, 12);
      for (let x = 6, i = 0; x < w - 8; x += 10, i++) { const k = hash(seed, i, j); if (k > SKY.lit - 0.07) { g.fillStyle = winCol(k); g.fillRect(x, -11, 8, 10); } }
      g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(4, -12, w - 8, 1);
    });
    return;
  }
  if (style === "tall") {
    face(b, f, 0, v0 > 50 ? 10 : v0, () => {
      const w = len * 32, hh = top - (v0 > 50 ? 10 : v0);
      for (let x = 6, i = 0; x < w - 8; x += 12, i++) {
        const k = hash(seed, i);
        const gr = g.createLinearGradient(0, -hh, 0, 0); gr.addColorStop(0, k > 0.6 ? "rgba(255,110,200,.7)" : "rgba(111,246,255,.6)"); gr.addColorStop(1, "rgba(30,20,70,.2)");
        g.fillStyle = gr; g.fillRect(x, -hh, 5, hh - 4);
      }
    });
    return;
  }
  for (let v = v0 + 12; v < top; v += 22) for (let u = 0.12, i = 0; u + 0.3 < len; u += 0.42, i++) {
    const k = hash(seed, i, v);
    let col = "#120e28";
    if (k > SKY.lit) col = winCol(k);
    if (k > SKY.lit && hash(seed + 9, i, v) > 0.94 && Math.sin(t * 0.7 + k * 40) > 0.6) col = "#120e28";
    face(b, f, u, v, () => { g.fillStyle = col; g.fillRect(0, -11, 12, 11); g.fillStyle = "rgba(255,255,255,.08)"; g.fillRect(0, -11, 12, 2); });
  }
}
function storefront(b, i) {
  face(b, "L", 0, 0, () => {
    const w = (b.x1 - b.x0) * 32;
    g.fillStyle = "#0d0a22"; g.fillRect(4, -44, w - 8, 42);
    g.globalAlpha = 0.32 + 0.1 * Math.sin(t * 2 + i); g.fillStyle = b.store; g.fillRect(6, -42, w - 12, 38); g.globalAlpha = 1;
    g.fillStyle = "rgba(7,5,26,.55)"; for (let x = 6; x < w - 8; x += 18) g.fillRect(x, -42, 2, 38);
    g.fillStyle = b.store; g.fillRect(2, -48, w - 4, 3);
    g.fillStyle = "#07051a"; g.fillRect(w / 2 - 8, -34, 16, 34);
    g.fillStyle = b.store; g.globalAlpha = 0.6; g.fillRect(w / 2 - 8, -35, 16, 1); g.globalAlpha = 1;
  });
  const gl = P((b.x0 + b.x1) / 2, b.y1 + 0.6); glow(gl[0], gl[1], 70, 22, b.store, 0.14);
}
function awning(b, col) {
  const n = Math.round((b.x1 - b.x0 - 0.2) / 0.25);
  for (let k = 0; k < n; k++) {
    const u0 = b.x0 + 0.1 + k * 0.25, u1 = u0 + 0.25;
    poly([P(u0, b.y1, 52), P(u1, b.y1, 52), P(u1, b.y1 + 0.34, 42), P(u0, b.y1 + 0.34, 42)], k % 2 ? col : "#1c1440");
  }
  const a = P(b.x0 + 0.1, b.y1 + 0.34, 42), c = P(b.x1 - 0.1, b.y1 + 0.34, 42);
  g.save(); g.shadowColor = col; g.shadowBlur = 8; g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.moveTo(...a); g.lineTo(...c); g.stroke(); g.restore();
}
function balconies(b, seed) {
  for (let v = 78; v < b.h - 20; v += 44) for (let u = 0.4; u + 0.6 < b.x1 - b.x0; u += 1.4) {
    const x = b.x0 + u;
    box(x, b.y1, x + 0.6, b.y1 + 0.16, v, 3, "#8a83c8", "#5b51a8", "#3a3480");
    g.strokeStyle = "rgba(53,242,255,.7)"; g.lineWidth = 1; g.beginPath(); g.moveTo(...P(x, b.y1 + 0.16, v + 10)); g.lineTo(...P(x + 0.6, b.y1 + 0.16, v + 10)); g.stroke();
    if (hash(seed, u, v) > 0.6) { const p = P(x + 0.3, b.y1 + 0.1, v + 4); g.fillStyle = "#c24bd6"; g.beginPath(); g.arc(p[0], p[1] - 4, 4, 0, 7); g.fill(); }
  }
}
function wallAC(b, seed) {
  for (let v = 70; v < b.h - 20; v += 44) {
    const u = 0.3 + hash(seed, v) * (b.y1 - b.y0 - 0.8), y = b.y1 - u;
    box(b.x1, y - 0.28, b.x1 + 0.12, y, v, 10, "#6a64a8", "#4a4490", "#38327a");
    const f = P(b.x1 + 0.12, y - 0.14, v + 5); g.strokeStyle = "#221d4a"; g.beginPath(); g.arc(f[0], f[1], 3, 0, 7); g.stroke();
  }
}
function cornerStrip(b, col, z0 = 50) {
  const a = P(b.x1, b.y1, (b.z0 || 0) + z0), c = P(b.x1, b.y1, (b.z0 || 0) + b.h - 4);
  g.save(); g.strokeStyle = col; g.lineWidth = 2; g.shadowColor = col; g.shadowBlur = 8;
  g.setLineDash([6, 8]); g.lineDashOffset = -t * 40; g.beginPath(); g.moveTo(...a); g.lineTo(...c); g.stroke(); g.restore();
}
function cyl(cx, cy, r, z0, h, cols, edge) {
  const c = P(cx, cy, z0), rx = r * 45.25, ry = r * 22.63;
  const gr = g.createLinearGradient(c[0] - rx, 0, c[0] + rx, 0);
  gr.addColorStop(0, cols[2]); gr.addColorStop(0.55, cols[1]); gr.addColorStop(1, cols[2]);
  g.fillStyle = gr; g.beginPath(); g.ellipse(c[0], c[1], rx, ry, 0, 0, Math.PI); g.lineTo(c[0] - rx, c[1] - h); g.ellipse(c[0], c[1] - h, rx, ry, 0, Math.PI, 0, true); g.closePath(); g.fill();
  g.fillStyle = cols[0]; g.beginPath(); g.ellipse(c[0], c[1] - h, rx, ry, 0, 0, Math.PI * 2); g.fill();
  if (edge) { g.strokeStyle = edge; g.lineWidth = 1; g.beginPath(); g.ellipse(c[0], c[1] - h, rx, ry, 0, 0, Math.PI * 2); g.stroke(); }
  return { c, rx, ry };
}
function vSign(x, y, text, col, idx, lift = 0) {
  const hgt = text.length * 14 + 8, a = flick(idx * 3.3);
  g.fillStyle = "#0b0720"; g.fillRect(x - 9, y, 18, hgt);
  g.save(); g.globalAlpha = a; g.shadowColor = col; g.shadowBlur = 10; g.strokeStyle = col; g.lineWidth = 2; g.strokeRect(x - 9, y, 18, hgt); g.restore();
  [...text].forEach((ch, i) => neonText(ch, x, y + 11 + i * 14, col, 10, a));
  glow(x, y + hgt + lift, 60, 20, col, 0.16 * a);
}
function hSign(b, s, idx) {
  const a = flick(idx + 0.7);
  face(b, s.f, s.u, s.v, () => {
    g.font = `${s.s}px "PS2P"`; const w = g.measureText(s.text).width + 14;
    g.fillStyle = "rgba(7,5,26,.85)"; g.fillRect(-w / 2, -s.s / 2 - 5, w, s.s + 10);
    neonText(s.text, 0, 0, s.col, s.s, a);
  });
  const sx = s.f === "L" ? P(b.x0 + s.u, b.y1 + 1) : P(b.x1 + 1, b.y1 - s.u);
  glow(sx[0], sx[1], 70, 22, s.col, 0.15 * a);
}
function signs(b, i) {
  for (const [k, s] of (b.signs || []).entries()) {
    if (s.k === "v") { const p = P(b.x0 + s.u, b.y1, s.v); vSign(p[0] - 8, p[1] + 6, s.text, s.col, i * 5 + k, s.v); }
    else hSign(b, s, i * 5 + k);
  }
}
function roofBits(b, i) {
  const z = (b.z0 || 0) + b.h;
  box(b.x0 + 0.3, b.y0 + 0.3, b.x0 + 0.9, b.y0 + 0.8, z, 9, "#4a4290", "#2d2860", "#221d4a");
  if (b.tank) { cyl(b.x1 - 0.7, b.y0 + 0.8, 0.3, z, 4, ["#5b51a8", "#3a3480", "#221d4a"]); cyl(b.x1 - 0.7, b.y0 + 0.8, 0.26, z + 4, 22, ["#8a83c8", "#5b51a8", "#2d2860"], "#35f2ff"); }
  if (b.garden) {
    box(b.x0 + 1.4, b.y0 + 0.6, b.x1 - 0.4, b.y1 - 0.8, z, 5, "#1d4a3a", "#163a2e", "#102a22");
    for (let k = 0; k < 6; k++) { const p = P(b.x0 + 1.7 + hash(i, k) * (b.x1 - b.x0 - 2.4), b.y0 + 0.9 + hash(k, i) * (b.y1 - b.y0 - 2), z + 5); g.fillStyle = k % 2 ? "#7d2ea0" : "#2fbf7a"; g.beginPath(); g.arc(p[0], p[1] - 5, 6, 0, 7); g.fill(); }
  }
  if (b.board) {
    const c = P((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, z + 34), sx = Math.cos(t * 0.9);
    const p0 = P((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, z);
    g.strokeStyle = "#5b51a8"; g.lineWidth = 2; g.beginPath(); g.moveTo(...p0); g.lineTo(c[0], c[1]); g.stroke();
    g.save(); g.translate(c[0], c[1] - 8); g.scale(Math.max(0.08, Math.abs(sx)), 1);
    g.fillStyle = "rgba(255,62,165,.18)"; g.fillRect(-42, -12, 84, 24); g.strokeStyle = "#ff3ea5"; g.lineWidth = 1; g.strokeRect(-42, -12, 84, 24);
    neonText(b.board, 0, 0, "#ff3ea5", 8, 0.95); g.restore();
  }
}
function lights(b) {
  const n = 10;
  for (let k = 0; k <= n; k++) {
    const u = b.x0 + 0.1 + (b.x1 - b.x0 - 0.2) * k / n, sag = Math.sin((k / n) * Math.PI) * 6;
    const p = P(u, b.y1 + 0.34, 46 - sag), on = (k + Math.floor(t * 3)) % 3;
    g.fillStyle = on ? "#ffd27a" : "#ff6fc8"; g.fillRect(p[0] - 1, p[1] - 1, 3, 3); glow(p[0], p[1], 6, 6, on ? "#ffd27a" : "#ff6fc8", 0.6);
  }
}
function wallScreen(b) {
  face(b, "R", 0.4, 12, () => {
    const w = (b.y1 - b.y0 - 0.8) * 32, h = 40;
    g.fillStyle = "#0b0720"; g.fillRect(-2, -h - 2, w + 4, h + 4);
    g.save(); g.beginPath(); g.rect(0, -h, w, h); g.clip();
    const ph = Math.floor(t / 3) % 2;
    g.fillStyle = ph ? "#3b1270" : "#0c3a52"; g.fillRect(0, -h, w, h);
    for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? "rgba(255,62,165,.5)" : "rgba(53,242,255,.5)"; g.fillRect(((k * 30 + t * 40) % (w + 30)) - 30, -h + 6 + k * 5, 26, 3); }
    g.font = '9px "PS2P"'; g.textBaseline = "middle"; g.fillStyle = "#fff";
    g.fillText(ph ? "PROMO 50%" : "E-TANK MURAH", w - ((t * 30) % (w + 120)), -10);
    g.restore();
  });
}

function drawTier(b, i) {
  const [top, left, right] = b.c;
  const parts = [{ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, z0: 0, h: b.h, win: b.win }];
  let z = b.h;
  for (const [ins, hh, win] of b.tiers) { parts.push({ x0: b.x0 + ins, y0: b.y0 + ins, x1: b.x1 - ins, y1: b.y1 - ins, z0: z, h: hh, win }); z += hh; }
  parts.forEach((p, k) => {
    box(p.x0, p.y0, p.x1, p.y1, p.z0, p.h, k ? "#453b86" : top, left, right, "rgba(155,140,255,.45)");
    windows(p, "L", i * 10 + k, p.win, k ? 0 : 56); windows(p, "R", i * 10 + k + 5, p.win, k ? 0 : 56);
    const e = P(p.x1, p.y1, p.z0 + p.h); g.strokeStyle = k === 2 ? "#ff3ea5" : "#35f2ff"; g.globalAlpha = 0.7; g.lineWidth = 2; g.beginPath(); g.moveTo(...P(p.x0, p.y1, p.z0 + p.h)); g.lineTo(...e); g.lineTo(...P(p.x1, p.y0, p.z0 + p.h)); g.stroke(); g.globalAlpha = 1;
  });
  storefront(b, i);
  if (b.balcony) balconies(b, i);
  if (b.ac) wallAC(b, i);
  cornerStrip(parts[1], "#ff3ea5", 6);
  if (b.awning) awning(b, b.awning);
  if (b.spire) {
    const tp = parts[parts.length - 1], cxm = (tp.x0 + tp.x1) / 2, cym = (tp.y0 + tp.y1) / 2;
    cyl(cxm, cym, 0.5, z, 10, ["#dfe7ff", "#8a83c8", "#3a3480"], "#35f2ff");
    const a = P(cxm, cym, z + 10), c = P(cxm, cym, z + 70);
    g.strokeStyle = "#cfd9ff"; g.lineWidth = 3; g.beginPath(); g.moveTo(...a); g.lineTo(...c); g.stroke();
    if (Math.sin(t * 4) > 0) { glow(c[0], c[1], 14, 14, "#ff4a5a", 0.9); g.fillStyle = "#ff4a5a"; g.fillRect(c[0] - 2, c[1] - 2, 4, 4); }
  }
  signs(b, i);
}
function drawRound(b, i) {
  const cx0 = (b.x0 + b.x1) / 2, cy0 = (b.y0 + b.y1) / 2;
  const base = cyl(cx0, cy0, b.r + 0.05, 0, 50, ["#3a3072", "#2f2a66", "#17133a"]);
  // storefront glow band on base
  g.save(); g.globalAlpha = 0.4 + 0.1 * Math.sin(t * 2); g.strokeStyle = b.store; g.lineWidth = 26;
  g.beginPath(); g.ellipse(base.c[0], base.c[1] - 22, base.rx - 13, base.ry - 6, 0, 0.15, Math.PI - 0.15); g.stroke(); g.restore();
  const body = cyl(cx0, cy0, b.r - 0.12, 50, b.h - 50, ["#4a3f90", "#3a3280", "#141036"], "rgba(155,140,255,.6)");
  const { c, rx, ry } = body;
  g.save(); g.beginPath(); g.ellipse(c[0], c[1], rx, ry, 0, 0, Math.PI); g.lineTo(c[0] - rx, c[1] - (b.h - 50)); g.ellipse(c[0], c[1] - (b.h - 50), rx, ry, 0, Math.PI, 0, true); g.closePath(); g.clip();
  for (let v = 16, j = 0; v < b.h - 60; v += 20, j++) {
    g.setLineDash([7, 5]); g.lineDashOffset = j * 3; g.lineWidth = 9;
    g.strokeStyle = hash(i, j) > 0.5 ? "rgba(111,246,255,.55)" : "rgba(255,196,107,.5)";
    g.beginPath(); g.ellipse(c[0], c[1] - v, rx, ry, 0, 0.1, Math.PI - 0.1); g.stroke();
  }
  g.setLineDash([]); g.restore();
  for (const [k, v] of [[0, 110], [1, 200], [2, 280]]) {
    const col = k === 1 ? "#ff3ea5" : "#35f2ff", a = 0.6 + 0.4 * Math.sin(t * 2 + k);
    g.save(); g.globalAlpha = a; g.shadowColor = col; g.shadowBlur = 10; g.strokeStyle = col; g.lineWidth = 3;
    g.beginPath(); g.ellipse(c[0], c[1] - v, rx + 3, ry + 2, 0, 0, Math.PI); g.stroke(); g.restore();
  }
  // crown + helipad + mast
  const topc = cyl(cx0, cy0, b.r + 0.08, b.h, 8, ["#2a2357", "#5b51a8", "#221d4a"], "#35f2ff");
  g.strokeStyle = "#ffb547"; g.lineWidth = 2; g.beginPath(); g.ellipse(topc.c[0], topc.c[1] - 8, 22, 11, 0, 0, 7); g.stroke();
  neonText("H", topc.c[0], topc.c[1] - 8, "#ffb547", 9, 0.9);
  const a0 = P(cx0 + 0.4, cy0 - 0.4, b.h + 8), a1 = P(cx0 + 0.4, cy0 - 0.4, b.h + 90);
  g.strokeStyle = "#8a83c8"; g.lineWidth = 2; g.beginPath(); g.moveTo(...a0); g.lineTo(...a1); g.stroke();
  if (Math.sin(t * 4 + 1) > 0) { glow(a1[0], a1[1], 14, 14, "#ff4a5a", 0.9); g.fillStyle = "#ff4a5a"; g.fillRect(a1[0] - 2, a1[1] - 2, 4, 4); }
  vSign(c[0] + rx * 0.55, c[1] - b.h + 120, "NET", "#35f2ff", i * 5);
}
function drawDome(b, i) {
  const [top, left, right] = b.c;
  box(b.x0, b.y0, b.x1, b.y1, 0, b.h, top, left, right, "rgba(155,140,255,.45)");
  face(b, "L", 0, 0, () => {
    const w = (b.x1 - b.x0) * 32;
    for (let x = 10; x < w - 14; x += 24) { g.fillStyle = "#0d0a22"; g.fillRect(x, -34, 14, 34); g.fillStyle = "rgba(53,242,255,.35)"; g.fillRect(x + 2, -32, 10, 30); }
  });
  windows(b, "R", i * 10, "band", 0);
  const cxm = (b.x0 + b.x1) / 2, cym = (b.y0 + b.y1) / 2, c = P(cxm, cym, b.h), rx = 2.25 * 45.25, ry = 2.25 * 22.63, H = b.dome;
  const gr = g.createRadialGradient(c[0] - rx * 0.3, c[1] - H * 0.7, 6, c[0], c[1] - H * 0.3, rx * 1.1);
  gr.addColorStop(0, "#6a5ad0"); gr.addColorStop(0.5, "#352c86"); gr.addColorStop(1, "#16123c");
  g.fillStyle = gr; g.beginPath(); g.ellipse(c[0], c[1], rx, ry, 0, 0, Math.PI); g.ellipse(c[0], c[1], rx, H, 0, Math.PI, 0); g.closePath(); g.fill();
  g.save(); g.beginPath(); g.ellipse(c[0], c[1], rx, ry, 0, 0, Math.PI); g.ellipse(c[0], c[1], rx, H, 0, Math.PI, 0); g.closePath(); g.clip();
  g.lineWidth = 1.5;
  for (let k = 0; k < 8; k++) {
    const ang = (k / 8) * Math.PI + t * 0.25, w = Math.cos(ang) * rx;
    g.strokeStyle = `rgba(53,242,255,${0.25 + 0.35 * Math.max(0, Math.sin(ang))})`;
    g.beginPath(); g.ellipse(c[0], c[1], Math.abs(w), H, 0, Math.PI, 0); g.stroke();
  }
  for (let k = 1; k < 4; k++) { g.strokeStyle = "rgba(155,92,255,.45)"; g.beginPath(); g.ellipse(c[0], c[1] - H * k / 4, rx * Math.sqrt(1 - (k / 4) ** 2), ry * Math.sqrt(1 - (k / 4) ** 2), 0, 0, Math.PI); g.stroke(); }
  g.restore();
  g.save(); g.shadowColor = "#ff3ea5"; g.shadowBlur = 10; g.strokeStyle = "#ff3ea5"; g.lineWidth = 3; g.beginPath(); g.ellipse(c[0], c[1], rx, ry, 0, 0, Math.PI); g.stroke(); g.restore();
  const em = [c[0], c[1] - H - 30 + Math.sin(t * 2) * 4];
  g.save(); g.translate(...em); g.scale(Math.max(0.1, Math.abs(Math.cos(t * 0.8))), 1); neonText("X", 0, 0, "#9b5cff", 20, 0.95); g.restore();
  glow(em[0], em[1], 30, 30, "#9b5cff", 0.3);
  signs(b, i);
}
function drawShop(b, i) {
  const [top, left, right] = b.c;
  box(b.x0, b.y0, b.x1, b.y1, 0, b.h, top, left, right, "rgba(155,140,255,.45)");
  face(b, "L", 0, b.h, () => { g.fillStyle = "#2a2050"; g.fillRect(0, 0, (b.x1 - b.x0) * 32, 4); });
  windows(b, "R", i * 10 + 5, b.win, 50);
  storefront(b, i);
  if (b.ac) wallAC(b, i);
  if (b.screen) wallScreen(b);
  if (b.awning) awning(b, b.awning);
  if (b.lights) lights(b);
  // parapet
  box(b.x0, b.y1 - 0.08, b.x1, b.y1, b.h, 6, "#5b51a8", "#3a3480", "#2d2860");
  box(b.x1 - 0.08, b.y0, b.x1, b.y1, b.h, 6, "#5b51a8", "#3a3480", "#2d2860");
  roofBits(b, i);
  signs(b, i);
}
function drawGarage(b, i) {
  const [top, left, right] = b.c;
  box(b.x0, b.y0, b.x1, b.y1, 0, b.h, top, left, right, "rgba(155,140,255,.45)");
  face(b, "L", 0, 0, () => {
    const w = (b.x1 - b.x0) * 32;
    g.fillStyle = "#14102c"; g.fillRect(8, -46, w - 16, 46);
    for (let y = -44; y < 0; y += 5) { g.fillStyle = "#3a3270"; g.fillRect(10, y, w - 20, 3); }
    const open = 0.5 + 0.5 * Math.sin(t * 0.5);
    g.fillStyle = "rgba(255,181,71,.55)"; g.fillRect(10, -46 * open * 0.4, w - 20, 46 * open * 0.4);
    for (let x = 8; x < w - 8; x += 8) { g.fillStyle = (x / 8) % 2 ? "#ffb547" : "#14102c"; g.fillRect(x, -52, 8, 5); }
  });
  face(b, "R", 0, 0, () => {
    const w = (b.y1 - b.y0) * 32;
    g.strokeStyle = "#5b51a8"; g.lineWidth = 3;
    for (const x of [20, 30]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, -b.h + 8); g.stroke(); }
    for (let x = 50; x < w - 10; x += 26) { g.fillStyle = "rgba(255,196,107,.6)"; g.fillRect(x, -56, 16, 10); }
  });
  const n = b.y1 - b.y0;
  for (let j = 0; j < n; j++) {
    const ya = b.y0 + j, yb = ya + 1;
    poly([P(b.x0, ya, b.h), P(b.x1, ya, b.h), P(b.x1, yb, b.h + 22), P(b.x0, yb, b.h + 22)], "#4a3a78");
    poly([P(b.x0, yb, b.h), P(b.x1, yb, b.h), P(b.x1, yb, b.h + 22), P(b.x0, yb, b.h + 22)], `rgba(53,242,255,${0.35 + 0.1 * Math.sin(t * 2 + j)})`);
    poly([P(b.x1, ya, b.h), P(b.x1, yb, b.h), P(b.x1, yb, b.h + 22)], "#2a1e46");
  }
  // little crane arm
  const a = P(b.x0 + 0.3, b.y0 + 0.3, b.h + 22), c = P(b.x0 + 0.3, b.y0 + 0.3, b.h + 70), d = P(b.x0 + 1.6, b.y0 - 0.4, b.h + 66);
  g.strokeStyle = "#ffb547"; g.lineWidth = 2; g.beginPath(); g.moveTo(...a); g.lineTo(...c); g.lineTo(...d); g.stroke();
  const hook = 10 + 6 * Math.sin(t); g.strokeStyle = "#8a83c8"; g.lineWidth = 1; g.beginPath(); g.moveTo(...d); g.lineTo(d[0], d[1] + hook + 14); g.stroke();
  g.fillStyle = "#ffb547"; g.fillRect(d[0] - 3, d[1] + hook + 14, 6, 5);
  signs(b, i);
}
function drawBlock(b, i) {
  const [top, left, right] = b.c;
  box(b.x0, b.y0, b.x1, b.y1, 0, b.h, top, left, right, "rgba(155,140,255,.45)");
  windows(b, "R", i * 10 + 5, b.win, 0);
  face(b, "L", 0, 0, () => { const w = (b.x1 - b.x0) * 32; g.fillStyle = "#0d0a22"; g.fillRect(6, -40, w - 12, 34); g.fillStyle = "rgba(53,242,255,.3)"; g.fillRect(8, -38, w - 16, 30); g.fillStyle = "#07051a"; g.fillRect(w / 2 - 7, -30, 14, 30); });
  roofBits(b, i);
  signs(b, i);
}
const DRAWB = { tier: drawTier, round: drawRound, dome: drawDome, shop: drawShop, garage: drawGarage, block: drawBlock };
for (const [i, b] of BUILD.entries()) {
  block(b);
  statics.push({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, draw: () => DRAWB[b.k](b, i) });
}

/* ---------- HQ (Hunter Base cutaway) ---------- */
const WALLS = [
  { r: R(0, 0, 10, 1), h: 132 }, { r: R(0, 1, 1, 8), h: 132 },
  { r: R(1, 7, 4, 8), h: 10, rail: 1 }, { r: R(6, 7, 10, 8), h: 10, rail: 1 },
  { r: R(9, 1, 10, 3), h: 10, rail: 1 }, { r: R(9, 4, 10, 7), h: 10, rail: 1 },
];
for (const w of WALLS) {
  block(w.r);
  const r = w.r;
  statics.push({ x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1, back: !w.rail, draw() {
    if (w.rail) {
      box(r.x0, r.y0, r.x1, r.y1, 0, w.h, "#cfd9ff", "#7e8fd0", "#5c6cb0");
      const a = 0.6 + 0.4 * Math.sin(t * 3 + r.x0);
      box(r.x0, r.y0 + 0.35, r.x1, r.y1 - 0.35, w.h, 3, `rgba(53,242,255,${a})`, "#1a7a9a", "#14607a");
      return;
    }
    box(r.x0, r.y0, r.x1, r.y1, 0, w.h, "#4b5a9e", "#b9c6f2", "#8e9cd8", "rgba(255,255,255,.5)");
    // armour panel seams + hunter stripe
    const b = { ...r, h: w.h };
    if (r.y1 === 1) {
      face(b, "L", 0, 0, () => {
        const len = (r.x1 - r.x0) * 32;
        g.fillStyle = "#3b6cff"; g.fillRect(0, -22, len, 6); g.fillStyle = "#dfe7ff"; g.fillRect(0, -16, len, 2);
        for (let x = 0; x < len; x += 32) { g.fillStyle = "rgba(40,50,110,.35)"; g.fillRect(x, -w.h, 1, w.h); }
        // main wall monitor
        const sx = 70, sw = 196, sy = -118, sh = 76;
        g.fillStyle = "#111a3e"; g.fillRect(sx - 6, sy - 6, sw + 12, sh + 12);
        g.fillStyle = "#06122a"; g.fillRect(sx, sy, sw, sh);
        g.save(); g.beginPath(); g.rect(sx, sy, sw, sh); g.clip();
        g.strokeStyle = "rgba(53,242,255,.18)"; g.lineWidth = 1;
        for (let gx = sx; gx < sx + sw; gx += 12) { g.beginPath(); g.moveTo(gx, sy); g.lineTo(gx, sy + sh); g.stroke(); }
        for (let gy = sy; gy < sy + sh; gy += 12) { g.beginPath(); g.moveTo(sx, gy); g.lineTo(sx + sw, gy); g.stroke(); }
        g.strokeStyle = "#35f2ff"; g.lineWidth = 2; g.beginPath();
        for (let k = 0; k <= 40; k++) { const px = sx + 96 + k * 2.4, py = sy + 48 - 14 * Math.sin(k * 0.45 + t * 2) * Math.cos(k * 0.13); k ? g.lineTo(px, py) : g.moveTo(px, py); }
        g.stroke();
        for (let k = 0; k < 7; k++) { const hh = 8 + 26 * (0.5 + 0.5 * Math.sin(t * 1.7 + k)); g.fillStyle = k % 2 ? "#ff3ea5" : "#9b5cff"; g.fillRect(sx + 10 + k * 11, sy + sh - 8 - hh, 7, hh); }
        g.fillStyle = "rgba(53,242,255,.12)"; g.fillRect(sx, sy + ((t * 30) % sh), sw, 3);
        g.restore();
        neonText("HUNTER NET", sx + 48, sy + 10, "#35f2ff", 7, 1);
        neonText(`KRU AKTIF ${counts.work}/${crew.length}`, sx + 150, sy + 10, "#5cf08a", 6, 1);
      });
      // floating HQ title above the back wall
      face(b, "L", 1, w.h + 40, () => {
        g.fillStyle = "rgba(53,242,255,.08)"; g.fillRect(-10, -26, 270, 34); g.strokeStyle = "rgba(53,242,255,.5)"; g.strokeRect(-10, -26, 270, 34);
        neonText("MISSION CONTROL", 125, -9, "#35f2ff", 13, flick(91, 0.02), "center");
      });
    } else {
      face(b, "R", 0, 0, () => {
        const len = (r.y1 - r.y0) * 32;
        g.fillStyle = "#3b6cff"; g.fillRect(0, -22, len, 6); g.fillStyle = "#dfe7ff"; g.fillRect(0, -16, len, 2);
        for (let x = 0; x < len; x += 32) { g.fillStyle = "rgba(40,50,110,.35)"; g.fillRect(x, -w.h, 1, w.h); }
        // hunter emblem + side screen
        g.fillStyle = "#0b1636"; g.fillRect(118, -112, 86, 50);
        g.strokeStyle = "#35f2ff"; g.lineWidth = 1; g.strokeRect(118, -112, 86, 50);
        for (let k = 0; k < 5; k++) { g.fillStyle = `rgba(53,242,255,${0.25 + 0.2 * Math.sin(t * 3 + k)})`; g.fillRect(124, -104 + k * 8, 30 + 40 * hash(k, Math.floor(t * 2)), 4); }
        g.fillStyle = "#c8102e"; g.beginPath(); g.moveTo(60, -112); g.lineTo(90, -112); g.lineTo(75, -82); g.closePath(); g.fill();
        g.fillStyle = "#dfe7ff"; g.fillRect(70, -108, 10, 3);
      });
    }
  } });
}
const DESKS = [[2, 2], [4, 2], [6, 2]];
const CHAMBER = R(4, 4, 6, 6);   // teleportation chamber: crew beam out anywhere and land here
const CH_X = 5, CH_Y = 5, CH_Z = 12;
const onChamber = (x, y) => x > CHAMBER.x0 + 0.2 && x < CHAMBER.x1 - 0.2 && y > CHAMBER.y0 + 0.2 && y < CHAMBER.y1 - 0.2;
const SERVERS = [[1, 4], [1, 5], [1, 6]];
const CAPS = [[8, 1], [8, 2], [8, 5], [8, 6], [16, 10], [16, 11], [16, 12]];
const TABLE = R(14, 11, 16, 13);   // holo map table, out on the plaza
const SPOTS = [[2, 3, "b"], [4, 3, "b"], [6, 3, "b"], [14, 13, "b"], [15, 13, "b"], [2, 5, "bl"], [2, 6, "bl"]];

function drawDesk(x, y, seed) {
  box(x + 0.1, y + 0.15, x + 0.9, y + 0.7, 0, 16, "#e8eeff", "#a9b8ee", "#7f90d4", "rgba(255,255,255,.7)");
  box(x + 0.1, y + 0.55, x + 0.9, y + 0.7, 16, 3, "#3b6cff", "#2a4fc0", "#1e3c98");
  const kb = P(x + 0.5, y + 0.6, 19); glow(kb[0], kb[1], 18, 6, "#35f2ff", 0.5);
  // three curved holo screens, facing the operator (+y)
  const pan = (u0, u1, z0, z1, a) => {
    poly([P(x + u0, y + 0.3, z0), P(x + u1, y + 0.3, z0), P(x + u1, y + 0.3, z1), P(x + u0, y + 0.3, z1)], `rgba(53,242,255,${0.16 * a})`);
    g.strokeStyle = `rgba(120,250,255,${0.85 * a})`; g.lineWidth = 1; g.beginPath();
    const c = [P(x + u0, y + 0.3, z0), P(x + u1, y + 0.3, z0), P(x + u1, y + 0.3, z1), P(x + u0, y + 0.3, z1)];
    g.moveTo(...c[0]); for (const q of c.slice(1)) g.lineTo(...q); g.closePath(); g.stroke();
    for (let k = 0; k < 3; k++) {
      const z = z1 - 5 - k * 6, w = (u1 - u0) * (0.3 + 0.6 * hash(seed, k, Math.floor(t * 3 + seed)));
      const p0 = P(x + u0 + 0.06, y + 0.3, z), p1 = P(x + u0 + 0.06 + w * 0.85, y + 0.3, z);
      g.strokeStyle = k === 0 ? `rgba(255,62,165,${a})` : `rgba(200,255,255,${0.6 * a})`; g.beginPath(); g.moveTo(...p0); g.lineTo(...p1); g.stroke();
    }
  };
  const a = 0.75 + 0.25 * Math.sin(t * 5 + seed * 2);
  pan(0.04, 0.3, 26, 44, a * 0.8); pan(0.33, 0.67, 24, 50, a); pan(0.7, 0.96, 26, 44, a * 0.8);
  const c = P(x + 0.5, y + 0.3, 34); glow(c[0], c[1], 30, 24, "#35f2ff", 0.22);
}
function drawTable(r) {
  const c = P((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2);
  g.fillStyle = "#7f90d4"; g.beginPath(); g.ellipse(c[0], c[1], 40, 20, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#a9b8ee"; g.fillRect(c[0] - 40, c[1] - 12, 80, 12);
  g.fillStyle = "#e8eeff"; g.beginPath(); g.ellipse(c[0], c[1] - 12, 40, 20, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#0b1636"; g.beginPath(); g.ellipse(c[0], c[1] - 13, 33, 16, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(53,242,255,.9)"; g.lineWidth = 2; g.setLineDash([6, 4]); g.lineDashOffset = -t * 20;
  g.beginPath(); g.ellipse(c[0], c[1] - 13, 29, 14, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  // projected mini city, slowly rotating
  g.save(); g.globalCompositeOperation = "lighter";
  const rot = t * 0.6;
  for (let k = 0; k < 9; k++) {
    const ang = rot + k * 0.7, rr = 8 + (k % 3) * 9;
    const px = c[0] + Math.cos(ang) * rr * 1.2, py = c[1] - 15 + Math.sin(ang) * rr * 0.6, hh = 6 + hash(k) * 16;
    g.fillStyle = k % 3 === 0 ? "rgba(255,62,165,.45)" : "rgba(53,242,255,.4)";
    g.fillRect(px - 3, py - hh, 6, hh);
  }
  g.strokeStyle = "rgba(53,242,255,.5)"; g.lineWidth = 1;
  for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(c[0], c[1] - 36 - k * 5, 26 - k * 6, 8 - k * 2, rot, 0, Math.PI * 2); g.stroke(); }
  const gr = g.createLinearGradient(0, c[1] - 90, 0, c[1] - 20); gr.addColorStop(0, "rgba(53,242,255,0)"); gr.addColorStop(1, "rgba(53,242,255,.22)");
  g.fillStyle = gr; g.beginPath(); g.moveTo(c[0] - 36, c[1] - 20); g.lineTo(c[0] + 36, c[1] - 20); g.lineTo(c[0] + 22, c[1] - 90); g.lineTo(c[0] - 22, c[1] - 90); g.closePath(); g.fill();
  g.restore();
}
function drawServer(x, y, seed) {
  box(x + 0.15, y + 0.1, x + 0.85, y + 0.9, 0, 60, "#2a3366", "#1a2048", "#121738", "rgba(120,140,255,.5)");
  face({ x0: x + 0.15, y0: y + 0.1, x1: x + 0.85, y1: y + 0.9 }, "R", 0, 0, () => {
    for (let row = 0; row < 6; row++) for (let col = 0; col < 4; col++) {
      const on = hash(seed, row * 4 + col, Math.floor(t * (4 + col))) > 0.45;
      g.fillStyle = on ? (col === 3 ? "#ff3ea5" : row % 3 ? "#35f2ff" : "#5cf08a") : "#0b0f26";
      g.fillRect(4 + col * 5, -12 - row * 9, 3, 3);
    }
    g.fillStyle = "rgba(53,242,255,.25)"; g.fillRect(2, -56, 20, 2);
  });
  const c = P(x + 0.85, y + 0.5, 40); glow(c[0], c[1], 22, 30, "#35f2ff", 0.12);
}
function capsuleBack(x, y) {
  const c = P(x + 0.5, y + 0.5);
  g.fillStyle = "#5c6cb0"; g.beginPath(); g.ellipse(c[0], c[1], 18, 9, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#cfd9ff"; g.beginPath(); g.ellipse(c[0], c[1] - 4, 18, 9, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#24306a"; g.beginPath(); g.ellipse(c[0], c[1] - 5, 13, 6, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#7e8fd0"; g.beginPath(); g.moveTo(c[0] - 16, c[1] - 6); g.quadraticCurveTo(c[0], c[1] - 18, c[0] + 16, c[1] - 6); g.lineTo(c[0] + 16, c[1] - 56); g.quadraticCurveTo(c[0], c[1] - 66, c[0] - 16, c[1] - 56); g.closePath(); g.fill();
}
function capsuleFront(x, y, used) {
  const c = P(x + 0.5, y + 0.5);
  g.save();
  g.fillStyle = `rgba(53,242,255,${used ? 0.22 : 0.1})`; g.beginPath(); g.ellipse(c[0], c[1] - 30, 16, 28, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(160,250,255,.6)"; g.lineWidth = 1; g.beginPath(); g.moveTo(c[0] - 9, c[1] - 50); g.lineTo(c[0] - 10, c[1] - 16); g.stroke();
  if (used) for (let k = 0; k < 5; k++) { const ph = (t * 0.6 + k * 0.21) % 1; g.fillStyle = "rgba(200,255,255,.7)"; g.fillRect(c[0] - 8 + hash(k, x) * 16, c[1] - 8 - ph * 46, 2, 2); }
  g.fillStyle = "#cfd9ff"; g.beginPath(); g.ellipse(c[0], c[1] - 58, 17, 8, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#3b6cff"; g.fillRect(c[0] - 10, c[1] - 63, 20, 5);
  neonText("CHG", c[0], c[1] - 60, used ? "#5cf08a" : "#7d8cff", 5, used ? 0.6 + 0.4 * Math.sin(t * 4) : 0.8);
  g.restore();
  if (used) glow(c[0], c[1] - 26, 22, 34, "#35f2ff", 0.18);
}
function cylinder(cx0, cy0, rx, ry, z0, h, side, top, edge) {
  // upright elliptic drum in screen space (iso circle), z0..z0+h above ground point (cx0, cy0)
  g.fillStyle = side; g.beginPath(); g.ellipse(cx0, cy0 - z0, rx, ry, 0, 0, Math.PI); g.lineTo(cx0 - rx, cy0 - z0 - h); g.ellipse(cx0, cy0 - z0 - h, rx, ry, 0, Math.PI, 0, true); g.closePath(); g.fill();
  g.fillStyle = top; g.beginPath(); g.ellipse(cx0, cy0 - z0 - h, rx, ry, 0, 0, Math.PI * 2); g.fill();
  if (edge) { g.strokeStyle = edge; g.lineWidth = 1; g.beginPath(); g.ellipse(cx0, cy0 - z0 - h, rx, ry, 0, 0, Math.PI); g.stroke(); }
}
let chBeam = 0;   // extra beam flare while someone lands in the chamber
/* back half: stepped platform, pillars, curved back panel (drawn behind anyone standing on the pad) */
function chamberBack() {
  const c = P(CH_X, CH_Y), pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
  // low curved back plate (open frame, so the desks behind stay visible) with hoses into the floor
  const L = P(CH_X - 0.95, CH_Y + 0.35), Rr = P(CH_X + 0.35, CH_Y - 0.95), H = 34;
  g.fillStyle = "#2a3366"; g.beginPath(); g.moveTo(L[0], L[1]); g.quadraticCurveTo(c[0], c[1] - 40, Rr[0], Rr[1]); g.lineTo(Rr[0], Rr[1] - H); g.quadraticCurveTo(c[0], c[1] - 40 - H, L[0], L[1] - H); g.closePath(); g.fill();
  g.strokeStyle = `rgba(53,242,255,${0.6 + 0.3 * pulse})`; g.lineWidth = 2; g.beginPath(); g.moveTo(L[0], L[1] - H + 6); g.quadraticCurveTo(c[0], c[1] - 34 - H, Rr[0], Rr[1] - H + 6); g.stroke();
  for (const q of [L, Rr]) {
    g.fillStyle = "#3d4a8c"; g.fillRect(q[0] - 4, q[1] - H - 8, 8, H + 8);
    g.fillStyle = (Math.floor(t * 3) % 2) ? "#ff3ea5" : "#35f2ff"; g.fillRect(q[0] - 1, q[1] - H - 4, 2, 6);
    g.strokeStyle = "#141a3c"; g.lineWidth = 3; g.beginPath(); g.moveTo(q[0], q[1] - 14); g.quadraticCurveTo(q[0] + (q === L ? -16 : 16), q[1] - 4, q[0] + (q === L ? -8 : 8), q[1] + 6); g.stroke();
  }
  // stepped platform: wide bottom step, top pad
  cylinder(c[0], c[1], 46, 23, 0, 5, "#5c6cb0", "#a9b8ee", "rgba(255,255,255,.5)");
  cylinder(c[0], c[1], 36, 18, 5, 7, "#7f90d4", "#dfe7ff", "rgba(255,255,255,.7)");
  g.fillStyle = "#0b1636"; g.beginPath(); g.ellipse(c[0], c[1] - CH_Z, 28, 14, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = `rgba(53,242,255,${0.7 + 0.3 * pulse})`; g.lineWidth = 2; g.setLineDash([5, 4]); g.lineDashOffset = -t * 18;
  g.beginPath(); g.ellipse(c[0], c[1] - CH_Z, 23, 11.5, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, on = (k + Math.floor(t * 6)) % 5 === 0; g.fillStyle = on ? "#f2ffff" : "#35f2ff"; g.fillRect(c[0] + Math.cos(a) * 41 - 1, c[1] - 3 + Math.sin(a) * 20.5 - 1, 2, 2); }
  glow(c[0], c[1] - CH_Z, 34, 16, "#35f2ff", 0.45 + 0.25 * pulse + chBeam * 0.3);
}
/* emitter head: low dark-metal hood with a lit rim, lens glowing underneath */
function emitterHead(x, y, f) {
  const RX = 30, RY = 15, RIM = 8, base = y - RIM;
  // lens underneath: only its front lip shows, plus light spilling down
  g.save(); g.globalCompositeOperation = "lighter";
  g.fillStyle = `rgba(200,255,255,${0.5 + 0.3 * f})`; g.beginPath(); g.ellipse(x, y + 1, 24, 9.5, 0, 0, Math.PI); g.fill();
  g.restore();
  glow(x, y + 6, 38, 15, "#e0ffff", 0.5 + 0.35 * f);
  // rim drum with a thin light strip that chases around the front
  cylinder(x, y, RX, RY, 0, RIM, "#1e2650", "#2c3670", "rgba(53,242,255,.7)");
  for (let k = 0; k < 12; k++) {
    const a = 0.12 * Math.PI + k / 11 * 0.76 * Math.PI, on = (k + Math.floor(t * 8)) % 6 < 2;
    g.fillStyle = on ? "#f2ffff" : "#35f2ff"; g.globalAlpha = on ? 1 : 0.45 + 0.25 * f;
    g.fillRect(x + Math.cos(a) * RX - 1.5, y - 4 + Math.sin(a) * RY - 1, 3, 2);
  }
  g.globalAlpha = 1;
  // low cap: a shallow step instead of a dome
  cylinder(x, base, 20, 10, 0, 5, "#262f62", "#333e7c", "rgba(120,140,255,.5)");
  g.strokeStyle = "rgba(53,242,255,.35)"; g.lineWidth = 1; g.beginPath(); g.ellipse(x, base - 5, 13, 6.5, 0, 0, Math.PI * 2); g.stroke();
  // docking collar for the gantry arm + small status light
  cylinder(x, base - 5, 7, 3.5, 0, 5, "#1e2650", "#2c3670");
  g.fillStyle = "#ff3ea5"; g.fillRect(x - 1, base - 12, 2, 2);
  glow(x, base - 11, 7, 5, "#ff3ea5", 0.4 + 0.4 * Math.max(0, Math.sin(t * 4)));
}
/* front half: overhead emitter + light column (drawn over anyone standing on the pad); the head hangs above the desk crew's heads */
function chamberFront() {
  const c = P(CH_X, CH_Y), top = c[1] - 112, bot = c[1] - CH_Z, f = Math.min(1, chBeam), idle = 0.3 + 0.08 * Math.sin(t * 3);
  g.save(); g.globalCompositeOperation = "lighter";
  const w = 22 + 6 * f, gr = g.createLinearGradient(c[0] - w, 0, c[0] + w, 0);
  gr.addColorStop(0, "rgba(53,242,255,0)"); gr.addColorStop(0.3, `rgba(53,242,255,${idle + 0.3 * f})`); gr.addColorStop(0.5, `rgba(220,255,255,${idle + 0.45 * f})`); gr.addColorStop(0.7, `rgba(53,242,255,${idle + 0.3 * f})`); gr.addColorStop(1, "rgba(53,242,255,0)");
  g.fillStyle = gr; g.fillRect(c[0] - w, top, w * 2, bot - top);
  // falling streaks, like the beam in the reference
  for (let k = 0; k < 9; k++) { const x = c[0] - w * 0.8 + hash(k, 3) * w * 1.6, len = 18 + hash(k) * 30, y = top + ((t * (70 + hash(k, 9) * 60) + hash(k, 5) * 100) % (bot - top)); g.fillStyle = `rgba(230,255,255,${0.25 + 0.35 * f})`; g.fillRect(x, y, 1.5, Math.min(len, bot - y)); }
  for (let k = 0; k < 2 + Math.round(f * 2); k++) { const ph = (t * 1.2 + k / 3) % 1; g.strokeStyle = `rgba(170,250,255,${(1 - ph) * (0.4 + 0.5 * f)})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(c[0], bot - ph * 80, 24 - ph * 4, 12 - ph * 2, 0, 0, Math.PI * 2); g.stroke(); }
  g.restore();
  // emitter hangs from a gantry arm that reaches over from the back wall
  const wall = P(1, CH_Y, 120), hub = [c[0], top - 20];   // anchored on the left side wall, clear of the big screen
  g.strokeStyle = "#2a3366"; g.lineWidth = 6; g.beginPath(); g.moveTo(...wall); g.lineTo(wall[0], wall[1] + 8); g.lineTo(...hub); g.stroke();
  g.strokeStyle = "#3d4a8c"; g.lineWidth = 2; g.beginPath(); g.moveTo(wall[0], wall[1] - 2); g.lineTo(hub[0], hub[1] - 4); g.stroke();
  g.strokeStyle = "#141a3c"; g.lineWidth = 2.5; g.beginPath(); g.moveTo(wall[0] - 4, wall[1] + 12); g.quadraticCurveTo((wall[0] + hub[0]) / 2, hub[1] + 6, hub[0] + 8, hub[1] + 4); g.stroke();
  for (let k = 1; k < 4; k++) { const q = [wall[0] + (hub[0] - wall[0]) * k / 4, wall[1] + 4 + (hub[1] - wall[1] - 4) * k / 4]; g.fillStyle = (Math.floor(t * 5) + k) % 3 ? "#35f2ff" : "#ff3ea5"; g.fillRect(q[0] - 1, q[1] - 1, 2, 2); }
  emitterHead(c[0], top, f);
  neonText("TELEPORT", c[0], top - 34, "#35f2ff", 6, 0.85 + 0.15 * Math.sin(t * 2));
}
function drawLamp(x, y, col) {
  const b = P(x + 0.5, y + 0.5), tp = P(x + 0.5, y + 0.5, 56);
  g.strokeStyle = "#3a3670"; g.lineWidth = 3; g.beginPath(); g.moveTo(...b); g.lineTo(...tp); g.lineTo(tp[0] + 14, tp[1] + 2); g.stroke();
  g.fillStyle = col; g.fillRect(tp[0] + 8, tp[1], 12, 4); glow(tp[0] + 14, tp[1] + 4, 18, 10, col, 0.8);
  glow(b[0] + 14, b[1] + 6, 56, 24, col, 0.2);
}
function drawVending(x, y, col) {
  box(x + 0.25, y + 0.3, x + 0.75, y + 0.7, 0, 34, "#3a3072", "#2a2357", "#1d1842", "rgba(255,255,255,.3)");
  face({ x0: x + 0.25, y0: y + 0.3, x1: x + 0.75, y1: y + 0.7 }, "L", 0, 0, () => {
    g.fillStyle = col; g.globalAlpha = 0.7 + 0.3 * Math.sin(t * 2 + x); g.fillRect(2, -30, 12, 22); g.globalAlpha = 1;
    g.fillStyle = "#07051a"; for (let k = 0; k < 3; k++) g.fillRect(4, -27 + k * 6, 8, 2);
  });
  const c = P(x + 0.4, y + 1); glow(c[0], c[1], 30, 12, col, 0.3);
}
function drawBench(x, y) { box(x + 0.15, y + 0.3, x + 0.85, y + 0.7, 0, 8, "#4a4290", "#2d2860", "#221d4a"); box(x + 0.15, y + 0.3, x + 0.85, y + 0.38, 8, 10, "#5b51a8", "#3a3480", "#2a2560"); }
function drawTree(x, y) {
  box(x + 0.25, y + 0.25, x + 0.75, y + 0.75, 0, 10, "#3a3072", "#2a2357", "#1d1842", "#35f2ff");
  const c = P(x + 0.5, y + 0.5, 10);
  g.fillStyle = "#3b1f55"; g.fillRect(c[0] - 1, c[1] - 20, 3, 20);
  const blobs = [[0, -30, 12], [-8, -24, 8], [8, -22, 8], [0, -40, 7]];
  for (const [dx, dy, r] of blobs) { g.fillStyle = "#7d2ea0"; g.beginPath(); g.arc(c[0] + dx, c[1] + dy, r, 0, 7); g.fill(); g.fillStyle = "#c24bd6"; g.beginPath(); g.arc(c[0] + dx - 3, c[1] + dy - 3, r * 0.55, 0, 7); g.fill(); }
  glow(c[0], c[1] - 38, 30, 30, "#ff3ea5", 0.15);
}
function drawStatue(x, y) {
  box(x + 0.4, y + 0.4, x + 1.6, y + 1.6, 0, 8, "#4a4290", "#2d2860", "#221d4a", "#35f2ff");
  const c = P(x + 1, y + 1, 8);
  g.fillStyle = "#1b3b6a"; g.beginPath(); g.ellipse(c[0], c[1], 22, 11, 0, 0, 7); g.fill();
  for (let k = 0; k < 6; k++) { const ph = (t * 0.8 + k / 6) % 1; g.fillStyle = `rgba(120,230,255,${0.8 - ph})`; g.fillRect(c[0] - 14 + k * 5, c[1] - ph * 24, 2, 3); }
  // rotating holo helmet of the Hunter crest
  g.save(); g.translate(c[0], c[1] - 44 + Math.sin(t * 1.5) * 3); g.scale(Math.cos(t * 0.9), 1); g.globalCompositeOperation = "lighter";
  g.fillStyle = "rgba(59,108,255,.55)"; g.beginPath(); g.arc(0, 0, 13, Math.PI, 0); g.lineTo(13, 8); g.lineTo(-13, 8); g.closePath(); g.fill();
  g.fillStyle = "rgba(53,242,255,.7)"; g.fillRect(-9, 0, 18, 5); g.fillStyle = "rgba(255,62,165,.7)"; g.beginPath(); g.moveTo(-3, -13); g.lineTo(3, -13); g.lineTo(0, -6); g.fill();
  g.restore();
  const gr = g.createLinearGradient(0, c[1] - 60, 0, c[1]); gr.addColorStop(0, "rgba(53,242,255,0)"); gr.addColorStop(1, "rgba(53,242,255,.25)");
  g.fillStyle = gr; g.fillRect(c[0] - 14, c[1] - 60, 28, 58);
}
function drawCafe(x, y) {
  const c = P(x + 0.5, y + 0.5);
  g.fillStyle = "#5b51a8"; g.fillRect(c[0] - 1, c[1] - 30, 2, 30);
  g.fillStyle = "#ffb547"; g.beginPath(); g.moveTo(c[0] - 22, c[1] - 26); g.lineTo(c[0], c[1] - 38); g.lineTo(c[0] + 22, c[1] - 26); g.closePath(); g.fill();
  g.fillStyle = "#2d2860"; g.beginPath(); g.ellipse(c[0], c[1] - 12, 12, 6, 0, 0, 7); g.fill();
  g.fillStyle = "#8a83c8"; g.fillRect(c[0] - 12, c[1] - 12, 24, 2);
  for (const dx of [-16, 16]) { g.fillStyle = "#3a3480"; g.fillRect(c[0] + dx - 3, c[1] - 8, 6, 8); }
  glow(c[0], c[1] - 14, 18, 8, "#ffb547", 0.4);
}
const add = (x0, y0, x1, y1, draw, blk = true) => { if (blk) block(R(x0, y0, x1, y1)); statics.push({ x0, y0, x1, y1, draw }); };
DESKS.forEach(([x, y], i) => add(x, y, x + 1, y + 1, () => drawDesk(x, y, i + 1)));
add(TABLE.x0, TABLE.y0, TABLE.x1, TABLE.y1, () => drawTable(TABLE));
block(CHAMBER);
statics.push({ x0: CHAMBER.x0, y0: CHAMBER.y0, x1: CHAMBER.x1, y1: CHAMBER.y0 + 0.2, draw: chamberBack });
statics.push({ x0: CHAMBER.x0, y0: CHAMBER.y1 - 0.2, x1: CHAMBER.x1, y1: CHAMBER.y1, draw: chamberFront });
SERVERS.forEach(([x, y], i) => add(x, y, x + 1, y + 1, () => drawServer(x, y, i + 3)));
CAPS.forEach(([x, y], i) => {
  block(R(x, y, x + 1, y + 1));
  statics.push({ x0: x, y0: y, x1: x + 1, y1: y + 0.2, draw: () => capsuleBack(x, y) });
  statics.push({ x0: x, y0: y + 0.8, x1: x + 1, y1: y + 1, draw: () => capsuleFront(x, y, capUsed[i]) });
});
[[12, 7, "#ffb547"], [12, 13, "#ff3ea5"], [0, 10, "#ffb547"], [15, 7, "#35f2ff"], [9, 13, "#35f2ff"]].forEach(([x, y, c]) => add(x, y, x + 1, y + 1, () => drawLamp(x, y, c)));
[[14, 7, "#35f2ff"], [4, 11, "#ff3ea5"]].forEach(([x, y, c]) => add(x, y, x + 1, y + 1, () => drawVending(x, y, c)));
[[13, 13]].forEach(([x, y]) => add(x, y, x + 1, y + 1, () => drawBench(x, y)));
[[16, 4], [5, 13], [9, 11], [0, 13], [12, 0], [16, 6]].forEach(([x, y]) => add(x, y, x + 1, y + 1, () => drawTree(x, y)));
[[8, 13]].forEach(([x, y]) => add(x, y, x + 1, y + 1, () => drawBench(x, y)));
add(6, 11, 8, 13, () => drawStatue(6, 11));
add(13, 6, 14, 7, () => drawCafe(13, 6));
const capUsed = CAPS.map(() => false);

/* ---------- ground (prerendered once) ---------- */
const GROUND = document.createElement("canvas");
const GX0 = -MH * 32 - 8, GY0 = -20, SLAB = 46;
GROUND.width = (MW + MH) * 32 + 16; GROUND.height = (MW + MH) * 16 + SLAB + 40;
function paintGround() {
  g = GROUND.getContext("2d"); g.translate(-GX0, -GY0);
  // diorama slab
  poly([P(0, MH), P(MW, MH), P(MW, MH, -SLAB), P(0, MH, -SLAB)], "#1a1240");
  poly([P(MW, 0), P(MW, MH), P(MW, MH, -SLAB), P(MW, 0, -SLAB)], "#120c30");
  g.fillStyle = "#35f2ff";
  for (let i = 0; i < MW; i += 2) { const q = P(i + 0.5, MH, -20); g.fillRect(q[0] - 2, q[1] - 1, 4, 2); }
  for (let i = 0; i < MH; i += 2) { const q = P(MW, i + 0.5, -20); g.fillRect(q[0] - 2, q[1] - 1, 4, 2); }
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const k = ground(x, y), d = [P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)];
    let fill = "#1c1934";
    if (k === "H") fill = (x + y) % 2 ? "#2d3870" : "#34417d";
    else if (k === "S") fill = hash(x, y) > 0.8 ? "#17142e" : "#141127";
    else if (k === "G") fill = hash(x, y, 3) > 0.6 ? "#173a34" : "#14322e";
    else if (k === "P") fill = (x + y) % 2 ? "#221a46" : "#261e4f";
    else fill = hash(x, y, 2) > 0.85 ? "#221f3e" : "#1f1c39";
    poly(d, fill);
    g.strokeStyle = k === "H" ? "rgba(140,160,255,.35)" : k === "S" ? "rgba(0,0,0,.25)" : "rgba(90,80,170,.35)";
    g.lineWidth = 1; g.beginPath(); g.moveTo(...d[0]); g.lineTo(...d[1]); g.lineTo(...d[2]); g.stroke();
    if (k === "S" && hash(x, y, 7) > 0.7) { const c = P(x + 0.5, y + 0.5); g.fillStyle = "rgba(120,110,220,.12)"; g.beginPath(); g.ellipse(c[0], c[1], 18, 6, 0, 0, 7); g.fill(); }
    if (k === "P") { const c = P(x + 0.5, y + 0.5); g.strokeStyle = "rgba(53,242,255,.18)"; g.beginPath(); g.moveTo(c[0] - 16, c[1]); g.lineTo(c[0], c[1] - 8); g.lineTo(c[0] + 16, c[1]); g.stroke(); }
  }
  // road markings
  g.fillStyle = "rgba(255,181,71,.7)";
  for (let x = 0; x < MW; x++) if (x !== 10 && x !== 11) { const a = P(x + 0.3, 9), b = P(x + 0.6, 9); g.beginPath(); g.moveTo(a[0], a[1] - 1); g.lineTo(b[0], b[1] - 1); g.lineTo(b[0], b[1] + 1); g.lineTo(a[0], a[1] + 1); g.fill(); }
  for (let y = 0; y < MH; y++) if (y !== 8 && y !== 9) { const a = P(11, y + 0.3), b = P(11, y + 0.6); g.beginPath(); g.moveTo(a[0], a[1] - 1); g.lineTo(b[0], b[1] - 1); g.lineTo(b[0], b[1] + 1); g.lineTo(a[0], a[1] + 1); g.fill(); }
  g.fillStyle = "rgba(223,231,255,.35)";
  for (let k = 0; k < 6; k++) { poly([P(12.1, 8 + k / 3), P(12.9, 8 + k / 3), P(12.9, 8 + k / 3 + 0.16), P(12.1, 8 + k / 3 + 0.16)], "rgba(223,231,255,.3)"); poly([P(10 + k / 3, 10.1), P(10 + k / 3 + 0.16, 10.1), P(10 + k / 3 + 0.16, 10.9), P(10 + k / 3, 10.9)], "rgba(223,231,255,.3)"); }
  // HQ floor guide strips
  g.strokeStyle = "rgba(53,242,255,.45)"; g.lineWidth = 2;
  g.beginPath(); g.moveTo(...P(5, 7)); g.lineTo(...P(5, 3.6)); g.lineTo(...P(9, 3.6)); g.stroke();
  g.beginPath(); g.moveTo(...P(1, 3.6)); g.lineTo(...P(5, 3.6)); g.stroke();
}

/* ---------- crew ---------- */
const crew = [];
const counts = { work: 0, idle: 0, sleep: 0 };
function walkable(x, y) { return x >= 0 && y >= 0 && x < MW && y < MH && !blocked[y][x]; }
function bfs(sx, sy, gx, gy) {
  const key = (x, y) => y * MW + x, prev = new Int32Array(MW * MH).fill(-2), q = [key(sx, sy)];
  prev[q[0]] = -1;
  while (q.length) {
    const k = q.shift(), x = k % MW, y = (k / MW) | 0;
    if (x === gx && y === gy) { const path = []; let c = k; while (c !== -1) { path.push([c % MW, (c / MW) | 0]); c = prev[c]; } return path.reverse().slice(1); }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, nk = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= MW || ny >= MH || prev[nk] !== -2) continue;
      if (!walkable(nx, ny) && !(nx === gx && ny === gy)) continue;
      prev[nk] = k; q.push(nk);
    }
  }
  return null;
}
const HANG = [[13, 12], [12, 12], [15, 10], [13, 10], [3, 10], [8, 10], [12, 6], [16, 7], [6, 4], [2, 5], [0, 11], [16, 13]];
function randFree() { for (;;) { const x = (Math.random() * MW) | 0, y = (Math.random() * MH) | 0; if (walkable(x, y)) return [x, y]; } }

function think(a) {
  const tx = Math.floor(a.x), ty = Math.floor(a.y);
  if (a.status === "work") {
    const [sx, sy, f] = SPOTS[a.slot % SPOTS.length];
    if (tx === sx && ty === sy) { a.mode = "work"; a.face = f; return; }
    if (inHQ(sx, sy) && !inHQ(tx, ty) && Math.random() < 0.6) { a.mode = "tpout"; a.ft = 0; return; }   // called in: beam home
    return goTo(a, sx, sy, () => { a.mode = "work"; a.face = f; });
  }
  if (a.status === "sleep") {
    const ci = a.slot % CAPS.length, [cx, cy] = CAPS[ci];
    return goTo(a, cx, cy, () => { a.mode = "charge"; capUsed[ci] = true; });
  }
  const r = Math.random();
  // out in the city: sometimes beam straight back to the HQ chamber instead of walking
  if (r < 0.18 && !inHQ(tx, ty)) { a.mode = "tpout"; a.ft = 0; return; }
  const [gx, gy] = r < 0.55 ? HANG[(Math.random() * HANG.length) | 0] : randFree();
  goTo(a, gx, gy, () => { a.mode = "idle"; a.wait = 2 + Math.random() * 4; });
}
function goTo(a, gx, gy, done) {
  const p = bfs(Math.floor(a.x), Math.floor(a.y), gx, gy);
  if (!p) { a.mode = "idle"; a.wait = 1; return; }
  if (!p.length) { done(); return; }
  a.path = p; a.done = done; a.mode = "walk";
}
function releaseSlot(a) { if (a.mode === "charge") capUsed[a.slot % CAPS.length] = false; }
function assign() {
  let w = 0, s = 0;
  counts.work = counts.idle = counts.sleep = 0;
  for (const a of crew) {
    counts[a.status]++;
    if (a.status === "work") a.slot = w++; else if (a.status === "sleep") a.slot = s++;
  }
}
function setStatus(a, st) {
  if (a.status === st) return;
  releaseSlot(a); a.status = st;
  if (a.mode !== "tpin" && a.mode !== "tpout") { a.mode = "idle"; a.wait = 0.2 + Math.random(); }
}
function update(a, dt) {
  const T = a.anim.ticks;
  a.ft += dt * 60;
  if (a.mode === "tpin" || a.mode === "tpout") {
    const n = a.anim.seq.tp.length, i = Math.floor(a.ft / (T.tp + 1));
    if (a.mode === "tpin" && a.ft >= 0) chBeam = Math.max(chBeam, 1);
    if (i >= n) {
      if (a.mode === "tpout") { a.x = CH_X; a.y = CH_Y; a.mode = "tpin"; a.ft = -20; }
      else { a.mode = "idle"; a.wait = 0.5; }
    }
    return;
  }
  if (a.mode === "walk") {
    const [nx, ny] = a.path[0], gx = nx + 0.5, gy = ny + 0.5, dx = gx - a.x, dy = gy - a.y, d = Math.hypot(dx, dy), sp = 1.7 * dt;
    if (Math.abs(dx) > Math.abs(dy)) a.face = dx > 0 ? "f" : "bl"; else a.face = dy > 0 ? "fl" : "b";
    if (d <= sp) { a.x = gx; a.y = gy; a.path.shift(); if (!a.path.length) { a.mode = "arrive"; a.done(); if (a.mode === "arrive") { a.mode = "idle"; a.wait = 1; } } }
    else { a.x += dx / d * sp; a.y += dy / d * sp; }
    return;
  }
  if (a.mode === "idle") { a.wait -= dt; if (a.wait <= 0) think(a); return; }
  if ((a.mode === "work" && a.status !== "work") || (a.mode === "charge" && a.status !== "sleep")) { releaseSlot(a); a.mode = "idle"; a.wait = 0.2; }
}
function frameOf(a) {
  const s = a.anim.seq, T = a.anim.ticks, cyc = (arr, k) => arr[Math.floor(a.ft / k) % arr.length];
  if (a.mode === "tpin" || a.mode === "tpout") {
    const n = s.tp.length, i = Math.min(n - 1, Math.floor(a.ft / (T.tp + 1)));
    return [a.mode === "tpin" ? s.tp[i] : s.tp[n - 1 - i], false];
  }
  if (a.mode === "walk") {
    const back = a.face === "b" || a.face === "bl";
    // walkd/backd = optional diagonal sheets (docs/sprite-diagonal.md); fall back to side/back frames
    const seq = back ? s.backd || s.back : s.walkd || s.walk, tk = back ? T.backd || T.back : T.walkd || T.walk;
    return [cyc(seq, tk), a.face === "fl" || a.face === "bl"];
  }
  if (a.mode === "work") return [s.back[Math.floor(t * 2 + a.seed) % 2 ? 0 : 1] ?? s.back[0], a.face === "bl"];
  if (a.mode === "charge") return [s.idle[0], false];
  const blink = (Math.floor(t * 10 + a.seed * 7) % 37) === 0;
  return [blink ? s.blink[0] : cyc(s.idle, T.idle), a.seed > 0.5];
}
function drawAgent(a) {
  if (a.mode === "charge") { /* inside capsule: drawn by its own glass */ }
  const [sx, sy] = P(a.x, a.y, onChamber(a.x, a.y) ? CH_Z : 0);
  const tp = a.mode === "tpin" || a.mode === "tpout";
  if (tp && a.ft < 0) { a.sx = null; return; }
  if (a.mode === "tpout") {
    // beam column wherever they stand (no pad needed any more)
    const k = Math.min(1, a.ft / 30), al = Math.sin(k * Math.PI) * 0.9 + 0.1;
    g.save(); g.globalCompositeOperation = "lighter";
    const gr = g.createLinearGradient(sx - 12, 0, sx + 12, 0); gr.addColorStop(0, "rgba(53,242,255,0)"); gr.addColorStop(0.5, `rgba(200,255,255,${0.55 * al})`); gr.addColorStop(1, "rgba(53,242,255,0)");
    g.fillStyle = gr; g.fillRect(sx - 12, sy - 140, 24, 140);
    g.strokeStyle = `rgba(160,250,255,${0.8 * al})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(sx, sy, 13 + 4 * k, 6 + 2 * k, 0, 0, 7); g.stroke();
    g.restore(); glow(sx, sy, 22, 10, "#35f2ff", 0.6 * al);
  }
  if (!tp) {
    g.fillStyle = "rgba(0,0,0,.45)"; g.beginPath(); g.ellipse(sx, sy, 9, 3.5, 0, 0, 7); g.fill();
    const col = a.status === "work" ? "#5cf08a" : a.status === "idle" ? "#ffb547" : "#7d8cff";
    g.strokeStyle = col; g.globalAlpha = 0.55 + 0.35 * Math.sin(t * 4 + a.seed * 6); g.lineWidth = 2;
    g.beginPath(); g.ellipse(sx, sy, 11, 5, 0, 0, 7); g.stroke(); g.globalAlpha = 1;
  }
  const [f, flip] = frameOf(a);
  const bob = a.mode === "charge" ? -5 + Math.sin(t * 2 + a.seed) * 1.5 : 0;
  g.save(); g.translate(Math.round(sx), Math.round(sy + bob)); if (flip) g.scale(-1, 1);
  if (a.mode === "charge") g.globalAlpha = 0.85;
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
  g.drawImage(a.img, f * 64, 0, 64, 96, -16, -47, 32, 48);
  g.restore();
  a.sx = sx; a.sy = sy;
}


/* ---------- mascot: BIP, the little HQ drone (stays inside the base) ---------- */
const bip = { x: 6.5, y: 4.5, path: [], wait: 1, face: 1, img: null, say: null, spin: 0, sx: null, sy: null };
const inHQ = (x, y) => x >= 1 && x <= 8 && y >= 1 && y <= 6;
function bipPath(sx, sy, gx, gy) {
  const key = (x, y) => y * MW + x, prev = new Map([[key(sx, sy), -1]]), q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    if (x === gx && y === gy) { const out = []; let k = key(x, y); while (k !== -1) { out.push([k % MW, (k / MW) | 0]); k = prev.get(k); } return out.reverse().slice(1); }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = key(nx, ny); if (!inHQ(nx, ny) || blocked[ny][nx] || prev.has(k)) continue; prev.set(k, key(x, y)); q.push([nx, ny]); }
  }
  return null;
}
const BIP_LINES = ["Bip bip!", "Patroli markas aman!", "Lantai bersih, siap!", "Kru, semangat!", "Baterai 100%!", "Bip? Bip!"];
function bipUpdate(dt) {
  if (bip.spin > 0) bip.spin = Math.max(0, bip.spin - dt);
  if (bip.path.length) {
    const [nx, ny] = bip.path[0], gx = nx + 0.5, gy = ny + 0.5, dx = gx - bip.x, dy = gy - bip.y, d = Math.hypot(dx, dy), sp = 1.3 * dt;
    const scr = (dx - dy); if (Math.abs(scr) > 0.01) bip.face = scr > 0 ? -1 : 1;
    if (d <= sp) { bip.x = gx; bip.y = gy; bip.path.shift(); if (!bip.path.length) { bip.wait = 1.5 + Math.random() * 3; if (Math.random() < 0.35) bip.spin = 0.8; if (Math.random() < 0.3) bip.say = { text: BIP_LINES[(Math.random() * BIP_LINES.length) | 0], until: t + 2.5 }; } }
    else { bip.x += dx / d * sp; bip.y += dy / d * sp; }
    return;
  }
  bip.wait -= dt;
  if (bip.wait > 0) return;
  for (let k = 0; k < 20; k++) {
    const gx = 1 + ((Math.random() * 8) | 0), gy = 1 + ((Math.random() * 6) | 0);
    if (blocked[gy][gx]) continue;
    const p = bipPath(Math.floor(bip.x), Math.floor(bip.y), gx, gy);
    if (p && p.length) { bip.path = p; return; }
  }
  bip.wait = 1;
}
function drawBip() {
  if (!bip.img) return;
  const [sx, sy] = P(bip.x, bip.y), hov = 16 + Math.sin(t * 3) * 3;
  g.fillStyle = "rgba(0,0,0,.4)"; g.beginPath(); g.ellipse(sx, sy, 8 - Math.sin(t * 3), 3, 0, 0, 7); g.fill();
  glow(sx, sy, 14, 5, "#35f2ff", 0.35);
  const moving = bip.path.length > 0, tilt = moving ? -0.12 * bip.face : 0;
  const flip = bip.spin > 0 ? Math.cos((0.8 - bip.spin) / 0.8 * Math.PI * 4) : 1;
  g.save(); g.translate(Math.round(sx), Math.round(sy - hov)); g.rotate(tilt); g.scale(bip.face * flip, 1);
  g.drawImage(bip.img, -bip.img.width / 2, -bip.img.height / 2);
  g.restore();
  // thruster puff + blinking antenna light
  glow(sx + 6 * bip.face, sy - hov + 6, 6, 4, "#35f2ff", moving ? 0.8 : 0.4);
  if (Math.sin(t * 5) > 0.3) glow(sx, sy - hov - bip.img.height / 2, 5, 5, "#ff3ea5", 0.9);
  // scan beam while idle
  if (!moving && Math.sin(t * 1.3) > 0.4) {
    g.save(); g.globalCompositeOperation = "lighter"; g.fillStyle = "rgba(53,242,255,.12)";
    g.beginPath(); g.moveTo(sx - 3 * bip.face, sy - hov); g.lineTo(sx - 18 * bip.face, sy + 2); g.lineTo(sx + 2 * bip.face, sy + 4); g.closePath(); g.fill(); g.restore();
  }
  bip.sx = sx; bip.sy = sy - hov;
}

/* ---------- traffic + drones ---------- */
/* hover vehicles: tiny lofted meshes, back-face culled and light-shaded */
const ring6 = (w, zb, zm, zt) => [[-w, zb], [w, zb], [w, zm], [w * 0.78, zt], [-w * 0.78, zt], [-w, zm]];
const ring4 = (w, zb, zt, k = 0.62) => [[-w, zb], [w, zb], [w * k, zt], [-w * k, zt]];
function loft(rings) {
  const faces = [], n = rings[0].p.length;
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < n; j++) {
    const a = rings[i], b = rings[i + 1], k = (j + 1) % n;
    faces.push([[a.l, ...a.p[j]], [a.l, ...a.p[k]], [b.l, ...b.p[k]], [b.l, ...b.p[j]]]);
  }
  const f = rings[0], e = rings[rings.length - 1];
  faces.push(f.p.map((q) => [f.l, ...q]), e.p.map((q) => [e.l, ...q]));
  return faces;
}
const MESH = {
  sleek: [
    { part: "pod", faces: loft([{ l: -0.36, p: ring4(0.27, 1, 6, 1) }, { l: 0.12, p: ring4(0.26, 1.5, 5, 1) }]) },
    { part: "body", faces: loft([{ l: -0.46, p: ring6(0.18, 3, 11, 14) }, { l: -0.22, p: ring6(0.21, 0, 10, 13) }, { l: 0.18, p: ring6(0.2, 0, 7, 9) }, { l: 0.47, p: ring6(0.1, 3, 5, 6) }]) },
    { part: "glass", faces: loft([{ l: -0.25, p: ring4(0.14, 12, 19) }, { l: -0.02, p: ring4(0.15, 11, 20) }, { l: 0.2, p: ring4(0.13, 8.5, 9.5, 0.9) }]) },
    { part: "trim", faces: loft([{ l: -0.5, p: ring4(0.24, 13, 17, 1) }, { l: -0.41, p: ring4(0.24, 14, 18, 1) }]) },
  ],
  van: [
    { part: "pod", faces: loft([{ l: -0.44, p: ring4(0.25, -1, 4, 1) }, { l: 0.3, p: ring4(0.25, -1, 3, 1) }]) },
    { part: "body", faces: loft([{ l: -0.5, p: ring6(0.22, 2, 25, 27) }, { l: 0.22, p: ring6(0.22, 1, 25, 27) }, { l: 0.36, p: ring6(0.21, 1, 13, 15) }, { l: 0.5, p: ring6(0.18, 3, 7, 8) }]) },
    { part: "glass", faces: loft([{ l: 0.22, p: ring4(0.2, 14, 25, 0.95) }, { l: 0.36, p: ring4(0.19, 13, 15, 0.95) }]) },
  ],
};
const LIGHT = (() => { const v = [0.15, 0.55, 1], m = Math.hypot(...v); return v.map((c) => c / m); })();
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function shade(hex, k, a = 1) { const [r, gg, b] = rgb(hex); return `rgba(${Math.min(255, r * k) | 0},${Math.min(255, gg * k) | 0},${Math.min(255, b * k) | 0},${a})`; }
function drawMesh(parts, map, cols) {
  for (const pt of parts) {
    const all = pt.faces.flat().map(map), pc = [0, 1, 2].map((i) => all.reduce((s, v) => s + v[i], 0) / all.length);
    for (const f of pt.faces) {
      let w = f.map(map);
      const U = (v) => [v[0] * 45, v[1] * 45, v[2]];
      const a = U(w[0]), b = U(w[1]), c = U(w[2]);
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const fc = [0, 1, 2].map((i) => w.reduce((s, v) => s + v[i], 0) / w.length), pu = U(pc), fu = U(fc);
      if (n[0] * (fu[0] - pu[0]) + n[1] * (fu[1] - pu[1]) + n[2] * (fu[2] - pu[2]) < 0) { w = w.slice().reverse(); n = n.map((q) => -q); }
      const s = w.map((v) => P(v[0], v[1], v[2]));
      let area = 0; for (let i = 0; i < s.length; i++) { const p = s[i], q = s[(i + 1) % s.length]; area += p[0] * q[1] - q[0] * p[1]; }
      if (area <= 0.5) continue;
      const m = Math.hypot(...n) || 1, d = (n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]) / m, k = 0.5 + 0.6 * Math.max(0, d);
      const [hex, alpha] = cols[pt.part];
      poly(s, shade(hex, k, alpha));
      if (pt.part === "glass") { g.strokeStyle = "rgba(200,255,255,.5)"; g.lineWidth = 0.75; g.beginPath(); g.moveTo(...s[0]); for (const q of s.slice(1)) g.lineTo(...q); g.closePath(); g.stroke(); }
    }
  }
}
const cars = [
  { lane: "x", y: 8.5, dir: 1, off: 0, kind: "sleek", body: "#e8eeff", acc: "#ff3ea5", sp: 3.2 },
  { lane: "x", y: 9.5, dir: -1, off: 9, kind: "van", body: "#ffb547", acc: "#35f2ff", sp: 2.1, label: "POS" },
  { lane: "y", x: 10.5, dir: 1, off: 4, kind: "sleek", body: "#2c2470", acc: "#35f2ff", sp: 2.9 },
  { lane: "y", x: 11.5, dir: -1, off: 14, kind: "sleek", body: "#3b6cff", acc: "#dfe7ff", sp: 3.6 },
];
function carPos(c) {
  const L = (c.lane === "x" ? MW : MH) + 6, s = ((t * c.sp + c.off) % L) - 3, v = c.dir > 0 ? s : L - 6 - s;
  return c.lane === "x" ? [v, c.y] : [c.x, v];
}
function drawCar(c, x, y) {
  const lx = c.lane === "x", d = c.dir, z0 = 13 + Math.sin(t * 3 + c.off) * 1.5;
  const map = ([l, s, z]) => (lx ? [x + l * d, y + s * d, z + z0] : [x + s * -d, y + l * d, z + z0]);
  const W = (l, s, z) => { const m = map([l, s, z]); return P(m[0], m[1], m[2]); };
  // light trail on the wet road, then shadow + underglow
  const tr0 = P(...map([-0.4, 0, -z0]).slice(0, 2)), tr1 = P(...map([-2.2, 0, -z0]).slice(0, 2));
  const gr = g.createLinearGradient(tr0[0], tr0[1], tr1[0], tr1[1]); gr.addColorStop(0, shade(c.acc, 1, 0.45)); gr.addColorStop(1, shade(c.acc, 1, 0));
  g.strokeStyle = gr; g.lineWidth = 3; g.beginPath(); g.moveTo(...tr0); g.lineTo(...tr1); g.stroke();
  const sh = P(x, y); g.fillStyle = "rgba(0,0,0,.45)"; g.beginPath(); g.ellipse(sh[0], sh[1], 22, 9, 0, 0, 7); g.fill();
  glow(sh[0], sh[1], 30, 12, c.acc, 0.45 + 0.15 * Math.sin(t * 6 + c.off));
  // hover pads
  for (const [l, s] of [[-0.3, -0.2], [-0.3, 0.2], [0.25, -0.18], [0.25, 0.18]]) { const p = W(l, s, 0); glow(p[0], p[1], 7, 4, c.acc, 0.9); }
  drawMesh(MESH[c.kind], map, { body: [c.body, 1], glass: ["#35f2ff", 0.55], trim: [c.acc, 1], pod: ["#2a2357", 1] });
  // neon side stripe on the side facing the viewer
  const sideS = (() => { const a = map([0, 0.3, 0]), b = map([0, -0.3, 0]); return a[0] + a[1] > b[0] + b[1] ? 1 : -1; })();
  const ws = c.kind === "van" ? 0.225 : 0.205;
  const s0 = W(-0.42, ws * sideS, c.kind === "van" ? 6 : 8), s1 = W(c.kind === "van" ? 0.34 : 0.3, ws * sideS, c.kind === "van" ? 6 : 7);
  g.save(); g.strokeStyle = c.acc; g.shadowColor = c.acc; g.shadowBlur = 6; g.lineWidth = 1.5; g.beginPath(); g.moveTo(...s0); g.lineTo(...s1); g.stroke(); g.restore();
  if (c.label) {
    const a = W(-0.3, 0.226 * sideS, 14), b = W(0.1, 0.226 * sideS, 14), [L0, L1] = a[0] < b[0] ? [a, b] : [b, a];
    const slope = (L1[1] - L0[1]) / (L1[0] - L0[0] || 1);
    g.save(); g.transform(1, slope, 0, 1, L0[0], L0[1]); g.font = '5px "PS2P"'; g.textBaseline = "middle"; g.fillStyle = "#14051f"; g.fillText(c.label, 2, 0); g.restore();
  }
  // headlights, tail lights, thruster flame
  for (const s of [-0.08, 0.08]) { const h = W(0.48, s, 5); glow(h[0], h[1], 10, 6, "#ffffff", 0.85); g.fillStyle = "#fff"; g.fillRect(h[0] - 1, h[1] - 1, 2, 2); }
  for (const s of [-0.14, 0.14]) { const r = W(c.kind === "van" ? -0.51 : -0.47, s, 9); glow(r[0], r[1], 7, 5, "#ff2a55", 0.9); }
  const fl = 0.7 + 0.3 * Math.sin(t * 40 + c.off), th = W(-0.55, 0, 4), th2 = W(-0.55 - 0.18 * fl, 0, 4);
  g.save(); g.globalCompositeOperation = "lighter"; g.strokeStyle = shade(c.acc, 1, 0.9); g.lineWidth = 4; g.lineCap = "round"; g.beginPath(); g.moveTo(...th); g.lineTo(...th2); g.stroke(); g.restore();
  glow(th[0], th[1], 10, 7, c.acc, 0.7);
}
const drones = [0, 1, 2].map((i) => ({ i, cx: 5 + i * 4, cy: 4 + i * 3, rx: 3 + i, ry: 2.5 + i, sp: 0.25 + i * 0.07 }));
function drawDrone(d) {
  const a = t * d.sp + d.i * 2, x = d.cx + Math.cos(a) * d.rx, y = d.cy + Math.sin(a * 1.3) * d.ry, z = 230 + Math.sin(t * 2 + d.i) * 8;
  const sh = P(x, y); g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(sh[0], sh[1], 10, 4, 0, 0, 7); g.fill();
  const p = P(x, y, z);
  g.fillStyle = "#cfd9ff"; g.fillRect(p[0] - 7, p[1] - 3, 14, 6); g.fillStyle = "#3b6cff"; g.fillRect(p[0] - 4, p[1] + 3, 8, 3);
  g.fillStyle = "rgba(223,231,255,.6)"; const w = 6 + Math.abs(Math.sin(t * 40)) * 4; g.fillRect(p[0] - 9 - w / 2, p[1] - 5, w, 1); g.fillRect(p[0] + 9 - w / 2, p[1] - 5, w, 1);
  if (Math.sin(t * 6 + d.i) > 0) glow(p[0], p[1] + 4, 8, 8, d.i === 1 ? "#ff3ea5" : "#35f2ff", 0.9);
  g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.08; g.fillStyle = "#35f2ff";
  g.beginPath(); g.moveTo(p[0] - 3, p[1] + 6); g.lineTo(p[0] + 3, p[1] + 6); g.lineTo(sh[0] + 20, sh[1]); g.lineTo(sh[0] - 20, sh[1]); g.closePath(); g.fill(); g.restore();
}

/* ---------- rain ---------- */
let rainOn = !RM;
const drops = Array.from({ length: 170 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.6 }));
const splashes = [];

/* ---------- camera + main loop ---------- */
const cv = document.getElementById("city"), cx = cv.getContext("2d");
const cam = { x: P(MW / 2, MH / 2)[0], y: P(MW / 2, MH / 2)[1] - 60, z: 1 };
/* smooth camera pan (clicking a crew member / BIP): eases over PAN_S instead of snapping, so the city doesn't "jump".
   Target is a world point (wx, wy) that should land at screen (VW/2, sy); recomputed every frame so zoom changes stay correct. */
const PAN_S = 0.35;
let pan = null;
function panTo(wx, wy, sy = VH / 2) {
  if (matchMedia("(prefers-reduced-motion:reduce)").matches) { cam.x = clampCX(wx); cam.y = clampCY(wy - (sy - VH / 2) / cam.z); pan = null; return; }
  pan = { fx: cam.x, fy: cam.y, wx, wy, sy, k: 0 };
}
function panStep(dt) {
  if (!pan) return;
  pan.k = Math.min(1, pan.k + Math.min(dt, 1 / 30) / PAN_S);   // a slow frame (dialog/portrait decode) must not skip half the pan
  const k = pan.k, e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;   // ease-in-out cubic: no sudden first step
  // target is clamped to the scene (start point already is), so the eased path never leaves the base and never overshoots an edge
  const tx = clampCX(pan.wx), ty = clampCY(pan.wy - (pan.sy - VH / 2) / cam.z);
  cam.x = pan.fx + (tx - pan.fx) * e; cam.y = pan.fy + (ty - pan.fy) * e;
  if (pan.k >= 1) pan = null;
}
let VW = 0, VH = 0, DPR = 1;
function resize() { DPR = Math.min(2, devicePixelRatio || 1); VW = cv.clientWidth; VH = cv.clientHeight; cv.width = VW * DPR; cv.height = VH * DPR; }
/* ---------- zoom limits + pan clamp ----------
   SCENE = world-space box of everything drawn (ground slab + tallest towers, measured), padded a few px.
   Min zoom: the base must fill the screen. "contain" (whole base visible) is used on landscape screens; on tall/narrow
   screens contain would leave huge empty bands above/below, so it is raised to 75% of "cover" there.
   Max zoom 4 (unchanged). Buttons + wheel move between ZSTEPS discrete levels; pinch is continuous but clamped. */
const SCENE = { x0: -452, y0: -176, x1: 548, y1: 546 }, SW = SCENE.x1 - SCENE.x0, SH = SCENE.y1 - SCENE.y0;
const ZMAX = 4, ZSTEPS = 5, PAN_SLACK = 40;   // PAN_SLACK: screen px the base may be pushed past the edge (panels overlap the edges)
let zMin = 1, zLevels = [1, ZMAX], zAnim = null;
function zoomLimits() {
  if (!VW || !VH) return;
  const contain = Math.min(VW / SW, VH / SH), cover = Math.max(VW / SW, VH / SH);
  zMin = Math.min(ZMAX, Math.max(contain, cover * 0.75));
  zLevels = Array.from({ length: ZSTEPS }, (_, i) => zMin * Math.pow(ZMAX / zMin, i / (ZSTEPS - 1)));
}
const clampZ = (z) => Math.max(zMin, Math.min(ZMAX, z));
// camera centre limits for the current zoom: the view may not leave the scene box (+ slack); if the view is
// larger than the scene on an axis the camera is locked to the scene centre on that axis
const clampAx = (v, a0, a1, half) => { const s = PAN_SLACK / cam.z; return half * 2 >= a1 - a0 + 2 * s ? (a0 + a1) / 2 : Math.max(a0 - s + half, Math.min(a1 + s - half, v)); };
const clampCX = (x) => clampAx(x, SCENE.x0, SCENE.x1, VW / 2 / cam.z);
const clampCY = (y) => clampAx(y, SCENE.y0, SCENE.y1, VH / 2 / cam.z);
function clampCam() { cam.z = clampZ(cam.z); cam.x = clampCX(cam.x); cam.y = clampCY(cam.y); }
function zoomTo(z) {   // short eased zoom about the screen centre
  z = clampZ(z);
  if (Math.abs(z - cam.z) < 1e-4) { zAnim = null; cam.z = z; zoomUI(); return; }
  if (matchMedia("(prefers-reduced-motion:reduce)").matches) { cam.z = z; zAnim = null; clampCam(); zoomUI(); return; }
  zAnim = { f: cam.z, to: z, k: 0 }; zoomUI();
}
function zoomStep(dir) {   // next discrete level above/below where we are (or are heading)
  const cur = zAnim ? zAnim.to : cam.z, eps = 1e-3;
  const next = dir > 0 ? zLevels.find((l) => l > cur * (1 + eps)) : [...zLevels].reverse().find((l) => l < cur * (1 - eps));
  if (next != null) zoomTo(next);
}
function zoomAnimStep(dt) {
  if (!zAnim) return;
  zAnim.k = Math.min(1, zAnim.k + Math.min(dt, 1 / 30) / 0.18);
  const k = zAnim.k, e = 1 - Math.pow(1 - k, 3);
  cam.z = zAnim.f * Math.pow(zAnim.to / zAnim.f, e);   // geometric interpolation feels even at every zoom
  if (zAnim.k >= 1) { cam.z = zAnim.to; zAnim = null; }
}
let zUI = "";
function zoomUI() {
  const z = zAnim ? zAnim.to : cam.z, st = (z <= zMin * 1.001 ? "a" : "") + (z >= ZMAX * 0.999 ? "b" : "");
  if (st === zUI) return; zUI = st;
  document.getElementById("zOut").disabled = st.includes("a");
  document.getElementById("zIn").disabled = st.includes("b");
}
function fit() {
  const wpx = (MW + MH) * 32 + 40, hpx = (MW + MH) * 16 + 320;
  zAnim = null; pan = null;
  cam.z = clampZ(Math.min(2, Math.max(Math.min(VW / wpx, VH / hpx) * 1.25, VW < 720 ? 0.95 : 0)));
  cam.x = P(MW / 2, MH / 2)[0]; cam.y = P(MW / 2, MH / 2)[1] - 90; clampCam(); zoomUI();
}
function onResize() { resize(); zoomLimits(); if (zAnim) zAnim.to = clampZ(zAnim.to); clampCam(); zUI = ""; zoomUI(); }
const sky = { stars: Array.from({ length: 90 }, () => [Math.random(), Math.random() * 0.6, Math.random()]), city: Array.from({ length: 40 }, (_, i) => [i / 40, 0.12 + hash(i, 3) * 0.32, hash(i, 5)]) };
function drawSky() {
  const S = SKY, gr = cx.createLinearGradient(0, 0, 0, VH); gr.addColorStop(0, S.sky[0]); gr.addColorStop(0.55, S.sky[1]); gr.addColorStop(1, S.sky[2]);
  cx.fillStyle = gr; cx.fillRect(0, 0, VW, VH);
  if (S.stars) for (const [x, y, k] of sky.stars) { cx.fillStyle = `rgba(220,220,255,${S.stars * (0.3 + 0.5 * Math.abs(Math.sin(t * (0.5 + k) + k * 9)))})`; cx.fillRect(x * VW, y * VH, 1.5, 1.5); }
  { const bx = VW * 0.78, by = VH * (S.k === "day" ? 0.14 : 0.3), r = S.body === "sun" ? 26 : 18, col = S.body === "sun" ? (S.k === "dusk" ? "#ffb07a" : "#fff3c4") : "#e9e6ff";
    const hg = cx.createRadialGradient(bx, by, r * 0.5, bx, by, r * 4); hg.addColorStop(0, col + "66"); hg.addColorStop(1, col + "00"); cx.fillStyle = hg; cx.fillRect(bx - r * 4, by - r * 4, r * 8, r * 8);
    cx.fillStyle = col; cx.beginPath(); cx.arc(bx, by, r, 0, 7); cx.fill();
    if (S.body === "moon") { cx.fillStyle = S.sky[0]; cx.beginPath(); cx.arc(bx + r * 0.45, by - r * 0.2, r * 0.85, 0, 7); cx.fill(); } }
  const par = -cam.x * cam.z * 0.12;
  for (let layer = 0; layer < 2; layer++) {
    cx.fillStyle = SKY.city[layer];
    for (const [x, h, k] of sky.city) {
      const bw = 28 + k * 40, bx = (((x * (VW + 300) + par * (layer + 1)) % (VW + 300)) + VW + 300) % (VW + 300) - 150, bh = VH * h * (layer ? 0.7 : 1);
      cx.fillRect(bx + layer * 20, VH * 0.62 - bh, bw, bh + VH);
      if (layer) for (let wy = 0; wy < bh; wy += 9) if (hash(x * 50, wy) > 0.8 + (1 - SKY.neon) * 0.15) { cx.fillStyle = hash(x, wy) > 0.5 ? "rgba(255,62,165,.5)" : "rgba(53,242,255,.4)"; cx.fillRect(bx + 26 + (hash(wy, x) * (bw - 10)), VH * 0.62 - bh + wy, 3, 2); cx.fillStyle = SKY.city[1]; }
    }
  }
}
function render(dt) {
  zoomAnimStep(dt);
  panStep(dt);
  clampCam();
  t += RM ? dt * 0.3 : dt;
  chBeam = Math.max(0, chBeam - dt * 0.8);
  for (const a of crew) update(a, dt);
  bipUpdate(dt);
  cx.setTransform(DPR, 0, 0, DPR, 0, 0); cx.imageSmoothingEnabled = false;
  drawSky();
  g = cx;
  cx.setTransform(DPR * cam.z, 0, 0, DPR * cam.z, DPR * (VW / 2 - cam.x * cam.z), DPR * (VH / 2 - cam.y * cam.z));
  cx.imageSmoothingEnabled = false;
  cx.drawImage(GROUND, GX0, GY0);
  // wet neon reflections that breathe
  glow(...P(15, 12), 140, 70, "#35f2ff", 0.08 + 0.03 * Math.sin(t * 3));
  // depth-sorted world objects
  const objs = statics.slice();
  for (const a of crew) objs.push({ x0: a.x - 0.2, y0: a.y - 0.2, x1: a.x + 0.2, y1: a.y + 0.2, draw: () => drawAgent(a) });
  objs.push({ x0: bip.x - 0.15, y0: bip.y - 0.15, x1: bip.x + 0.15, y1: bip.y + 0.15, draw: drawBip });
  for (const c of cars) { const [x, y] = carPos(c); objs.push({ x0: x - 0.4, y0: y - 0.4, x1: x + 0.4, y1: y + 0.4, draw: () => drawCar(c, x, y) }); }
  for (const o of sortIso(objs)) o.draw();
  for (const d of drones) drawDrone(d);
  if (SKY.wash) { cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0); cx.globalCompositeOperation = "screen"; cx.fillStyle = SKY.wash; cx.fillRect(0, 0, cv.width, cv.height); cx.restore(); }
  if (rainOn) {
    if (Math.random() < 0.9) splashes.push({ x: Math.random() * MW, y: Math.random() * MH, t: 0 });
    for (let i = splashes.length - 1; i >= 0; i--) {
      const s = splashes[i]; s.t += dt; if (s.t > 0.35) { splashes.splice(i, 1); continue; }
      const p = P(s.x, s.y); cx.strokeStyle = `rgba(170,200,255,${0.5 - s.t})`; cx.lineWidth = 1; cx.beginPath(); cx.ellipse(p[0], p[1], 3 + s.t * 18, 1.5 + s.t * 8, 0, 0, 7); cx.stroke();
    }
  }
  // screen-space overlays
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (rainOn) {
    cx.strokeStyle = "rgba(170,190,255,.35)"; cx.lineWidth = 1; cx.beginPath();
    for (const d of drops) { d.y += dt * d.s * 1.4; d.x -= dt * d.s * 0.25; if (d.y > 1) { d.y -= 1; d.x = Math.random() * 1.2; } if (d.x < 0) d.x += 1.2; const x = d.x * VW, y = d.y * VH; cx.moveTo(x, y); cx.lineTo(x - 3, y + 12 * d.s); }
    cx.stroke();
  }
  const sc = (wx, wy) => [VW / 2 + (wx - cam.x) * cam.z, VH / 2 + (wy - cam.y) * cam.z];
  cx.textAlign = "center"; cx.textBaseline = "middle";
  for (const a of crew) {
    if (a.mode === "tpout" || a.mode === "tpin") continue;
    const [x, y] = sc(a.sx, a.sy - 52 + (a.mode === "charge" ? -16 : 0));
    cx.font = `7px "PS2P"`; const w = cx.measureText(a.def.name).width + 10;
    cx.fillStyle = "rgba(7,5,26,.8)"; cx.fillRect(x - w / 2, y - 7, w, 13);
    cx.fillStyle = a.def.accent; cx.fillRect(x - w / 2, y + 5, w, 1);
    cx.fillStyle = "#fff"; cx.fillText(a.def.name, x, y);
    if (a.mode === "work" && Math.sin(t * 2 + a.seed * 9) > 0.2) { cx.font = `8px "PS2P"`; cx.fillStyle = "#5cf08a"; cx.shadowColor = "#5cf08a"; cx.shadowBlur = 8; cx.fillText(a.def.emotes?.work || "!", x, y - 16 - (t * 8 % 6)); cx.shadowBlur = 0; }
    if (a.say && a.say.until > t) {
      cx.font = `15px "Pixelify"`; const tw = Math.min(220, cx.measureText(a.say.text).width + 16);
      cx.fillStyle = "#dfe7ff"; cx.fillRect(x - tw / 2, y - 44, tw, 24); cx.fillStyle = "#07051a"; cx.fillText(a.say.text, x, y - 32, tw - 10);
      cx.fillStyle = "#dfe7ff"; cx.fillRect(x - 3, y - 20, 6, 5);
    }
  }
  if (bip.sx != null) {
    const [x, y] = sc(bip.sx, bip.sy - 20);
    cx.font = `6px "PS2P"`; const w = cx.measureText("BIP").width + 8;
    cx.fillStyle = "rgba(7,5,26,.8)"; cx.fillRect(x - w / 2, y - 6, w, 11); cx.fillStyle = "#ffb547"; cx.fillRect(x - w / 2, y + 4, w, 1); cx.fillStyle = "#fff"; cx.fillText("BIP", x, y);
    if (bip.say && bip.say.until > t) {
      cx.font = `15px "Pixelify"`; const tw = cx.measureText(bip.say.text).width + 16;
      cx.fillStyle = "#dfe7ff"; cx.fillRect(x - tw / 2, y - 40, tw, 24); cx.fillStyle = "#07051a"; cx.fillText(bip.say.text, x, y - 28); cx.fillStyle = "#dfe7ff"; cx.fillRect(x - 3, y - 16, 6, 5);
    }
  }
}
function sortIso(list) {
  const n = list.length, front = (a, b) => a.x0 >= b.x1 - 1e-3 || a.y0 >= b.y1 - 1e-3;
  const behind = list.map(() => []);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j) {
    const A = list[i], B = list[j];
    if (A.back) { if (!B.back) behind[j].push(i); continue; }
    if (B.back) continue;
    if (front(A, B) && !front(B, A)) behind[i].push(j);
    else if (!front(A, B) && !front(B, A) && (A.x0 + A.x1 + A.y0 + A.y1) > (B.x0 + B.x1 + B.y0 + B.y1)) behind[i].push(j);
  }
  const out = [], mark = new Uint8Array(n);
  const visit = (i) => { if (mark[i]) return; mark[i] = 1; for (const j of behind[i]) visit(j); out.push(list[i]); };
  for (let i = 0; i < n; i++) visit(i);
  return out;
}

/* ---------- input ---------- */
const ptrs = new Map(); let drag = null, moved = 0, pinch0 = 0;
cv.addEventListener("pointerdown", (e) => { pan = null; zAnim = null; cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y }; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]) / cam.z; } cv.classList.add("drag"); });
cv.addEventListener("pointermove", (e) => {
  if (!ptrs.has(e.pointerId)) { cv.classList.toggle("hover", !!hit(e)); return; }
  ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; cam.z = clampZ(Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch0); clampCam(); zoomUI(); moved = 99; return; }
  if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved = Math.max(moved, Math.abs(dx) + Math.abs(dy)); cam.x = clampCX(drag.cx - dx / cam.z); cam.y = clampCY(drag.cy - dy / cam.z); }
});
const up = (e) => { ptrs.delete(e.pointerId); cv.classList.remove("drag"); if (moved < 6) { const a = hit(e); if (a) pick(a); } drag = ptrs.size ? drag : null; };
cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", (e) => { ptrs.delete(e.pointerId); drag = null; });
// wheel = discrete levels too; trackpads fire dozens of small events, so accumulate and allow one step per 160 ms
let wheelAcc = 0, wheelT = 0;
cv.addEventListener("wheel", (e) => {
  e.preventDefault();
  const d = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * VH : e.deltaY, now = performance.now();
  if (Math.sign(d) !== Math.sign(wheelAcc)) wheelAcc = 0;
  wheelAcc += d;
  if (Math.abs(wheelAcc) < 40 || now - wheelT < 160) return;
  zoomStep(wheelAcc < 0 ? 1 : -1); wheelAcc = 0; wheelT = now;
}, { passive: false });
function hit(e) {
  const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
  const wx = cam.x + (mx - VW / 2) / cam.z, wy = cam.y + (my - VH / 2) / cam.z;
  let best = null;
  for (const a of crew) if (a.sx != null && Math.abs(wx - a.sx) < 12 && wy < a.sy + 4 && wy > a.sy - 48) if (!best || a.sy > best.sy) best = a;
  if (bip.sx != null && Math.abs(wx - bip.sx) < 14 && Math.abs(wy - bip.sy) < 14) return bip;
  return best;
}
document.getElementById("zIn").onclick = () => zoomStep(1);
document.getElementById("zOut").onclick = () => zoomStep(-1);
document.getElementById("fit").onclick = fit;
const rainBtn = document.getElementById("rain"); rainBtn.setAttribute("aria-pressed", rainOn);
rainBtn.onclick = () => { rainOn = !rainOn; rainBtn.setAttribute("aria-pressed", rainOn); };
/* ---------- status (status.json + summaries.json, sama seperti versi lama) ---------- */
const Q = new URLSearchParams(location.search), DEMO = Q.has("demo");
const MIN = 60000, POLL_MS = 60000, SLEEP_AFTER_H = 48;
const DATA_META = document.querySelector('meta[name="vmx-data"]');
let DATA_BASE = DATA_META ? DATA_META.content : null; // null = deteksi otomatis ("" lalu "../")
let LIVE = null, SUMS = null, ERR = null;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function relTime(ms) { if (!ms) return "belum ada data"; const m = Math.floor((Date.now() - ms) / MIN); if (m < 1) return "barusan"; if (m < 60) return m + " menit lalu"; const h = Math.floor(m / 60); if (h < 24) return h + " jam lalu"; return Math.floor(h / 24) + " hari lalu"; }
function wib(ms) { try { return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms)) + " WIB"; } catch (e) { return ""; } }
function demoStatus() {
  const now = Date.now(), h = 3600000;
  const m = { nerd: ["Online", now - 3 * MIN, "Bikin markas Neo HQ isometrik"], kurir: ["On mission", now - 40 * MIN, "Ngumpulin lowongan frontend"], sisotoy: ["Standby", now - 5 * h, ""], alcapone: ["Online", now - 8 * MIN, "Review rencana minggu ini"], kuku: ["Standby", now - 20 * h, ""], makelar: ["Offline", null, ""], jack: ["Standby", null, ""] };
  const agents = {}; for (const [k, [status, lastActive, summary]] of Object.entries(m)) agents[k] = { status, lastActive, summary };
  return { generatedAt: now, agents };
}
function classify(id) {
  const r = LIVE && LIVE.agents && typeof LIVE.agents === "object" ? LIVE.agents[id] : null;
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
  return { mode, label, lastActive: la, summary, raw: st };
}
async function fetchJSON(u) { const res = await fetch(u + "?t=" + Date.now(), { cache: "no-store" }); if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); }
async function fetchStatus() {
  if (DATA_BASE !== null) return fetchJSON(DATA_BASE + "status.json");
  let err;
  for (const b of ["", "../"]) { try { const j = await fetchJSON(b + "status.json"); DATA_BASE = b; return j; } catch (e) { err = e; } }
  throw err;
}
async function loadStatus() {
  if (DEMO) { LIVE = demoStatus(); ERR = null; }
  else {
    try { const j = await fetchStatus(); if (!j || typeof j !== "object" || typeof j.agents !== "object") throw new Error("format salah"); LIVE = j; ERR = null; }
    catch (e) { ERR = e instanceof SyntaxError ? "JSON rusak" : (e.message || "gagal"); }
    try { SUMS = await fetchJSON((DATA_BASE || "") + "summaries.json"); } catch (e) { }
  }
  for (const a of crew) { a.info = classify(a.id); a.summary = a.info.summary; setStatus(a, a.info.mode); }
  assign(); paintUI(); renderSync();
  if (SEL && SEL !== bip) renderInfo(SEL);
}
function renderSync() {
  const el = document.getElementById("sync");
  if (DEMO) { el.className = "sync warn"; el.innerHTML = 'Mode demo (status contoh) · <a href="./">pakai data asli</a> · ' + SKY.label; return; }
  if (!LIVE) { el.className = "sync bad"; el.textContent = "Status nggak kebaca (" + (ERR || "memuat") + ")"; return; }
  const gen = typeof LIVE.generatedAt === "number" ? LIVE.generatedAt : null, stale = gen && (Date.now() - gen) / MIN > 90;
  el.className = "sync " + (stale ? "warn" : "ok");
  el.textContent = (gen ? "Sync: " + wib(gen) + " (" + relTime(gen) + ")" : "Sync: waktu nggak diketahui") + (ERR ? " · refresh gagal" : "") + " · " + SKY.label;
}

/* ---------- panel kru + info ---------- */
const info = document.getElementById("info");
let SEL = null;
document.getElementById("infoX").onclick = () => { info.hidden = true; SEL = null; document.querySelectorAll(".crew li").forEach((l) => l.classList.remove("sel")); };
const SLBL = { work: "KERJA", idle: "STANDBY", sleep: "OFFLINE" };
const WHERE = (a) => (a.mode === "tpin" || a.mode === "tpout" ? "Lagi teleport…" : a.mode === "work" ? "Command Center markas" : a.mode === "charge" ? "Kapsul charge" : a.mode === "walk" ? (a.status === "work" ? "Jalan ke Command Center" : a.status === "sleep" ? "Jalan ke kapsul charge" : "Jalan-jalan di kota") : "Nongkrong di kota");
function renderInfo(a) {
  const I = a.info || { label: SLBL[a.status], lastActive: null, summary: "", raw: "" };
  document.getElementById("infoBody").innerHTML = `<img src="assets/sprites/${a.id}_portrait.png" alt="Potret ${esc(a.def.name)}"><div><h3 style="color:${a.def.accent}">${esc(a.def.name)}</h3><p>${esc(a.def.title)} · <span class="c-${a.status}">${esc(I.label)}</span></p></div>
    <div class="rows">
      <div><b>AKTIF</b><span>${I.lastActive ? esc(relTime(I.lastActive)) + " · " + esc(wib(I.lastActive)) : "belum ada data"}</span></div>
      <div><b>TUGAS</b><span>${I.summary ? esc(I.summary) : "belum ada ringkasan"}</span></div>
      <div><b>LOKASI</b><span>${esc(WHERE(a))}</span></div>
      ${I.raw ? `<div><b>STATUS</b><span>${esc(I.raw)} (status.json)</span></div>` : ""}
      <div><b>GAYA</b><span>${esc(LOOKS[a.id] || "")}</span></div>
    </div>
    <p class="hint">${DEMO ? "Mode demo: status contoh, bukan data asli." : "Data dari status.json, dicek tiap 60 detik."} Klik karakternya buat nyapa.</p>`;
}
/* the crew dialog hides the crew list / profile card while it is open; closing it must only remove the dialog:
   no camera pan back, no profile card popping up, no crew list collapsing (that read as "the page jumps" on close).
   So a crew pick leaves the panels exactly as they were before the dialog opened; INFO_KEEP = was the card visible then. */
let INFO_KEEP = false;
function pick(a) {
  SEL = a;
  if (a === bip) {
    if (SMALL.matches) setCrew(false);
    closeDialog();
    bip.say = { text: BIP_LINES[(Math.random() * BIP_LINES.length) | 0], until: t + 3 }; bip.spin = 0.8;
    document.getElementById("infoBody").innerHTML = `<img src="assets/props/drone.png" alt="" style="object-fit:contain;padding:6px"><div><h3 style="color:#ffb547">BIP</h3><p>maskot markas · <span class="c-work">PATROLI</span></p><p>Drone kecil penjaga Hunter Base. Cuma keliling di dalam markas, kadang muter dan nyapa kru.</p></div>`;
    info.hidden = false; document.querySelectorAll(".crew li").forEach((l) => l.classList.toggle("sel", l.dataset.id === "bip"));
    if (bip.sx != null) panTo(bip.sx, bip.sy - 20); return;
  }
  a.say = null;   // the NPC dialog below replaces the little speech bubble for crew clicks
  if (!dialogOpen()) INFO_KEEP = !info.hidden;   // switching agent inside an open dialog keeps the first answer
  renderInfo(a);                                  // card content follows the pick; its visibility does not change
  const I = a.info || {};
  openDialog({ id: a.id, name: a.def.name, accent: a.def.accent, portrait: `assets/portraits/${a.id}.png`,
    first: statusLine(a.id, a.status, I.summary || a.summary, I.lastActive ? relTime(I.lastActive) : "") });
  document.querySelectorAll(".crew li").forEach((l) => l.classList.toggle("sel", l.dataset.id === a.id));
  if (a.sx != null) {
    // put the sprite (centre ~24 px above its feet) at ~45% of the area that the dialog leaves free, not behind the dialog
    const box = document.getElementById("npcBox"), face = document.getElementById("npcFace");
    const free = Math.min(VH, box ? box.getBoundingClientRect().top : VH, SMALL.matches && face ? face.getBoundingClientRect().top + 40 : VH);
    panTo(a.sx, a.sy - 24, Math.max(90, free * 0.45));
  }
}
setInterval(() => { if (SEL && SEL !== bip && !info.hidden) renderInfo(SEL); }, 5000);
function paintUI() {
  document.getElementById("chips").innerHTML = ["work", "idle", "sleep"].map((k) => `<span class="chip c-${k}"><i></i><b>${counts[k]}</b>&nbsp;${SLBL[k]}</span>`).join("");
  document.getElementById("ccount").textContent = `· ${crew.length}`;
  document.getElementById("crew").innerHTML = crew.map((a) => `<li tabindex="0" data-id="${a.id}" class="${a === SEL ? "sel" : ""}"><img src="assets/sprites/${a.id}_portrait.png" alt=""><span class="n" style="color:${a.def.accent}">${esc(a.def.name)}</span><span class="s c-${a.status}">${SLBL[a.status]}</span></li>`).join("") + `<li tabindex="0" data-id="bip" class="${SEL === bip ? "sel" : ""}"><img src="assets/props/drone.png" alt="" style="object-fit:contain;padding:3px"><span class="n">BIP</span><span class="s" style="color:var(--amber)">MASKOT</span></li>`;
  document.querySelectorAll(".crew li").forEach((li) => { const a = li.dataset.id === "bip" ? bip : crew.find((c) => c.id === li.dataset.id); li.onclick = () => pick(a); li.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(a); } }; });
}
const SMALL = matchMedia("(max-width:720px)");
function setCrew(open) { const w = document.querySelector(".crew"), b = document.getElementById("crewToggle"); w.classList.toggle("collapsed", !open); b.textContent = open ? "–" : "+"; b.setAttribute("aria-expanded", String(open)); }
if (matchMedia("(max-height:760px)").matches || SMALL.matches) setCrew(false);
document.getElementById("crewToggle").onclick = () => setCrew(document.querySelector(".crew").classList.contains("collapsed"));

/* ---------- musik latar (loop, volume 0.4, pilihan disimpan di localStorage) ---------- */
const MUSIC_KEY = "vmx-music", BGM = new Audio("assets/audio/hq-theme.mp3");
BGM.loop = true; BGM.volume = 0.4; BGM.preload = "auto";
let musicOn = (() => { try { return localStorage.getItem(MUSIC_KEY) !== "off"; } catch (e) { return true; } })();
const muteBtn = document.getElementById("muteBtn");
function musicUI() {
  const playing = !BGM.paused;
  muteBtn.classList.toggle("muted", !musicOn); muteBtn.classList.toggle("wait", musicOn && !playing);
  muteBtn.setAttribute("aria-pressed", String(musicOn)); muteBtn.title = !musicOn ? "Musik mati (klik buat nyalain)" : playing ? "Musik nyala (klik buat matiin)" : "Musik nunggu klik/tap pertama";
}
function playMusic() { if (!musicOn) return; BGM.play().then(musicUI, () => { musicUI(); armUnlock(); }); }
function armUnlock() {
  const go = (e) => { if (e && e.target && e.target.closest && e.target.closest("#muteBtn")) return;
    for (const ev of ["pointerdown", "keydown", "touchstart"]) removeEventListener(ev, go, true); playMusic(); };
  for (const ev of ["pointerdown", "keydown", "touchstart"]) addEventListener(ev, go, true);
}
muteBtn.addEventListener("click", () => {
  if (musicOn && BGM.paused) { playMusic(); return; }
  musicOn = !musicOn; try { localStorage.setItem(MUSIC_KEY, musicOn ? "on" : "off"); } catch (e) {}
  if (musicOn) playMusic(); else { BGM.pause(); musicUI(); }
});
document.addEventListener("visibilitychange", () => { if (document.hidden) BGM.pause(); else if (musicOn) playMusic(); });
BGM.addEventListener("play", musicUI); BGM.addEventListener("pause", musicUI);
musicUI(); playMusic();
initDialog({ soundOn: () => musicOn,   // dialog blips follow the music on/off button
  // close = the camera stays exactly where it is right now (an unfinished open-pan is stopped, never reversed)
  onClose: () => { pan = null; if (!INFO_KEEP && SEL !== bip) info.hidden = true; } });

/* ---------- boot ---------- */
async function boot() {
  onResize(); fit();
  addEventListener("resize", onResize);
  addEventListener("orientationchange", () => requestAnimationFrame(onResize));   // some mobile browsers report the new size a frame late
  try { await document.fonts.load('10px "PS2P"'); await document.fonts.load('15px "Pixelify"'); } catch {}
  paintGround();
  const kairo = await fetch("assets/sprites/kairo.json").then((r) => r.json());
  await Promise.all(AGENTS.map(async (def, i) => {
    const an = kairo.agents[def.id]; if (!an) return;
    const src = new Image(); src.src = "assets/sprites/" + an.sheet; await src.decode().catch(() => {});
    const img = src; // full-res sheet, drawn at half size so it stays sharp when zoomed in
    crew.push({ id: def.id, def, img, anim: an, status: "idle", summary: "", seed: hash(i, 4),
      x: CH_X, y: CH_Y, mode: "tpin", ft: -i * 40, path: [], wait: 0, face: "f" });
  }));
  crew.sort((a, b) => AGENTS.findIndex((d) => d.id === a.id) - AGENTS.findIndex((d) => d.id === b.id));
  { const src = new Image(); src.src = "assets/props/drone.png"; await src.decode().catch(() => {});
    const c = document.createElement("canvas"); c.width = Math.round(src.width * 0.75); c.height = Math.round(src.height * 0.75);
    const q = c.getContext("2d"); q.imageSmoothingEnabled = true; q.imageSmoothingQuality = "high"; q.drawImage(src, 0, 0, c.width, c.height); bip.img = c; }
  await loadStatus();
  setInterval(loadStatus, POLL_MS);
  let last = performance.now();
  const loop = (now) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; render(dt); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
boot().catch((e) => { const el = document.getElementById("err"); el.innerHTML = `<div class="bar"><span>ERROR</span></div><p style="padding:10px;margin:0">Markas gagal dimuat: ${esc(e.message || e)}</p>`; el.hidden = false; });
