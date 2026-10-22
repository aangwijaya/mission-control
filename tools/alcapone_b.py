"""Alcapone redesign B (white pearl + gold + ice-blue #38c8ff, golden-blond ponytail), stage 1:
lock the 16-colour palette (2 slots reserved for the ice-blue accent) and rebuild the masters in tools/work
(idle/back/wave/sit) from the B AI sheets in anim/raw. Then run: build_poses CUT (neck/waist), anim_build.py alcapone,
build_frames.py alcapone, build_portraits.py alcapone."""
import sys, numpy as np
from PIL import Image
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from sprites_lib import make_palette, mode_downscale, outline, clean_specks
from anim_extract import extract, ROOT
WK = f"{ROOT}/tools/work"; TALL = 88
ICE = lambda x: (x[:, 2] > 170) & (x[:, 0] < 150) & (x[:, 1] > 150) & (x[:, 2] > x[:, 0] + 60)

SKIN = lambda x: (x[:, 0] > 200) & (x[:, 1] > 150) & (x[:, 1] < 215) & (x[:, 2] > 105) & (x[:, 2] < 185) & (x[:, 0] - x[:, 2] > 50)
FRINGE = lambda x: (x[:, 0] > x[:, 1] + 40) & (x[:, 2] > x[:, 1] + 40)          # magenta key bleed (jpeg)

def palette_with_accent(px, n, reserved):
    """median-cut palette + 2 reserved slots (light + shade) per selector, so the tiny ice-blue gems and the face
    survive 16 colours; magenta key bleed never gets a slot"""
    x = px.astype(int); rest = ~FRINGE(x); extra = []
    for sel_f in reserved:
        sel = sel_f(x) & rest; rest &= ~sel; a = x[sel]; lum = a.sum(1)
        extra += [np.median(a[lum >= np.median(lum)], 0), np.median(a[lum < np.median(lum)], 0)]
    _, P = make_palette(px[rest], n - len(extra)); P = np.vstack([P] + extra).astype(int)
    pal = Image.new("P", (1, 1)); pal.putpalette(list(P.ravel()) + list(P[0]) * (256 - n)); return pal, P

def cut(name, i, h, pal, **kw):
    a, fg, its = extract(name, split=True, **kw); it = its[i]; sl = (slice(it["y0"], it["y1"]), slice(it["x0"], it["x1"]))
    o = clean_specks(outline(mode_downscale(np.ascontiguousarray(a[sl]), fg[sl], h / it["h"], *pal)), 12)
    ys, xs = np.nonzero(o[..., 3] > 0); return o[ys.min():ys.max() + 1, xs.min():xs.max() + 1], it["h"]

if __name__ == "__main__":
    a, fg, its = extract("alcapone_idle_v2", split=True); it = its[0]
    px = a[it["y0"]:it["y1"], it["x0"]:it["x1"]][fg[it["y0"]:it["y1"], it["x0"]:it["x1"]]]
    pal = palette_with_accent(px, 16, [SKIN, ICE])
    Image.fromarray(np.uint8(np.c_[pal[1], np.full(16, 255)].reshape(1, 16, 4))).save(f"{WK}/alcapone_pal.png")
    idle, _ = cut("alcapone_idle_v2", 0, TALL, pal); Image.fromarray(idle).save(f"{WK}/alcapone_idle.png")
    back, _ = cut("alcapone_back_v2", 0, TALL - 2, pal); Image.fromarray(back).save(f"{WK}/alcapone_back.png")   # old back master: 88 incl. fin
    wave, hw = cut("alcapone_wavesit_v2", 0, TALL, pal)
    _, _, ws = extract("alcapone_wavesit_v2", split=True)
    sit, _ = cut("alcapone_wavesit_v2", 1, round(TALL * ws[1]["h"] / hw), pal)            # same scale as the wave frame
    Image.fromarray(wave).save(f"{WK}/alcapone_wave.png"); Image.fromarray(sit).save(f"{WK}/alcapone_sit.png")
    print("pal", ["#%02x%02x%02x" % tuple(c) for c in pal[1]]); print("idle", idle.shape[:2], "back", back.shape[:2], "wave", wave.shape[:2], "sit", sit.shape[:2])
