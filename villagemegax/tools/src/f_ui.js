/* ---------------- label DOM ---------------- */
function placeLabels() {
  const zz = cam.s / DPR, far = zz < .9, k = zz < .8 ? .72 : zz < 1.5 ? 1 : 1.25;   // label ikut skala zoom
  for (const g of AG) {
    const u = g.fx ? g.fx.t / g.fx.dur : 0, hid = (g.hidden && !g.fx) || (g.fx && (g.fx.kind === "out" ? u > .2 : u < .72));
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
async function loadStatus(first) {
  if (DEMO) { LIVE = demoStatus(); ERR = null; }
  else {
    try { const j = await fetchJSON(STATUS_URL); if (!j || typeof j !== "object" || typeof j.agents !== "object") throw new Error("format salah"); LIVE = j; ERR = null; }
    catch (e) { ERR = e instanceof SyntaxError ? "JSON rusak" : (e.message || "gagal"); }
    try { SUMS = await fetchJSON(SUMMARY_URL); } catch (e) { }
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
    await Promise.all([
      ...AGENTS.map(async a => { IMG["spr_" + a.id] = await loadImg("assets/sprites/" + a.id + ".png"); }),
      ...Object.keys(PROPSZ).map(async n => { IMG["prop_" + n] = await loadImg("assets/props/" + n + ".png"); }),
      document.fonts.load('8px "PS2P"'), document.fonts.load('16px "PS2P"')]);
  } catch (e) { showErr("Aset markas gagal dimuat: " + esc(e.message) + '<br><a href="../">Balik ke dashboard</a>'); return; }
  // siluet putih (teleport) + baris teratas tiap frame (posisi label)
  for (const a of AGENTS) {
    const im = IMG["spr_" + a.id], [w, wx] = mk(im.width, im.height); wx.drawImage(im, 0, 0); const d = wx.getImageData(0, 0, im.width, im.height).data;
    TOPS[a.id] = []; for (let f = 0; f < im.width / CW; f++) { let top = 0; scan: for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (d[(y * im.width + f * CW + x) * 4 + 3] > 0) { top = y; break scan; } TOPS[a.id].push(top); }
    wx.globalCompositeOperation = "source-in"; wx.fillStyle = "#ffffff"; wx.fillRect(0, 0, im.width, im.height); IMG["wht_" + a.id] = w;
  }
  buildGrid(); buildObjects(); paintGround(); buildLights();
  resize(); cam.z = zoomInit(); applyZoom();
  if (MOBILE && cam.auto) { cam.x = HOME.x; cam.y = HOME.y - 20; clampCam(); }
  AG = AGENTS.map((a, i) => new Agent(a, i));
  AG.forEach(g => g.info = classify(g.a));
  await loadStatus(true);
  setInterval(() => loadStatus(false), POLL_MS);
  setInterval(() => { const s = sky(); if (s.k !== SKY.k || Math.abs(s.dark - SKY.dark) > .02) { SKY = s; paintGround(); renderHud(); } }, 60000);
  window.VMX = { AG, cam, setZoom, select, deselect, PODS, PADS, get SKY() { return SKY; }, get music() { return { on: musicOn, playing: !BGM.paused, t: BGM.currentTime, vol: BGM.volume, loop: BGM.loop }; },
    step(n = 1, dt = 1 / 30) { for (let i = 0; i < n; i++) tick(dt); render(TT); placeLabels(); },
    pause(v = true) { PAUSE = v; }, view(x, y, z) { FOLLOW = false; if (z) setZoom(z); cam.x = x; cam.y = y; clampCam(); } };
  requestAnimationFrame(t => { last = t; frame(t); });
  document.body.dataset.ready = "1";
})();
