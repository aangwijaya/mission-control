"""Readable blink frames. Eye boxes are hand-picked per master (x0,x1,y0,y1 inclusive) plus a skin sample.
Inside each box every non-skin pixel (iris, sclera, lashes) is painted with skin, then a 1-px dark lid line is
drawn on the eye's lower row with the outer corner dropping one pixel -> a clear anime 'closed eye'.
nerd has a visor: instead of closing eyes we draw a bright diagonal glint across the visor."""
import numpy as np
EYES = {
    "makelar": dict(skin=(25, 20), boxes=[(19, 23, 14, 18, "L"), (27, 30, 14, 18, "R")]),
    "alcapone": dict(skin=(24, 23), boxes=[(19, 22, 19, 21, "L"), (25, 27, 19, 21, "R")]),
    "sisotoy": dict(skin=(20, 25), boxes=[(12, 16, 20, 23, "L"), (20, 23, 20, 23, "R")]),
    "kuku": dict(skin=(19, 29), boxes=[(14, 18, 24, 28, "L"), (21, 24, 24, 28, "R")]),
    "kurir": dict(skin=(25, 21), boxes=[(20, 23, 16, 19, "L"), (27, 30, 16, 19, "R")]),
    "jack": dict(skin=(21, 13), boxes=[(23, 26, 13, 15, "L"), (28, 30, 13, 15, "R")]),
}
VISOR = {"nerd": (14, 29, 14, 19)}

def close_eyes(o, id_, dx=0, dy=0):
    out = o.copy()
    if id_ in VISOR: return glint(out, id_, dx, dy)
    cfg = EYES[id_]; sx, sy = cfg["skin"]; skin = o[sy + dy, sx + dx, :3].astype(int)
    lid = None
    for x0, x1, y0, y1, side in cfg["boxes"]:
        x0, x1, y0, y1 = x0 + dx, x1 + dx, y0 + dy, y1 + dy
        box = o[y0:y1 + 1, x0:x1 + 1, :3].astype(int)
        diff = np.abs(box - skin).sum(2); eye = (diff > 70) & (o[y0:y1 + 1, x0:x1 + 1, 3] > 0)
        if not eye.any(): continue
        ys, xs = np.nonzero(eye)
        dark = box[eye].sum(1); d = box[eye][np.argmin(dark)]; lid = d if lid is None else lid
        sub = out[y0:y1 + 1, x0:x1 + 1]; sub[eye, :3] = skin
        ly = ys.max() - 1 if ys.max() - ys.min() >= 2 else ys.max()
        xa, xb = xs.min(), xs.max()
        for x in range(xa, xb + 1): sub[ly, x, :3] = (36, 22, 34)
        # outer corner drops a pixel (eye-lash tail)
        cx = xa if side == "L" else xb
        if ly + 1 < sub.shape[0]: sub[ly + 1, cx, :3] = (36, 22, 34)
        else: sub[ly, cx, :3] = (36, 22, 34)
    return out

def glint(out, id_, dx, dy):
    x0, x1, y0, y1 = VISOR[id_]; x0 += dx; x1 += dx; y0 += dy; y1 += dy
    reg = out[y0:y1 + 1, x0:x1 + 1]; rgb = reg[..., :3].astype(int)
    visor = (rgb[..., 2] > 150) & (rgb[..., 1] > 150) & (rgb[..., 0] < 150) & (reg[..., 3] > 0)
    dark = (rgb.sum(2) < 260) & (reg[..., 3] > 0)                 # eyes seen through the visor
    reg[visor | dark, :3] = (150, 236, 255)                          # visor lights up (eyes wash out)
    h, w = reg.shape[:2]
    for y in range(h):
        for k, c in ((0, (255, 255, 255)), (1, (255, 255, 255)), (2, (210, 250, 255)), (6, (225, 252, 255))):
            x = 3 + k + (h - 1 - y)
            if 0 <= x < w and (visor | dark)[y, x]: reg[y, x, :3] = c
    return out
