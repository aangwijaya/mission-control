"""Stage 1: cut every pose of every agent out of the AI sheets and bring it to the master pixel grid,
recoloured to that agent's own 16-colour master palette (SNES-style)."""
import json, numpy as np, sys
from PIL import Image
sys.path.insert(0, __file__.rsplit("/", 1)[0]); from sprites_lib import *
RAW = "/workspace/mission-control/villagemegax-anim/concepts/raw"; OUT = "/workspace/mission-control/villagemegax-anim/tools/work"
import os; os.makedirs(OUT, exist_ok=True)
IDS = ["nerd", "makelar", "alcapone", "sisotoy", "kuku", "kurir", "jack"]
TALL = 88                         # tallest master (alcapone with fin) in pixels
sheets = {k: split(Image.open(f"{RAW}/{f}"), 7) for k, f in
          [("idle", "lineup_v2.jpg"), ("wave", "lineup_wave_v1.jpg"), ("sit", "lineup_sit_v1.jpg"), ("back", "lineup_back_v1.jpg")]}
a0, sp0 = sheets["idle"]; hmax = max(sl[0].stop - sl[0].start for sl, _ in sp0); S = TALL / hmax
info = {}
for i, id_ in enumerate(IDS):
    sl, m = sp0[i]; pal, P = make_palette(a0[sl][m], 16)
    info[id_] = {}
    for k, (a, sp) in sheets.items():
        sl2, m2 = sp[i]
        # same character should be the same size on every sheet: match by (head-to-boot) height for standing poses
        h_master = sl[0].stop - sl[0].start; h_this = sl2[0].stop - sl2[0].start
        s = S * (h_master / h_this) if k in ("back",) else S
        m2 = m2.copy()
        if False and k == "sit":   # drop the wooden stool the generator drew (brown/tan pixels in the lower 45%)
            rgb = a[sl2].astype(int); r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
            brown = (r > 70) & (r > g + 18) & (g > b + 8) & (r < 200) & (b < 120)
            low = np.zeros_like(m2); low[int(m2.shape[0] * .55):] = True
            from scipy import ndimage as nd
            stool = nd.binary_dilation(brown & low, iterations=2) & low
            if id_ == "jack": stool &= ~np.zeros_like(stool)   # jack's beard is up top, safe
            m2 &= ~stool
        o = clean_specks(outline(mode_downscale(a[sl2], m2, s, pal, P)), 12)
        Image.fromarray(o).save(f"{OUT}/{id_}_{k}.png"); info[id_][k] = o.shape[:2]
    Image.fromarray(np.uint8(np.c_[P, np.full(16, 255)].reshape(1, 16, 4))).save(f"{OUT}/{id_}_pal.png")
print(json.dumps(info))
