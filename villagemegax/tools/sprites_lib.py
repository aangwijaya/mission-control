"""Shared helpers: key out flat backgrounds, split sheets into sprites, SNES-style mode downscale."""
import numpy as np
from PIL import Image
from scipy import ndimage as nd

def bg_color(a):
    b = np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3), a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3)])
    return np.median(b, 0)

def key_mask(a, thr=95):
    bg = bg_color(a); d = np.sqrt(((a.astype(float) - bg) ** 2).sum(-1))
    fg = d > thr
    fg = nd.binary_opening(fg, iterations=1); fg = nd.binary_fill_holes(fg)
    # JPEG halo: edge pixels whose colour is still close-ish to the background
    band = fg & ~nd.binary_erosion(fg, iterations=3)
    return fg & ~(band & (d < thr * 1.9))

def split(img, n=None, min_area=1500, dil=1, rows=False):
    a = np.asarray(img.convert("RGB")); fg = key_mask(a)
    lab, _ = nd.label(nd.binary_dilation(fg, iterations=dil))
    comps = []
    for i, sl in enumerate(nd.find_objects(lab), 1):
        m = (lab[sl] == i) & fg[sl]
        if m.sum() >= min_area: comps.append((i, sl, m))
    if n is not None and len(comps) > n:   # merge loose bits (wrench, bird, antenna bulb) into the nearest big sprite
        comps.sort(key=lambda t: -t[2].sum()); mains, extra = comps[:n], comps[n:]
        groups = [[c] for c in mains]
        for c in extra:
            cx = (c[1][1].start + c[1][1].stop) / 2
            j = min(range(n), key=lambda j: abs((groups[j][0][1][1].start + groups[j][0][1][1].stop) / 2 - cx)); groups[j].append(c)
        comps = []
        for g in groups:
            y0 = min(c[1][0].start for c in g); y1 = max(c[1][0].stop for c in g); x0 = min(c[1][1].start for c in g); x1 = max(c[1][1].stop for c in g)
            sl = (slice(y0, y1), slice(x0, x1)); m = np.isin(lab[sl], [c[0] for c in g]) & fg[sl]; comps.append((0, sl, m))
    out = [(sl, m) for _, sl, m in comps]
    if rows:
        out.sort(key=lambda t: (t[0][0].start + t[0][0].stop) / 2); keyed, row, last = [], 0, None
        for t in out:
            cy = (t[0][0].start + t[0][0].stop) / 2
            if last is not None and cy - last > 60: row += 1
            last = cy; keyed.append((row, t[0][1].start, t))
        keyed.sort(key=lambda k: (k[0], k[1])); out = [k[2] for k in keyed]
    else: out.sort(key=lambda t: t[0][1].start)
    if n is not None and len(out) != n: raise SystemExit(f"expected {n} sprites, got {len(out)}")
    return a, out

def make_palette(rgb_pixels, n):
    px = rgb_pixels[np.random.default_rng(0).permutation(len(rgb_pixels))[:80000]]
    pal = Image.fromarray(px[None].astype(np.uint8)).quantize(n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    return pal, np.array(pal.getpalette()[:3 * n]).reshape(-1, 3)

def mode_downscale(rgb, m, scale, pal, P):
    """every target pixel = most common palette colour of its source block (crisp, no blur)"""
    n = len(P); h, w = m.shape; H, W = max(1, round(h * scale)), max(1, round(w * scale))
    idx = np.asarray(Image.fromarray(rgb).quantize(palette=pal, dither=Image.Dither.NONE)).astype(np.int64) + 1
    idx[~m] = 0
    by = np.minimum((np.arange(h) * H) // h, H - 1); bx = np.minimum((np.arange(w) * W) // w, W - 1)
    blk = (by[:, None] * W + bx[None, :]).ravel()
    cnt = np.bincount(blk * (n + 1) + idx.ravel(), minlength=H * W * (n + 1)).reshape(H * W, n + 1)
    trans = cnt[:, 0] > cnt.sum(1) * .5; cnt[:, 0] = 0; best = cnt.argmax(1)
    o = np.zeros((H * W, 4), np.uint8); o[:, :3] = P[best - 1]; o[:, 3] = np.where(trans, 0, 255)
    return o.reshape(H, W, 4)

def outline(o, col=(20, 24, 48)):
    m = o[..., 3] > 0; edge = m & ~nd.binary_erosion(m, border_value=0)
    fix = edge & (o[..., :3].astype(int).sum(-1) > 330)
    o = o.copy(); o[fix, :3] = col; return o

def clean_specks(o, min_px=3):
    m = o[..., 3] > 0; lab, n = nd.label(m)
    if n > 1:
        sizes = nd.sum(m, lab, range(1, n + 1))
        for i, s in enumerate(sizes, 1):
            if s < min_px: o[lab == i, 3] = 0
    return o
