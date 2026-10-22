"""Derive sit + wave frames from each master so head/face pixels are IDENTICAL to idle.
sit  = master upper body (head+torso+arms, exact pixels) + legs/stool from the AI sit sheet
wave = AI wave sheet body + master head pasted exactly (raised hand kept from the wave sheet)
Writes work/<id>_sitM.png and work/<id>_waveM.png"""
import os, sys, numpy as np
from PIL import Image
from scipy import ndimage as nd
WK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "work")
# neck row (last head row) and waist row in master coords, tuned per agent by eye
CUT = {"nerd": (21, 43), "makelar": (25, 44), "alcapone": (26, 48), "sisotoy": (27, 47),
       "kuku": (32, 50), "kurir": (29, 45), "jack": (27, 46)}
# raised glove box (wave-sheet coords x0,x1,y0,y1) for sprites where the auto glove test fails
HANDBOX = {"makelar": (0, 11, 4, 19)}
ld = lambda n: np.asarray(Image.open(f"{WK}/{n}.png").convert("RGBA")).copy()

def best_offset(m, mask, t, r=6):
    """offset (dx,dy) so that m[mask] matches t best"""
    ys, xs = np.nonzero(mask); best = None
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            ty, tx = ys + dy, xs + dx
            ok = (ty >= 0) & (ty < t.shape[0]) & (tx >= 0) & (tx < t.shape[1])
            if ok.sum() < len(ys) * .8: continue
            tp = t[ty[ok], tx[ok]]; mp = m[ys[ok], xs[ok]]
            both = tp[:, 3] > 0
            diff = np.abs(tp[both, :3].astype(int) - mp[both, :3].astype(int)).sum(1).mean() if both.any() else 999
            score = diff + 300 * (1 - both.mean()) + 300 * (1 - ok.mean())
            if best is None or score < best[0]: best = (score, dx, dy)
    return best[1], best[2]

def canvas(t, pad=6):
    c = np.zeros((t.shape[0] + 2 * pad, t.shape[1] + 2 * pad, 4), np.uint8); c[pad:pad + t.shape[0], pad:pad + t.shape[1]] = t; return c

def crop(c):
    a = c[..., 3] > 0; ys, xs = np.nonzero(a); return c[ys.min():ys.max() + 1, xs.min():xs.max() + 1]

def paste_mask(dst, src, mask, dx, dy):
    ys, xs = np.nonzero(mask); dst[ys + dy, xs + dx] = src[ys, xs]

def make_wave(m, w, neck, hb=None):
    P = 6; W = canvas(w, P); H, Wd = m.shape[:2]
    head = np.zeros(m.shape[:2], bool); head[:neck + 1] = m[:neck + 1, :, 3] > 0
    # restrict head to the head's own columns (exclude hands/props that reach up to head level in idle)
    lab, n = nd.label(head); sizes = nd.sum(head, lab, range(1, n + 1)); head = lab == (1 + int(np.argmax(sizes)))
    dx, dy = best_offset(m, head, w); dx += P; dy += P
    # clear the old head of the wave sheet: inside dilated head silhouette, rows <= neck
    big = nd.binary_dilation(head, iterations=2); big[neck + 1:] = False
    ys, xs = np.nonzero(big); old = W[ys + dy, xs + dx]
    # keep raised-hand pixels: wave pixels far from the old head colours are hand/glove -> keep if outside head bbox cols
    hx0, hx1 = np.nonzero(head.any(0))[0][[0, -1]]
    keep = (xs < hx0) | (xs > hx1)
    W[ys[~keep] + dy, xs[~keep] + dx] = 0
    orig = canvas(w, P); paste_mask(W, m, head, dx, dy)
    # put the raised glove back on top of the hair: light, low-saturation components of the wave sheet
    # (above the neck) that stick out beside the head
    rgb = orig[..., :3].astype(int); lum = rgb.mean(2); sat = rgb.max(2) - rgb.min(2)
    glove = (orig[..., 3] > 0) & (lum > 165) & (sat < 60); glove[neck + dy + 3:] = False
    if hb:
        x0, x1, y0, y1 = hb; box = np.zeros_like(glove); box[y0 + P:y1 + P + 1, x0 + P:x1 + P + 1] = True
        g2 = glove & box; sel = nd.binary_fill_holes(nd.binary_closing(g2, iterations=1) | (nd.binary_dilation(g2, iterations=1) & (lum < 110))) & box & (orig[..., 3] > 0)
        W[sel] = orig[sel]
    lab, n = nd.label(glove)
    for i in range(1, n + 1):
        cm = lab == i; ys2, xs2 = np.nonzero(cm)
        if cm.sum() < 6: continue
        out_cols = ((xs2 - dx) < hx0 + 2).mean() > .5 or ((xs2 - dx) > hx1 - 2).mean() > .5
        if not out_cols: continue
        ring = nd.binary_dilation(cm, iterations=1) & (orig[..., 3] > 0) & (lum < 110)
        sel = cm | ring; W[sel] = orig[sel]
    return crop(W), (dx - P, dy - P)

def make_sit(m, s, neck, waist):
    P = 6; S = canvas(s, P)
    head = np.zeros(m.shape[:2], bool); head[:neck + 1] = m[:neck + 1, :, 3] > 0
    dx, dy = best_offset(m, head, s); dx += P; dy += P
    S[:waist + dy + 1] = 0                                   # drop the AI sheet's upper body
    up = np.zeros(m.shape[:2], bool); up[:waist + 1] = m[:waist + 1, :, 3] > 0
    paste_mask(S, m, up, dx, dy)
    return crop(S), (dx - P, dy - P)

if __name__ == "__main__":
    for id_, (neck, waist) in CUT.items():
        m = ld(f"{id_}_idle"); wv, o1 = make_wave(m, ld(f"{id_}_wave"), neck, HANDBOX.get(id_)); st, o2 = make_sit(m, ld(f"{id_}_sit"), neck, waist)
        Image.fromarray(wv).save(f"{WK}/{id_}_waveM.png"); Image.fromarray(st).save(f"{WK}/{id_}_sitM.png")
        print(id_, "wave off", o1, wv.shape[:2], "sit off", o2, st.shape[:2])
