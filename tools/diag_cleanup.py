"""Pixel cleanup for the Neo HQ diagonal frames (walkd/backd): removes tiny generator-invented dots/emblems on the
chest or back, near the torso centre column, below the head.
pass 1: small groups of neutral mid-grey pixels (the usual "emblem" colour) sitting on armour/panel seams;
pass 2: any remaining small neutral or near-black speck that is completely enclosed by coloured armour.
Repainted pixels take the most common surrounding armour colour. White specks are kept (they are highlights)."""
import numpy as np
from scipy import ndimage as nd

def _sat(rgb): return rgb.max(-1) - rgb.min(-1)
K8 = np.ones((3, 3))

def clean_dots(o, band=(0.0, 1.0), cx=None, half_w=10, sat_min=45, y_from=None):
    """o: RGBA sprite. band: vertical range as fractions of the sprite height (y_from: px from the top, min).
    Returns (cleaned copy, repainted mask)."""
    o = o.copy(); a = o[..., 3] > 0
    rows = np.nonzero(a.any(1))[0]; top, h = rows.min(), rows.max() - rows.min() + 1
    y0, y1 = top + int(band[0] * h), top + int(band[1] * h)
    if y_from is not None: y0 = max(y0, top + y_from)
    done = np.zeros_like(a)

    def run(cand, max_px, ok):
        rgb = o[..., :3].astype(int); lum = rgb.mean(-1)
        armour = a & (_sat(rgb) >= sat_min) & (lum >= 50)
        lab, n = nd.label(cand(rgb, lum, armour), K8)
        for i in range(1, n + 1):
            m = lab == i; ys, xs = np.nonzero(m)
            if m.sum() > max_px or ys.min() < y0 or ys.max() > y1: continue
            if cx is not None and abs(xs.mean() - cx) > half_w: continue
            ring = nd.binary_dilation(m, K8) & ~m
            if not ok(ring, armour): continue
            cols, cnt = np.unique(rgb[ring & armour], axis=0, return_counts=True)
            o[m, :3] = cols[cnt.argmax()]; done[m] = True

    run(lambda rgb, lum, arm: a & (_sat(rgb) < 25) & (lum >= 110) & (lum < 196), 8,
        lambda ring, arm: a[ring].all() and arm[ring].mean() >= 0.35)
    for _ in range(2):
        run(lambda rgb, lum, arm: a & ~arm & (lum < 200), 6, lambda ring, arm: arm[ring].all())
    return o, done
