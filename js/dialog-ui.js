/* Dialog NPC ala game: potret besar di kiri bawah, papan nama, kotak teks yang mengetik huruf per huruf.
   Klik / Spasi / Enter = lanjut (atau selesaikan baris), Esc / klik di luar = tutup. Isi kalimat: js/dialog.js */
import { DIALOG, DEFAULT_STATUS } from "./dialog.js";

const $ = (id) => document.getElementById(id);
const root = $("npc"), face = $("npcFace"), box = $("npcBox"), nameEl = $("npcName"), textEl = $("npcText"), countEl = $("npcCount");
const REDUCED = matchMedia("(prefers-reduced-motion:reduce)");
const CPS = 34;                                   // huruf per detik
let lines = [], idx = 0, shown = 0, timer = 0, open = false, soundOn = () => false, onClose = null, actx = null;

function blip() {
  if (!soundOn()) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume();
    const o = actx.createOscillator(), gn = actx.createGain(), t0 = actx.currentTime;
    o.type = "square"; o.frequency.value = 560 + Math.random() * 90;
    gn.gain.setValueAtTime(0.035, t0); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);
    o.connect(gn).connect(actx.destination); o.start(t0); o.stop(t0 + 0.05);
  } catch (e) { /* audio is optional */ }
}
const pick = (arr, n) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

/** first line from live data: mode = work | idle | sleep, task = summary text, ago = "3 jam lalu" */
export function statusLine(id, mode, task, ago) {
  const S = Object.assign({}, DEFAULT_STATUS, (DIALOG[id] && DIALOG[id].status) || {});
  task = (task || "").trim().replace(/[.!?…]+$/, "");
  let tpl;
  if (mode === "work") tpl = task ? S.work : S.workNoTask;
  else if (mode === "idle") tpl = task && !S.idle.includes("{task}") ? S.idle + " " + S.lastTask : S.idle;
  else tpl = S.sleep;
  if (!ago) tpl = tpl.replace(/\s*Terakhir aktif \{ago\}\.?/, "");
  return fill(tpl, { task, ago });
}

function render() {
  const s = lines[idx] || "", done = shown >= s.length;
  // the whole line is laid out from the start (rest invisible) so words never jump to the next row while typing
  textEl.innerHTML = ""; const a = document.createElement("span"); a.textContent = s.slice(0, shown);
  const b = document.createElement("span"); b.className = "rest"; b.textContent = s.slice(shown); textEl.append(a, b);
  box.classList.toggle("done", done); countEl.textContent = `${idx + 1}/${lines.length}`;
}
function tick() {
  const s = lines[idx] || ""; if (shown >= s.length) { timer = 0; return; }
  shown++; const ch = s[shown - 1]; if (shown % 2 && /\S/.test(ch)) blip(); render();
  timer = setTimeout(tick, /[.!?…]/.test(ch) ? 260 : /[,:;~]/.test(ch) ? 130 : 1000 / CPS);
}
function startLine() { clearTimeout(timer); shown = REDUCED.matches ? (lines[idx] || "").length : 0; render(); layout(); timer = setTimeout(tick, 60); }
export function advance() {
  if (!open) return;
  const s = lines[idx] || "";
  if (shown < s.length) { clearTimeout(timer); shown = s.length; render(); return; }
  if (idx < lines.length - 1) { idx++; startLine(); } else closeDialog();
}
function layout() {
  // integer scale in device pixels so the pixel art stays crisp: about 34% of the screen height, max 3x on desktop
  const dpr = devicePixelRatio || 1, narrow = innerWidth <= 720, h0 = face.naturalHeight || 140, w0 = face.naturalWidth || 110;
  const target = narrow ? Math.min(innerHeight * 0.3, innerWidth * 0.5) : Math.min(innerHeight * 0.42, 420);
  const s = Math.max(1, Math.floor((target / h0) * dpr)) / dpr;
  root.style.setProperty("--fw", Math.round(w0 * s) + "px"); root.style.setProperty("--fh", Math.round(h0 * s) + "px");
  root.style.setProperty("--bh", box.offsetHeight + "px");          // phone: the portrait stands on top of the box
}
/** opts: { id, name, accent, portrait, lines: [first, ...] } */
export function openDialog(opts) {
  const D = DIALOG[opts.id] || { lines: [] };
  const extra = pick(D.lines || [], 2 + ((Math.random() * 3) | 0));
  lines = [opts.first, ...extra].filter(Boolean); idx = 0;
  nameEl.textContent = opts.name; root.style.setProperty("--acc", opts.accent || "#35f2ff");
  face.alt = "Potret " + opts.name; face.onload = layout; face.src = opts.portrait; if (face.complete) layout();
  root.hidden = false; open = true; document.body.classList.add("npc-open"); startLine();
}
export function closeDialog() {
  if (!open) return; open = false; clearTimeout(timer); root.hidden = true; document.body.classList.remove("npc-open");
  if (onClose) onClose();
}
export const dialogOpen = () => open;
export function initDialog(o = {}) {
  soundOn = o.soundOn || soundOn; onClose = o.onClose || null;
  box.addEventListener("click", (e) => { e.stopPropagation(); advance(); });
  face.addEventListener("click", (e) => { e.stopPropagation(); advance(); });
  // click/tap anywhere outside the portrait + box closes it (the map below still gets the event, so tapping another crew member opens theirs)
  addEventListener("pointerdown", (e) => { if (open && !(e.target.closest && e.target.closest("#npcBox,#npcFace"))) closeDialog(); }, true);
  addEventListener("keydown", (e) => {
    if (!open) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeDialog(); }
    else if (e.key === " " || e.key === "Enter") { e.preventDefault(); e.stopPropagation(); advance(); }
  }, true);
  addEventListener("resize", () => { if (open) layout(); });
}
