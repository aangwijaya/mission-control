"""AI props sheet -> separate pixel sprites at world scale (each with its own 24-colour palette)."""
import json, sys, numpy as np
from PIL import Image
sys.path.insert(0, __file__.rsplit("/", 1)[0]); from sprites_lib import *
RAW = "/workspace/mission-control/villagemegax/concepts/raw"; OUT = "/workspace/mission-control/villagemegax/assets/props"
import os; os.makedirs(OUT, exist_ok=True)
NAMES = [("core", 132), ("sofa", 92), ("sofa_side", 84), ("plant", 34), ("crates2", 46), ("crate", 42),
         ("server", 38), ("lamp", 22), ("drone", 34), ("vending", 46), ("cooler", 28), ("table", 34)]
a, sp = split(Image.open(f"{RAW}/props_v1.jpg"), 12, rows=True)
meta = {}
for (name, tw), (sl, m) in zip(NAMES, sp):
    pal, P = make_palette(a[sl][m], 24); s = tw / (sl[1].stop - sl[1].start)
    o = clean_specks(outline(mode_downscale(a[sl], m, s, pal, P)), 6)
    Image.fromarray(o).save(f"{OUT}/{name}.png"); meta[name] = [int(o.shape[1]), int(o.shape[0])]
json.dump(meta, open(f"{OUT}/props.json", "w")); print(meta)
