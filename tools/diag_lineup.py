"""Lineup GIF/PNG of the Neo HQ diagonal walks (walkd/backd + their mirrors) for all crew -> screenshots/diag-lineup.*"""
import json, os
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
k = json.load(open(f"{ROOT}/assets/sprites/kairo.json"))["agents"]
ids = ["nerd", "makelar", "alcapone", "sisotoy", "kuku", "kurir", "jack"]
sh = {i: Image.open(f"{ROOT}/assets/sprites/{k[i]['sheet']}").convert("RGBA") for i in ids}
F = ImageFont.truetype(f"{ROOT}/fonts/PressStart2P-Regular.ttf", 8)
S, CW, CH, LW = 2, 64, 96, 96
rows = [("walkd", ["walkd", "kanan-bawah"], False), ("walkd", ["walkd", "kiri-bawah", "(cermin)"], True),
        ("backd", ["backd", "kanan-atas"], False), ("backd", ["backd", "kiri-atas", "(cermin)"], True)]
frames = []
for t in range(60):                                      # one gif frame = 4 game ticks at 60 fps
    c = Image.new("RGBA", (LW + len(ids) * CW * S, 22 + len(rows) * CH * S), (28, 30, 52, 255)); d = ImageDraw.Draw(c)
    for j, i in enumerate(ids): d.text((LW + j * CW * S + 20, 6), i, fill=(255, 230, 120), font=F)
    for r, (seq, lab, fl) in enumerate(rows):
        y = 22 + r * CH * S
        for n, l in enumerate(lab): d.text((6, y + CH * S // 2 - 14 + n * 13), l, fill=(180, 200, 255), font=F)
        for j, i in enumerate(ids):
            s = k[i]["seq"][seq]; f = s[(t * 4 // k[i]["ticks"][seq]) % len(s)]
            cell = sh[i].crop((f * CW, 0, f * CW + CW, CH))
            if fl: cell = cell.transpose(Image.FLIP_LEFT_RIGHT)
            c.alpha_composite(cell.resize((CW * S, CH * S), Image.NEAREST), (LW + j * CW * S, y))
    frames.append(c.convert("RGB"))
os.makedirs(f"{ROOT}/screenshots", exist_ok=True)
pal = frames[0].quantize(colors=255, method=Image.Quantize.MEDIANCUT)
q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames]
q[0].save(f"{ROOT}/screenshots/diag-lineup.gif", save_all=True, append_images=q[1:], duration=67, loop=0, optimize=True)
frames[7].save(f"{ROOT}/screenshots/diag-lineup.png")
