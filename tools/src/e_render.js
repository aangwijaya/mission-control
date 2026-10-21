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
