"""Ponytail sway for long hair that hangs behind a sprite's LEFT side (alcapone B: idle, walk, walkd, backd).
The AI sheets drew the ponytail nearly frozen, so every row of the hair is stretched or squeezed horizontally
(right end stays attached to the body, the tip moves most) by a per-frame offset -> the tail visibly swings.
Hair rows = rows whose leftmost run (until the first non-hair, non-outline pixel) is mostly hair gold."""
import numpy as np
HAIR = np.array([(0xf6, 0xaf, 0x3e), (0xbb, 0x7c, 0x31), (0xa4, 0x5f, 0x18), (0xfc, 0xd2, 0x89), (0xe7, 0xbf, 0x7a)])
LINE = np.array([(0x0c, 0x06, 0x0e), (0x1c, 0x12, 0x21), (20, 24, 48), (0x3b, 0x1f, 0x1e)])

def _is(px, cols): return (np.abs(px[:, None, :3].astype(int) - cols[None]).sum(2) < 8).any(1)

def segments(c, y0, y1):
    """per row: (xl, xr) of the leftmost hair run or None"""
    out = {}
    for y in range(y0, y1):
        row = c[y]; xs = np.nonzero(row[:, 3] > 0)[0]
        if not len(xs): continue
        xl = xs[0]; x = xl
        while x < c.shape[1] and row[x, 3] > 0 and (_is(row[x:x + 1], HAIR)[0] or _is(row[x:x + 1], LINE)[0]): x += 1
        seg = row[xl:x]
        if x - xl >= 2 and _is(seg, HAIR).mean() >= .5: out[y] = (xl, x - 1)
    return out

def sway(c, d, top_frac=.30, bot_frac=.70):
    """stretch the hair rows of cell c: tip moves by d px (negative = flares out to the left)"""
    if d == 0: return c
    a = c[..., 3] > 0; rows = np.nonzero(a.any(1))[0]; t0, b0 = rows.min(), rows.max(); H = b0 - t0
    seg = segments(c, t0 + int(H * top_frac), t0 + int(H * bot_frac))
    if len(seg) < 4: return c
    ys = sorted(seg); ya, yb = ys[0], ys[-1]; o = c.copy()
    for y in ys:
        xl, xr = seg[y]; t = ((y - ya) / max(1, yb - ya)) ** 1.3; dx = int(round(d * t))
        if dx == 0: continue
        n0 = xr - xl + 1; nl = max(1, xl + dx); n1 = xr - nl + 1
        if n1 < 1: continue
        src = c[y, xl:xr + 1].copy(); idx = np.minimum(n0 - 1, (np.arange(n1) * n0 / n1).astype(int))
        o[y, min(xl, nl):xr + 1] = 0; o[y, nl:xr + 1] = src[idx]
        o[y, nl] = src[0]                                   # keep the outline pixel at the outer edge
    return o

# per-sequence tip offsets (px at sprite scale), one per frame of the sequence
SWAY = {"alcapone": dict(idle=[0, -1, -1, 0], walk=[-1, 1, 1, -1, -3, -3], walkd=[-1, 1, 1, -1, -3, -3], backd=[0, 1, 0, -1, -2, -1])}
