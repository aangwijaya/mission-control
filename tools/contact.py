import sys, glob
from PIL import Image
W = "/workspace/mission-control/villagemegax-anim/tools/work"
IDS = ["nerd", "makelar", "alcapone", "sisotoy", "kuku", "kurir", "jack"]
keys = sys.argv[2].split(",") if len(sys.argv) > 2 else ["idle", "wave", "sit", "back"]
k = int(sys.argv[3]) if len(sys.argv) > 3 else 3; cw, ch = 64, 96
sheet = Image.new("RGBA", (len(keys) * len(IDS) * cw * k // 1, ch * k), (220, 236, 255, 255))
x = 0
for key in keys:
    for id_ in IDS:
        im = Image.open(f"{W}/{id_}_{key}.png"); im = im.resize((im.width * k, im.height * k), Image.NEAREST)
        sheet.alpha_composite(im, (x + (cw * k - im.width) // 2, ch * k - im.height)); x += cw * k
sheet.save(sys.argv[1])
