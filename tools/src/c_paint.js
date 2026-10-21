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
