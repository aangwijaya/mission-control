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
    if (this.pose === "charge") out.push({ fn: () => { P2.want = 1; P2.busy = 0; this.quiet(); } }, { wait: .5 }, { pose: "stand" }, { move: { x: P2.x, y: P2.y + 30 } }, { fn: () => P2.want = 0 });
    else if (this.pose === "sit" && this.seat && this.seat.sofa != null) out.push({ pose: "stand" }, { move: { x: this.seat.x, y: this.seat.y + 26 } });
    else if (this.pose === "sit") out.push({ pose: "stand" }, { move: { x: this.desk.x + SEAT_DX, y: DESK.walkY } });
    release(this); this.seat = null;
    return out;
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
    if (m === "work") { this.x = this.desk.x + SEAT_DX; this.y = DESK.seatY; this.flip = false; this.pose = "sit"; this.where = "Command Center · konsol"; this.setTasks([{ wait: Infinity, work: true }]); }
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
    if (this.fx) { this.fx.t += dt; if (this.fx.t >= this.fx.dur) { const f = this.fx; this.fx = null; if (f.kind === "out") this.hidden = true; } else return; }
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
      if (!k.started) { k.started = true; const Pd = PADS[k.pad]; Pd.t = 1.2; this.fx = { kind: k.beam, t: 0, dur: k.beam === "in" ? .62 : .55 };
        if (k.beam === "in") { this.hidden = false; this.flip = Math.random() < .5; this.where = "Teleporter"; } return; }
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
  get sortY() { return this.y; }
  box() { return { x0: this.x - 18, x1: this.x + 18, y0: this.y - 84, y1: this.y + 4 }; }
  headY() { const top = TOPS[this.id] ? TOPS[this.id][this.frame()] : 10; return this.y - (BASE - top); }
}
