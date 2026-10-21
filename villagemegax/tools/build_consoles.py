"""AI console sheet (same prompt style + reference as props_v1) -> console sprite at world scale.
Same pipeline as the props: key the magenta, 24-colour palette, mode downscale, outline, clean specks.
The floating holo screen in the middle is removed (it would sit right in front of the seated agent's face);
the renderer draws its own animated screen + accent light on top."""
import json, sys, numpy as np
from PIL import Image
sys.path.insert(0, __file__.rsplit("/", 1)[0]); from sprites_lib import *
RAW = "/workspace/mission-control/villagemegax/concepts/raw"; OUT = "/workspace/mission-control/villagemegax/assets/props"
TW = int(sys.argv[1]) if len(sys.argv) > 1 else 112; PICK = int(sys.argv[2]) if len(sys.argv) > 2 else 0
a, sp = split(Image.open(f"{RAW}/consoles_v1.jpg"), 4)
sl, m = sp[PICK]
pal, P = make_palette(a[sl][m], 24); s = TW / (sl[1].stop - sl[1].start)
o = clean_specks(outline(mode_downscale(a[sl], m, s, pal, P)), 6)
print(o.shape)

# ---- split off the translucent holo screen (drawn semi-transparent over the seated agent) ----
rgb = o[..., :3].astype(int); al = o[..., 3] > 0
box = np.zeros(al.shape, bool); box[0:30, 54:95] = True
holo = box & al & ((rgb[..., 2] > rgb[..., 0] + 25) | ((rgb.sum(2) > 600) & (rgb[..., 2] > rgb[..., 0] + 8)))
from scipy import ndimage as nd
holo = nd.binary_closing(holo, iterations=1) & al & box
H = np.zeros_like(o); H[holo] = o[holo]
body = o.copy(); body[holo] = 0
DESK_TOP = 17                                       # first row of the desk's back edge
for y, x in zip(*np.nonzero(holo)):
    if y >= DESK_TOP: body[y, x] = o[y, 50]          # refill the desk surface behind the screen
    # top outline of the desk behind the screen
for x in range(54, 95):
    col = np.nonzero(body[:, x, 3] > 0)[0]
    if len(col) and col.min() >= DESK_TOP: body[col.min(), x, :3] = o[DESK_TOP, 50, :3] if False else body[col.min(), x, :3]
ys, xs = np.nonzero(H[..., 3]); x0, x1 = xs.min(), xs.max(); H[:, x0:x1 + 1] = H[:, x0:x1 + 1][:, ::-1]   # seen from behind -> mirrored
Image.fromarray(body).save(f"{OUT}/console.png"); Image.fromarray(H).save(f"{OUT}/console_holo.png")
meta = json.load(open(f"{OUT}/props.json")); meta["console"] = [int(o.shape[1]), int(o.shape[0])]; meta["console_holo"] = meta["console"]
json.dump(meta, open(f"{OUT}/props.json", "w")); print("console", o.shape, "holo px", int(holo.sum()))
