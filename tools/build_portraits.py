"""Dialog bust portraits: portraits/raw/<id>_<ver>.jpg (AI-generated on magenta) -> assets/portraits/<id>.png
Key out the magenta, keep the character, SNES-style mode downscale with a 32-colour palette per portrait,
dark outline on bright edge pixels. One fixed scale for every portrait so the framing stays consistent."""
import os, sys, numpy as np
from os.path import dirname, abspath
from PIL import Image
sys.path.insert(0, dirname(abspath(__file__)))
from sprites_lib import key_mask, make_palette, mode_downscale, outline, clean_specks
from scipy import ndimage as nd

ROOT = dirname(dirname(abspath(__file__)))
SRC = {"nerd": "nerd_v2", "makelar": "makelar_v2", "alcapone": "alcapone_v2", "sisotoy": "sisotoy_v2",
       "kuku": "kuku_v2", "kurir": "kurir_v2", "jack": "jack_v2"}
SCALE = 1 / 6.4          # ~6.4 source px per art pixel -> busts end up ~125-150 px tall
COLORS = 32

def build(id_):
    a = np.asarray(Image.open(f"{ROOT}/portraits/raw/{SRC[id_]}.jpg").convert("RGB"))
    fg = key_mask(a, 95)
    lab, n = nd.label(fg); sizes = nd.sum(fg, lab, range(1, n + 1))
    fg = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 400])      # drop JPEG crumbs, keep antenna/bird bits
    ys, xs = np.nonzero(fg); sl = (slice(ys.min(), ys.max() + 1), slice(xs.min(), xs.max() + 1))
    rgb, m = np.ascontiguousarray(a[sl]), fg[sl]
    pal, P = make_palette(rgb[m], COLORS)
    o = clean_specks(outline(mode_downscale(rgb, m, SCALE, pal, P)), 4)
    ys, xs = np.nonzero(o[..., 3] > 0); o = o[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    Image.fromarray(o).save(f"{ROOT}/assets/portraits/{id_}.png", optimize=True)
    return o.shape

if __name__ == "__main__":
    os.makedirs(f"{ROOT}/assets/portraits", exist_ok=True)
    for k in SRC: print(k, build(k))
