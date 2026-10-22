"""Hand-cleaned face for the Alcapone B idle master (the AI face downscaled to mush at 88 px: skin mapped to hair gold,
eyes lost under the visor). Rows 19-25, cols 20-28 of tools/work/alcapone_idle.png; every other frame gets this head
through anim_build.head_swap."""
import sys, numpy as np
from PIL import Image
sys.path.insert(0, __file__.rsplit("/", 1)[0]); from anim_extract import ROOT
K = {"K": "0c060e", "S": "fcd289", "s": "e7bf7a", "H": "f6af3e", "h": "bb7c31", "o": "a45f18", "W": "fafaf5", "E": "1c1221"}
FACE = (20, 19, ["KKKKKKKKK",
                 "HKKSSKKSK",
                 "HEWSSEWSK",
                 "HSSSSSSsK",
                 "HSSSSSssK",
                 "hSSSooSsK",
                 "KKSSSSsKK"])

def paint(o, face=FACE):
    x0, y0, rows = face; o = o.copy()
    for dy, r in enumerate(rows):
        for dx, ch in enumerate(r):
            if ch != ".": o[y0 + dy, x0 + dx] = [int(K[ch][i:i + 2], 16) for i in (0, 2, 4)] + [255]
    return o

if __name__ == "__main__":
    fn = f"{ROOT}/tools/work/alcapone_idle.png"
    Image.fromarray(paint(np.asarray(Image.open(fn).convert("RGBA")))).save(fn)
