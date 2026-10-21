"""Stage 2: build every animation frame from the pose sprites (same pixels -> perfectly consistent).
Output: assets/sprites/<id>.png (one row of 64x96 cells) + assets/sprites/sprites.json + portraits."""
import json, sys, numpy as np
from PIL import Image
sys.path.insert(0, __file__.rsplit("/", 1)[0]); from eyes2 import close_eyes
from build_poses import make_sit, make_wave, CUT, HANDBOX
from scipy import ndimage as nd
WK = "/workspace/mission-control/villagemegax/tools/work"; OUT = "/workspace/mission-control/villagemegax/assets/sprites"
IDS = ["nerd", "makelar", "alcapone", "sisotoy", "kuku", "kurir", "jack"]
CW, CH, BASE = 64, 96, 94
FR = ["idle0", "idle1", "blink", "walk0", "walk1", "walk2", "walk3", "back0", "back1", "back2", "back3", "backidle",
      "sit0", "sit1", "wave0", "wave1", "charge", "sitblink"]
ld = lambda n: np.asarray(Image.open(f"{WK}/{n}.png").convert("RGBA")).copy()

def anchor_x(o):
    a = o[..., 3] > 0; rows = np.nonzero(a.any(1))[0]; low = a[rows.max() - 7: rows.max() + 1]
    xs = np.nonzero(low.any(0))[0]; return (xs.min() + xs.max()) / 2

def paste(dst, src, ox, oy):
    h, w = src.shape[:2]; y0, x0 = max(0, oy), max(0, ox); y1, x1 = min(dst.shape[0], oy + h), min(dst.shape[1], ox + w)
    if y1 <= y0 or x1 <= x0: return
    s = src[y0 - oy:y1 - oy, x0 - ox:x1 - ox]; m = s[..., 3] > 0; d = dst[y0:y1, x0:x1]; d[m] = s[m]

def layer(o, rows=None, cols=None):
    L = np.zeros_like(o); r0, r1 = rows or (0, o.shape[0]); c0, c1 = cols or (0, o.shape[1]); L[r0:r1, c0:c1] = o[r0:r1, c0:c1]; return L

def leg_split(o, hip):
    a = o[hip:, :, 3] > 0; cnt = a.sum(0); xs = np.nonzero(cnt)[0]; lo, hi = xs.min(), xs.max()
    mid = range(int(lo + (hi - lo) * .3), int(lo + (hi - lo) * .7) + 1)
    return min(mid, key=lambda x: (cnt[x], abs(x - (lo + hi) / 2)))

def walk(o, hip_frac=.6):
    H, W = o.shape[:2]; hip = int(H * hip_frac); sx = leg_split(o, hip)
    body = layer(o, (0, hip)); L = layer(o, (hip - 3, H), (0, sx)); R = layer(o, (hip - 3, H), (sx, W))
    frames = []
    for lift_l, lift_r, bob in [(3, 0, -1), (0, 0, 0), (0, 3, -1), (0, 0, 0)]:
        c = np.zeros((H + 4, W + 4, 4), np.uint8)
        paste(c, L, 2 + (1 if lift_l else 0), 4 - lift_l + 0); paste(c, R, 2 + (1 if lift_r else 0), 4 - lift_r)
        paste(c, body, 2, 4 + bob); frames.append(c)
    return frames

def bob(o, frac=.55, d=1):
    H, W = o.shape[:2]; cut = int(H * frac); c = np.zeros((H + 2, W, 4), np.uint8)
    paste(c, layer(o, (cut, H)), 0, 2); paste(c, layer(o, (0, cut)), 0, 2 + d); return c

def wave2(o):
    """second wave frame: only the raised hand (above the head top) tilts 1-2 px outward"""
    H, W = o.shape[:2]; a = o[..., 3] > 0
    head_cx = np.nonzero(a[int(H * .12):int(H * .3)].any(0))[0].mean()
    right = a[:, int(head_cx) + 4:]; ys = np.nonzero(right.any(1))[0]
    top = ys.min() + 9                       # rows of the hand/forearm
    c0 = int(head_cx) + 4; hand = layer(o, (0, top), (c0, W)); c = o.copy(); c[:top, c0:] = 0
    out = np.zeros((H, W + 3, 4), np.uint8); paste(out, c, 0, 0); paste(out, hand, 2, 0); paste(out, layer(o, (top - 1, top + 3), (c0, W)), 1, 0)
    return out

meta = {"cell": [CW, CH], "base": BASE, "frames": FR, "agents": {}}
for id_ in IDS:
    idle, back = ld(f"{id_}_idle"), ld(f"{id_}_back")
    neck, waist = CUT[id_]
    bl = close_eyes(idle, id_)                                     # readable closed eyes / nerd visor glint
    # sit + wave reuse the master's head (and for sit the whole upper body) pixel-for-pixel
    sit, _ = make_sit(idle, ld(f"{id_}_sit"), neck, waist); sit_bl, _ = make_sit(bl, ld(f"{id_}_sit"), neck, waist)
    wave, _ = make_wave(idle, ld(f"{id_}_wave"), neck, HANDBOX.get(id_))
    ax = anchor_x(idle)
    raw = {"idle0": idle, "idle1": bob(idle), "blink": bl, "backidle": back, "sit0": sit, "sit1": bob(sit, .5),
           "wave0": wave, "wave1": wave2(wave), "charge": bl, "sitblink": sit_bl}
    for i, f in enumerate(walk(idle)): raw[f"walk{i}"] = f
    for i, f in enumerate(walk(back)): raw[f"back{i}"] = f
    sheet = np.zeros((CH, CW * len(FR), 4), np.uint8)
    for n, name in enumerate(FR):
        o = raw[name]; a = o[..., 3] > 0; rows = np.nonzero(a.any(1))[0]
        bottom = rows.max(); x_anchor = anchor_x(o) if name.startswith(("back", "sit", "wave")) else anchor_x(o)
        # keep walk/bob offsets: anchor everything on its own feet, but bob frames keep their vertical offset
        oy = BASE - bottom if not name.startswith(("walk", "back")) or name == "backidle" else BASE - (o.shape[0] - 1)
        if name in ("idle1", "sit1"): oy = BASE - (o.shape[0] - 1)
        cell = np.zeros((CH, CW, 4), np.uint8); paste(cell, o, int(round(CW / 2 - x_anchor)), oy)
        sheet[:, n * CW:(n + 1) * CW] = cell
    Image.fromarray(sheet).save(f"{OUT}/{id_}.png")
    a = idle[..., 3] > 0; top = np.nonzero(a.any(1))[0].min()
    # portrait: head + shoulders, 40x40
    head_rows = idle[top: top + 36]; hx = np.nonzero((head_rows[..., 3] > 0).any(0))[0]
    cx = int((hx.min() + hx.max()) / 2); por = np.zeros((40, 40, 4), np.uint8); paste(por, head_rows, 20 - cx, 4)
    Image.fromarray(por).save(f"{OUT}/{id_}_portrait.png")
    meta["agents"][id_] = {"height": int(idle.shape[0]), "width": int(idle.shape[1])}
json.dump(meta, open(f"{OUT}/sprites.json", "w"), indent=1)
print("ok", json.dumps(meta["agents"]))
