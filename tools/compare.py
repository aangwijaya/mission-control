"""Before/after comparison sheets (v1 = ../villagemegax-v1, before shots = screenshots/before)."""
import numpy as np
from PIL import Image, ImageDraw, ImageFont
R = "/workspace/mission-control"; V = f"{R}/villagemegax"; O = f"{V}/screenshots"
F = ImageFont.truetype(f"{R}/fonts/PressStart2P-Regular.ttf", 16); Fs = ImageFont.truetype(f"{R}/fonts/PressStart2P-Regular.ttf", 10)
BG = (13, 22, 52); GOLD = (255, 212, 71)

def captioned(img, text, col=GOLD):
    c = Image.new("RGB", (img.width, img.height + 34), BG); c.paste(img, (0, 34)); ImageDraw.Draw(c).text((10, 9), text, font=F, fill=col); return c
def vstack(ims, gap=8):
    w = max(i.width for i in ims); c = Image.new("RGB", (w, sum(i.height for i in ims) + gap * (len(ims) - 1)), BG); y = 0
    for i in ims: c.paste(i, (0, y)); y += i.height + gap
    return c
def hstack(ims, gap=8):
    h = max(i.height for i in ims); c = Image.new("RGB", (sum(i.width for i in ims) + gap * (len(ims) - 1), h), BG); x = 0
    for i in ims: c.paste(i, (x, 0)); x += i.width + gap
    return c

# 1) consoles
b = Image.open(f"{O}/before/02-demo-zoom.png").convert("RGB").crop((0, 170, 1280, 470))
a = Image.open(f"{O}/02-demo-zoom.png").convert("RGB").crop((0, 150, 1280, 450))
vstack([captioned(b, "BEFORE: konsol prosedural (polos)"), captioned(a, "AFTER: konsol AI pixel-art + holo screen & monitor animasi")]).save(f"{O}/cmp-consoles-before-after.png")

# 2) faces across frames (head crops from the sprite sheets, x4)
def sheet_crops(path, frames, names, S=4, H=44):
    im = Image.open(path).convert("RGBA"); out = []
    for f in names:
        if f not in frames: out.append(None); continue
        i = frames.index(f); cell = im.crop((i * 64, 0, i * 64 + 64, 96)); a = np.asarray(cell)[..., 3]
        top = int(np.nonzero(a.any(1))[0].min()); cell = cell.crop((4, top, 60, top + H))
        bg = Image.new("RGBA", cell.size, (205, 222, 245, 255)); bg.alpha_composite(cell); out.append(bg.convert("RGB").resize((cell.width * S, cell.height * S), Image.NEAREST))
    return out
import json
fr_old = json.load(open(f"{R}/villagemegax-v1/assets/sprites/sprites.json"))["frames"]; fr_new = json.load(open(f"{V}/assets/sprites/sprites.json"))["frames"]
NAMES = ["idle0", "blink", "sit0", "sitblink", "wave0"]
rows = []
hdr = Image.new("RGB", (5 * 232, 26), BG); d = ImageDraw.Draw(hdr)
for k, n in enumerate(NAMES): d.text((k * 232 + 8, 6), n, font=Fs, fill=(159, 216, 255))
for id_ in ["nerd", "makelar", "alcapone", "sisotoy", "kuku", "kurir", "jack"]:
    pair = []
    for path, fr, tag in [(f"{R}/villagemegax-v1/assets/sprites/{id_}.png", fr_old, "before"), (f"{V}/assets/sprites/{id_}.png", fr_new, "after")]:
        cr = sheet_crops(path, fr, NAMES); tiles = []
        for c in cr:
            t = Image.new("RGB", (224, 176), (60, 70, 100))
            if c is not None: t.paste(c, (0, 0))
            else: ImageDraw.Draw(t).text((40, 80), "(n/a)", font=Fs, fill=(200, 200, 200))
            tiles.append(t)
        row = hstack(tiles); lab = Image.new("RGB", (120, row.height), BG); dd = ImageDraw.Draw(lab)
        dd.text((6, 60), id_, font=Fs, fill=GOLD); dd.text((6, 84), tag, font=Fs, fill=(255, 120, 120) if tag == "before" else (92, 240, 138))
        pair.append(hstack([lab, row], 0))
    rows.append(vstack(pair, 2))
sheet = vstack([captioned(Image.new("RGB", (120 + 5 * 232, 1), BG), "WAJAH ANTAR-FRAME: before (v1) vs after"), hstack([Image.new("RGB", (120, 26), BG), hdr], 0)] + rows, 10)
sheet.save(f"{O}/cmp-faces-before-after.png")

# 3) default view fit
b = Image.open(f"{O}/before/01-default.png").convert("RGB"); a = Image.open(f"{O}/01-default.png").convert("RGB")
hstack([captioned(b, "BEFORE: x1 di 1280x800 (peta kepotong)"), captioned(a, "AFTER: x1 di 1280x800 (seluruh HQ muat)")], 16).save(f"{O}/cmp-default-fit-before-after.png")
print("ok")
