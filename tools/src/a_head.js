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
