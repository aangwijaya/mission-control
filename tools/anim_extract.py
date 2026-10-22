"""KAIRO pilot stage 1: key out magenta, slice each AI sheet into items by column gaps,
nearest/mode downscale to the in-game character scale and lock to nerd's 16-colour palette."""
import os, sys, json, numpy as np
from PIL import Image
from scipy import ndimage as nd
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from sprites_lib import key_mask, mode_downscale, outline, clean_specks
ROOT = os.environ.get("VMX_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # repo root (tools/..)
RAW = f"{ROOT}/anim/raw"; OUT = f"{ROOT}/anim/items"
P = np.asarray(Image.open(f"{ROOT}/tools/work/nerd_pal.png").convert("RGBA"))[0, :, :3].astype(int)
PAL = Image.new("P", (1, 1)); PAL.putpalette(list(P.ravel()) + list(P[0]) * (256 - 16))
TALL = 80   # master nerd height in px

def items(a, fg, gap=3, merge=12):
    cols = fg.any(0); runs = []; s = None
    for x, c in enumerate(list(cols) + [False]):
        if c and s is None: s = x
        if not c and s is not None: runs.append([s, x]); s = None
    runs = [r for r in runs if r[1] - r[0] >= gap]
    out = []
    for r in runs:                               # merge runs closer than `merge` px (orb rings)
        if out and r[0] - out[-1][1] < merge: out[-1][1] = r[1]
        else: out.append(r)
    return out

def split_wide(fg, rs):
    """touching sprites -> one wide run; cut it into k parts at the emptiest columns near the even split points"""
    ws = sorted(r[1] - r[0] for r in rs if r[1] - r[0] > 30)
    if not ws: return rs
    med = ws[len(ws) // 2]; out = []
    for x0, x1 in rs:
        k = round((x1 - x0) / med)
        if k < 2 or (x1 - x0) < 1.6 * med: out.append([x0, x1]); continue
        cnt = fg[:, x0:x1].sum(0); cuts = [x0]
        for j in range(1, k):
            c = int((x1 - x0) * j / k); lo, hi = max(1, c - med // 4), min(x1 - x0 - 1, c + med // 4)
            cuts.append(x0 + lo + int(np.argmin(cnt[lo:hi])))
        cuts.append(x1); out += [[cuts[j], cuts[j + 1]] for j in range(k)]
    return out

def split_n(fg, rs, n):
    """sheet with a known number `n` of characters whose runs touch (hair over the next sprite's boots): give every
    run a share of n by width and cut it at the emptiest columns near the even split points"""
    rs = [r for r in rs if r[1] - r[0] > 30]; tot = sum(r[1] - r[0] for r in rs); ks = [max(1, round(n * (r[1] - r[0]) / tot)) for r in rs]
    while sum(ks) > n: ks[ks.index(max(ks))] -= 1
    while sum(ks) < n: ks[ks.index(max(ks))] += 1
    out = []
    for (x0, x1), k in zip(rs, ks):
        cnt = fg[:, x0:x1].sum(0); cuts = [x0]; w = (x1 - x0) / k
        for j in range(1, k):
            c = int(w * j); lo, hi = max(1, c - int(w // 4)), min(x1 - x0 - 1, c + int(w // 4))
            cuts.append(x0 + lo + int(np.argmin(cnt[lo:hi])))
        cuts.append(x1); out += [[cuts[j], cuts[j + 1]] for j in range(k)]
    return out

def extract(name, scale_ref=None, thr=95, char=True, merge=12, split=False, n=None):
    fn = next((f"{RAW}/{name}.{e}" for e in ("jpg", "png") if os.path.exists(f"{RAW}/{name}.{e}")), f"{RAW}/{name}.jpg")
    a = np.asarray(Image.open(fn).convert("RGB"))
    fg = key_mask(a, thr)
    rs = items(a, fg, merge=merge); res = []
    if n:
        rs = split_n(fg, rs, n); fg = fg.copy()
        for x0, x1 in rs:                        # drop neighbour bits cut off at the crop edges (hair tips, boot toes)
            lab, k = nd.label(fg[:, x0:x1]); sz = nd.sum(fg[:, x0:x1], lab, range(1, k + 1))
            for j, z in enumerate(sz, 1):
                cols = np.nonzero((lab == j).any(0))[0]
                if z < .15 * sz.max() and (cols.min() == 0 or cols.max() == x1 - x0 - 1): fg[:, x0:x1][lab == j] = False
    elif split: rs = split_wide(fg, rs)
    for i, (x0, x1) in enumerate(rs):
        m = fg[:, x0:x1]; ys = np.nonzero(m.any(1))[0]; y0, y1 = ys.min(), ys.max() + 1
        res.append(dict(i=i, x0=x0, x1=x1, y0=int(y0), y1=int(y1), h=int(y1 - y0)))
    return a, fg, res

def load_pal(id_):
    P_ = np.asarray(Image.open(f"{ROOT}/tools/work/{id_}_pal.png").convert("RGBA"))[0, :, :3].astype(int)
    pal = Image.new("P", (1, 1)); pal.putpalette(list(P_.ravel()) + list(P_[0]) * (256 - len(P_))); return pal, P_

def down(a, fg, it, s, char=True, pal=None):
    sl = (slice(it["y0"], it["y1"]), slice(it["x0"], it["x1"]))
    pl, PP = pal or (PAL, P)
    o = mode_downscale(np.ascontiguousarray(a[sl]), fg[sl], s, pl, PP)
    if char: o = outline(o)
    return clean_specks(o, 3)

if __name__ == "__main__":
    report = {}
    # (sheet, merge gap px, reference standing height in source px or None = tallest item)
    for name, merge, ref in [("nerd_idle_v1", 0, None), ("nerd_walk_v2", 0, None), ("nerd_walk_v1", 0, None), ("nerd_walkback_v1", 0, None),
                             ("nerd_teleport_v2", 0, 198), ("nerd_defeat_v1", 9, 137)]:
        char = True
        a, fg, its = extract(name, thr=60 if "defeat" in name else 95, merge=merge)
        ref = ref or max(it["h"] for it in its)
        s = TALL / ref
        for it in its:
            o = down(a, fg, it, s, char)
            Image.fromarray(o).save(f"{OUT}/{name}_{it['i']:02d}.png"); it["out"] = list(o.shape[:2])
        report[name] = dict(scale=s, items=its)
        print(name, round(s, 4), [(it["i"], it["h"], it["out"]) for it in its])
    json.dump(report, open(f"{OUT}/report.json", "w"), indent=1, default=int)
