"""KAIRO stage 2: per agent pick the best frames from the AI sheets, downscale + lock to the agent's own 16-colour
palette, align feet (BASE) + centre, paste the master head (faces stay identical to sit/wave/blink), and build
shared FX (beam, splash, white flash, energy orbs) tinted to each agent's accent/palette.
Output: assets/sprites/<id>_kairo.png (one row of 64x96 cells) + assets/sprites/kairo.json
Neo HQ diagonals (walkd/backd) are appended after the older cells, see DIAG.
The old code-made frames stay untouched in assets/sprites/<id>.png (HUD toggle ANIM: NEW/OLD)."""
import sys, json, re, numpy as np
from PIL import Image
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from anim_extract import extract, down, load_pal, ROOT
from build_poses import CUT
from eyes2 import close_eyes
from diag_cleanup import clean_dots
from hair_sway import sway, SWAY

CW, CH, BASE = 64, 96, 94
OUT = f"{ROOT}/assets/sprites"
TICKS = {"blink": 8, "idle": 9, "walk": 4, "back": 5, "tp": 3, "def": 5, "walkd": 4, "backd": 5}
LOOP = {"blink": True, "idle": True, "walk": True, "back": True, "tp": False, "def": False, "walkd": True, "backd": True}
ACCENT = dict(re.findall(r'id:"(\w+)".*?accent:"(#[0-9a-fA-F]{6})"', open(f"{ROOT}/js/agents.js").read()))

def anchor_x(o):
    a = o[..., 3] > 0; rows = np.nonzero(a.any(1))[0]; low = a[rows.max() - 7: rows.max() + 1]
    xs = np.nonzero(low.any(0))[0]; return (xs.min() + xs.max()) / 2

def paste(dst, src, ox, oy):
    h, w = src.shape[:2]; y0, x0 = max(0, oy), max(0, ox); y1, x1 = min(dst.shape[0], oy + h), min(dst.shape[1], ox + w)
    if y1 <= y0 or x1 <= x0: return
    s = src[y0 - oy:y1 - oy, x0 - ox:x1 - ox]; m = s[..., 3] > 0; d = dst[y0:y1, x0:x1]; d[m] = s[m]

SHEETS = {}
def sheet(name, **kw):
    kw.setdefault("merge", 0)
    if name in SPLIT_N: kw["n"] = SPLIT_N[name]
    key = (name, tuple(sorted(kw.items())))
    if key not in SHEETS: SHEETS[key] = extract(name, **kw)
    return SHEETS[key]

def item(name, i, height, char=True, pal=None, **kw):
    """downscale item i so that it ends up `height` px tall"""
    a, fg, its = sheet(name, **kw); it = its[i]
    return down(a, fg, it, height / it["h"], char, pal)

def items_scaled(name, idx, ref_h, target, pal, **kw):
    """same scale for every picked item of a sheet: the sheet's standing height `ref_h` (source px) -> `target` px"""
    a, fg, its = sheet(name, **kw)
    return [down(a, fg, its[i], target / ref_h, True, pal) for i in idx]

def torso_cx(o):
    a = o[..., 3] > 0; rows = np.nonzero(a.any(1))[0]; t = rows.min()
    band = a[t + 8: t + 30]; xs = np.nonzero(band.any(0))[0]; return (xs.min() + xs.max()) / 2

def head_swap(o, head, neck, r=5):
    """replace the AI head (rows above the neck) with the master's head pixels at the best-matching offset"""
    P_ = 24; c = np.zeros((o.shape[0] + 2 * P_, o.shape[1] + 2 * P_, 4), np.uint8); paste(c, o, P_, P_)
    a = c[..., 3] > 0; top = np.nonzero(a.any(1))[0].min()
    hx = np.nonzero((head[..., 3] > 0).any(0))[0]; cols = np.nonzero(a[top:top + neck].any(0))[0]
    gx = int(round((cols.min() + cols.max()) / 2 - (hx.min() + hx.max()) / 2)); gy = top
    hm = head[..., 3] > 0; best = None
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            t = c[gy + dy: gy + dy + neck, gx + dx: gx + dx + head.shape[1]]
            both = hm & (t[..., 3] > 0)
            diff = np.abs(t[both, :3].astype(int) - head[both, :3].astype(int)).sum(1).mean() if both.any() else 999
            score = diff + 300 * (1 - both.sum() / hm.sum()) + 2 * (abs(dx) + abs(dy))
            if best is None or score < best[0]: best = (score, dx, dy)
    X, Y = gx + best[1], gy + best[2]
    c[:Y + neck - 2] = 0                                              # drop the AI hair / head above the neck seam
    reg = c[Y:Y + neck, X:X + head.shape[1]]; reg[hm] = head[hm]
    ys, xs = np.nonzero(c[..., 3] > 0); return c[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy()

def cell(o, mode="feet", cy=None):
    c = np.zeros((CH, CW, 4), np.uint8); a = o[..., 3] > 0; rows = np.nonzero(a.any(1))[0]
    ax = torso_cx(o) if mode == "torso" else (o.shape[1] - 1) / 2 if mode == "box" else anchor_x(o)
    oy = BASE - rows.max() if cy is None else int(round(cy - o.shape[0] / 2))
    paste(c, o, int(round(CW / 2 - ax)), oy); return c

# ---------- tinting of the shared FX (beam, splash, flash, orbs) ----------
def nearest(P, rgb): return P[np.argmin(((P - np.array(rgb)) ** 2).sum(1))]
def ramp(id_, P):
    """accent ramp snapped to the agent's own palette; mid/dark only from saturated palette entries (so it never goes grey)"""
    acc = np.array([int(ACCENT[id_][i:i + 2], 16) for i in (1, 3, 5)])
    sat = P.max(1) - P.min(1); Ps = P[sat > 70] if (sat > 70).sum() >= 2 else P
    mid = nearest(Ps, acc); dark = nearest(Ps, mid * .6)
    if (dark == mid).all(): dark = (mid * .6).astype(int)
    return dict(light=(mid * .35 + 255 * .65).astype(int), mid=mid, dark=dark, white=np.array([255, 255, 255]))

def tint_fx(c, R, edge_col=False):
    """nerd's white/cyan FX cell -> agent colours: near-white stays a pale tint, cyan -> accent, darker -> accent shade"""
    o = c.copy(); m = o[..., 3] > 0; rgb = o[..., :3].astype(int)
    lum = rgb.mean(-1); sat = rgb.max(-1) - rgb.min(-1)
    white = m & (lum > 200) & (sat < 40); col = m & ~white
    o[white, :3] = R["light"]; o[col & (lum > 140), :3] = R["mid"]; o[col & (lum <= 140), :3] = R["dark"]
    core = m & (lum > 236)                                             # brightest core pixels keep a white spark
    o[core, :3] = 255
    if edge_col:                                                        # beam / splash: coloured rim around the white core
        e = m & ~(np.pad(m, 1)[2:, 1:-1] & np.pad(m, 1)[:-2, 1:-1] & np.pad(m, 1)[1:-1, 2:] & np.pad(m, 1)[1:-1, :-2])
        o[e, :3] = R["mid"]
    return o

def flash(c, R, light=True):
    o = c.copy(); m = o[..., 3] > 0
    o[m, :3] = np.array([250, 250, 250]) if light else R["light"]
    edge = m & ~np.pad(m, 1)[2:, 1:-1] | m & ~np.pad(m, 1)[:-2, 1:-1] | m & ~np.pad(m, 1)[1:-1, 2:] | m & ~np.pad(m, 1)[1:-1, :-2]
    o[edge, :3] = R["mid"]; return o

# ---------- per-agent picks (indices into the extracted AI rows, see anim/items + report) ----------
CFG = {
    "makelar": dict(idle=("makelar_idle_v1", [0, 1, 2, 4]), walk=("makelar_walk_v1", [0, 2, 4, 6, 8]), back=("makelar_back_v1", [0, 1, 2, 3]),
                    tp=("makelar_teleport_v1", [5, 6, 7]), de=("makelar_defeat_v1", 0)),
    # alcapone = redesign B (white pearl + gold + ice-blue, golden-blond ponytail); defeat keeps the AI head (hair whips up)
    "alcapone": dict(idle=("alcapone_idle_v2", [0, 1, 2, 3]), walk=("alcapone_walk_v3", [0, 1, 2, 3, 4, 5]), back=("alcapone_back_v2", [0, 1, 2, 3]),
                     tp=("alcapone_teleport_v2", [5, 6, 7]), tp_f=(.69, .86, .98), de=("alcapone_defeat_v2", 0), de_head=False, de_h=84, de_mode="box"),
    "sisotoy": dict(idle=("sisotoy_idle_v1", [0, 1, 2, 3]), walk=("sisotoy_walk_v1", [0, 1, 2, 3, 4, 5]), back=("sisotoy_back_v1", [0, 1, 2, 3]),
                    tp=("sisotoy_teleport_v1", [3, 5, 6]), de=("sisotoy_defeat_v1", 0)),
    "kuku": dict(idle=("kuku_idle_v1", [0, 1, 2, 3]), walk=("kuku_walk_v1", [0, 1, 2, 3, 4, 5]), back=("kuku_back_v1", [0, 1, 2, 3]),
                 tp=("kuku_teleport_v1", [5, 6, 7]), de=("kuku_defeat_v1", 0)),
    "kurir": dict(idle=("kurir_idle_v1", [0, 1, 2, 3]), walk=("kurir_walk_v1", [0, 1, 2, 3, 4, 5]), back=("kurir_back_v1", [0, 1, 2, 3]),
                  tp=("kurir_teleport_v1", [4, 5, 6]), de=("kurir_defeat_v1", 0)),
    "jack": dict(idle=("jack_idle_v1", [0, 1, 2, 3]), walk=("jack_walk_v1", [0, 1, 2, 3, 4, 5]), back=("jack_back_v2", [0, 1, 2, 3, 4, 5]),
                 tp=("jack_teleport_v1", [4, 5, 6]), de=("jack_defeat_v1", 0)),
}

# ---------- isometric diagonals for Neo HQ (anim/raw/<id>_walkd.png, <id>_backd.png) ----------
# walkd = 3/4 front walking toward bottom-right, backd = 3/4 back walking toward top-right; js mirrors them for the
# two left-hand directions. Cells are APPENDED after "def" so every older sequence keeps its cell indices.
# (picked items, cycle order as indices into the picked list, master head pasted?)
DIAG = {
    "nerd":     dict(walkd=([0, 1, 2, 3, 4, 5], None, True), backd=([0, 1, 2, 3], None, False)),
    "makelar":  dict(walkd=([0, 1, 2, 3, 4, 5], None, True), backd=([0, 1, 2, 3], None, False)),
    "alcapone": dict(walkd=([0, 1, 2, 3, 4, 5], None, True), backd=([0, 1, 2, 3, 4, 5], None, False)),
    "sisotoy":  dict(walkd=([0, 1, 2, 3, 4, 5], None, True), backd=([0, 1, 2, 3], None, False)),
    "kuku":     dict(walkd=([0, 1, 2, 3, 4, 5], None, True), backd=([0, 1, 2, 3], None, False)),
    "kurir":    dict(walkd=([0, 1, 2, 3, 4, 5], None, True), backd=([0, 1, 2, 3], None, False)),
    "jack":     dict(walkd=([0, 1, 2, 3, 4, 5], None, True), backd=([0, 1, 2, 3], None, False)),
}

# diagonal source sheet when it is not anim/raw/<id>_<seq>.png (versioned redesigns)
DIAG_SRC = {"alcapone": dict(walkd="alcapone_walkd_v2", backd="alcapone_backd_v2")}

# sheets whose sprites touch (long hair over the next sprite): number of characters, cut by anim_extract.split_n
SPLIT_N = {"alcapone_walk_v3": 6, "alcapone_walkd_v2": 6}

# agents whose diagonal frames get the dot cleanup (tools/diag_cleanup.py): vertical band per sequence
DIAG_CLEAN = {"kuku": dict(walkd=(0.30, 0.62), backd=(0.36, 0.62)), "kurir": dict(walkd=(0.30, 0.62), backd=(0.36, 0.62))}

# diagonal sequences whose head (rows above `neck`, buns + bird included) is copied from frame `src` onto every frame
BACK_HEAD = {"kuku": dict(backd=(0, 35))}

def chars(name):
    """character items of a sheet (drops specks / split leftovers narrower than 30 source px)"""
    _, _, its = sheet(name, split=True)
    return [j for j, it in enumerate(its) if it["x1"] - it["x0"] > 30]

def add_diag(id_, add, seqs, H, hs):
    pal = load_pal(id_)
    for seq, (idx, order, head) in DIAG[id_].items():
        name = DIAG_SRC.get(id_, {}).get(seq, f"{id_}_{seq}"); ch = chars(name)
        out = items_scaled(name, [ch[i] for i in idx], std_h(name), H, pal, split=True)
        if head: out = [hs(o) for o in out]
        if seq in BACK_HEAD.get(id_, {}):                                # one 3/4-back head + bird for every frame (bob follows the body)
            src, nb = BACK_HEAD[id_][seq]; o0 = out[src]; t0 = np.nonzero((o0[..., 3] > 0).any(1))[0].min()
            hb = o0[t0:t0 + nb].copy(); out = [head_swap(o, hb, nb) for o in out]
        cells = [cell(o, "torso") for o in out]
        if id_ in DIAG_CLEAN:                                            # repaint generator-invented chest/back dots
            yf = CUT[id_][0] + 2 if head else None                       # never touch the pasted master head
            cells = [clean_dots(c, band=DIAG_CLEAN[id_][seq], cx=torso_cx(c), y_from=yf)[0] for c in cells]
        add(seq, cells)
        if order: seqs[seq] = [seqs[seq][j] for j in order]

def std_h(name, idx=None):
    """standing height of a sheet = tallest character item (source px)"""
    _, _, its = sheet(name, split=True)
    return max(it["h"] for it in its if it["x1"] - it["x0"] > 30)

def build_nerd():
    frames, seqs = [], {}
    def add(seq, cells): seqs[seq] = list(range(len(frames), len(frames) + len(cells))); frames.extend(cells)
    MASTER = np.asarray(Image.open(f"{ROOT}/tools/work/nerd_idle.png").convert("RGBA")).copy(); NECK = 21; HEAD = MASTER[:NECK].copy()
    hs = lambda o: head_swap(o, HEAD, NECK)
    # IDLE: 4 AI frames (frame 3 had a squashed head -> renormalised to 80 + master head)
    idle = [hs(item("nerd_idle_v1", i, 80)) for i in range(4)]
    add("idle", [cell(o) for o in idle])
    # BLINK: idle frame 0 with the master's visor glint head (eyes2.glint)
    add("blink", [cell(head_swap(item("nerd_idle_v1", 0, 80), close_eyes(MASTER, "nerd")[:NECK].copy(), NECK))])
    # WALK: AI frame 4 turned toward the camera (off-model) -> dropped; the cycle reuses the other "down" frame there
    walk = {i: hs(item("nerd_walk_v2", i, h)) for i, h in {0: 80, 1: 78, 2: 80, 3: 80, 5: 80}.items()}
    add("walk", [cell(walk[i], "torso") for i in (0, 1, 2, 3, 5)])
    seqs["walk"] = [seqs["walk"][j] for j in (0, 1, 2, 3, 1, 4)]
    add("back", [cell(item("nerd_walkback_v1", i, 80), "torso") for i in (0, 4, 3, 7)])
    tp = [item("nerd_teleport_v2", 0, 86, False), item("nerd_teleport_v2", 1, 86, False), item("nerd_teleport_v2", 2, 76, False),
          hs(item("nerd_teleport_v2", 5, 66)), hs(item("nerd_teleport_v2", 6, 72)), hs(item("nerd_teleport_v2", 7, 77)), idle[0]]
    add("tp", [cell(o) for o in tp])
    dk = dict(thr=60, merge=9)
    de = [hs(item("nerd_defeat_v1", 0, 76, **dk)), item("nerd_defeat_v1", 1, 79, False, **dk), item("nerd_defeat_v1", 2, 80, False, **dk)]
    rings = [item("nerd_defeat_v1", 3, 40, False, **dk), item("nerd_defeat_v1", 10, 50, False, **dk), item("nerd_defeat_v1", 12, 60, False, **dk)]
    add("def", [cell(o) for o in de] + [cell(o, "box", cy=BASE - 38) for o in rings])
    add_diag("nerd", add, seqs, MASTER.shape[0], hs)
    return frames, seqs

def build_agent(id_, nerd_cells, nerd_seqs):
    c = CFG[id_]; pal = load_pal(id_); P = pal[1]; R = ramp(id_, P)
    MASTER = np.asarray(Image.open(f"{ROOT}/tools/work/{id_}_idle.png").convert("RGBA")).copy()
    H = MASTER.shape[0]; NECK = CUT[id_][0]; HEAD = MASTER[:NECK].copy()
    hs = lambda o: head_swap(o, HEAD, NECK)
    frames, seqs = [], {}
    def add(seq, cells):
        if seq in SWAY.get(id_, {}): cells = [sway(cl, d) for cl, d in zip(cells, SWAY[id_][seq])]   # ponytail swing
        seqs[seq] = list(range(len(frames), len(frames) + len(cells))); frames.extend(cells)
    def pick(key, idx=None, head=True):
        name, ix = c[key]; ix = idx if idx is not None else ix
        out = items_scaled(name, ix if isinstance(ix, list) else [ix], std_h(name), H, pal, split=True)
        return [hs(o) for o in out] if head else out
    idle = pick("idle"); add("idle", [cell(o) for o in idle])
    blink_head = close_eyes(MASTER, id_)[:NECK].copy()
    name, ix = c["idle"]; raw0 = items_scaled(name, [ix[0]], std_h(name), H, pal, split=True)[0]
    add("blink", [cell(head_swap(raw0, blink_head, NECK))])
    add("walk", [cell(o, "torso") for o in pick("walk")])
    add("back", [cell(o, "torso") for o in pick("back", head=False)])
    # teleport: shared beam + splash (tinted), white silhouette of this agent's idle, 3 AI landing frames, idle0
    name, ix = c["tp"]                                                 # crouch / half / rise normalised to 80/88/95 % of the master
    land = [hs(item(name, i, round(H * f), True, pal, split=True)) for i, f in zip(ix, c.get("tp_f", (.80, .88, .95)))]
    nb = [nerd_cells[i] for i in nerd_seqs["tp"][:2]]
    add("tp", [tint_fx(nb[0], R, True), tint_fx(nb[1], R, True), flash(cell(idle[0]), R, False)] + [cell(o) for o in land] + [cell(idle[0])])
    # defeat: own stumble frame, then shared flash + orb rings tinted to the palette
    if "de_h" in c: st = item(c["de"][0], c["de"][1], c["de_h"], True, pal, split=True)   # tallest item = hair, not body
    else: st = pick("de")[0]
    if c.get("de_head", True) and "de_h" in c: st = hs(st)
    orbs = [tint_fx(nerd_cells[i], R) for i in nerd_seqs["def"][3:]]
    dm = c.get("de_mode", "feet")                                      # "box": wide stumble pose centred so it is not clipped
    add("def", [cell(st, dm), flash(cell(st, dm), R, True), flash(cell(st, dm), R, False)] + orbs)
    add_diag(id_, add, seqs, H, hs)
    return frames, seqs

if __name__ == "__main__":
    only = [a for a in sys.argv[1:] if not a.startswith("-")]
    meta = {"cell": [CW, CH], "base": BASE, "agents": {}}
    nf, ns = build_nerd()
    built = {"nerd": (nf, ns)}
    for id_ in CFG:
        if only and id_ not in only: continue
        built[id_] = build_agent(id_, nf, ns)
    for id_, (fr, sq) in built.items():
        img = np.concatenate(fr, 1); Image.fromarray(img).save(f"{OUT}/{id_}_kairo.png")
        meta["agents"][id_] = {"sheet": f"{id_}_kairo.png", "seq": sq, "ticks": TICKS, "loop": LOOP}
        print(id_, img.shape[1] // CW, "cells", {k: len(v) for k, v in sq.items()})
    json.dump(meta, open(f"{OUT}/kairo.json", "w"), indent=1)
