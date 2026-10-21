"""Find the eyes in a master sprite automatically (dark clusters inside the skin area of the face)."""
import numpy as np
from scipy import ndimage as nd
def find_eyes(o, head_frac=.36):
    h, w = o.shape[:2]; a = o[..., 3] > 0; rgb = o[..., :3].astype(int)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]; lum = .3 * r + .59 * g + .11 * b
    top = np.zeros((h, w), bool); top[:int(h * head_frac)] = True
    skin = a & top & (r > 150) & (r >= g + 15) & (g >= b) & (r - b > 35) & (r - b < 140) & (lum > 120)
    if skin.sum() < 6: return None, None
    ys, xs = np.nonzero(skin); fy0, fy1, fx0, fx1 = ys.min(), ys.max(), xs.min(), xs.max()
    near = nd.binary_dilation(skin, iterations=2)
    cand = a & near & ~skin & (lum < 120)
    cand[:fy0] = False; cand[fy1 + 1:] = False; cand[:, :fx0] = False; cand[:, fx1 + 1:] = False
    # eyes sit in the upper 2/3 of the face box
    cand[fy0 + int((fy1 - fy0) * .75) + 1:] = False
    lab, n = nd.label(cand)
    if not n: return None, None
    comps = [(int((lab == i).sum()), i) for i in range(1, n + 1)]
    comps = sorted([c for c in comps if 2 <= c[0] <= 9], reverse=True)[:2]
    if not comps: return None, None
    cys = [np.nonzero(lab == i)[0].mean() for _, i in comps]
    if len(comps) == 2 and abs(cys[0] - cys[1]) > 2.5: comps = comps[:1]
    eyes = np.isin(lab, [i for s, i in comps])
    skin_col = np.median(rgb[skin], 0).astype(np.uint8)
    return eyes, skin_col
def blink(o):
    eyes, sc = find_eyes(o)
    if eyes is None or not eyes.any(): return o.copy(), False
    out = o.copy(); out[eyes, :3] = sc
    lab, n = nd.label(eyes)
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i); yb = ys.max()
        for x in range(xs.min(), xs.max() + 1): out[yb, x, :3] = (40, 28, 40)
    return out, True
