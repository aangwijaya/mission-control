"""Evidence for the Alcapone B rebuild: screenshots/alcapone-b-lineup.png (7 crew idle + every Alcapone kairo cell,
classic frames and icons) and screenshots/alcapone-b-anim.gif (walk/back/walkd/backd + mirrors at game timing, 4x)."""
import json, os
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SP = f"{ROOT}/assets/sprites"
K = json.load(open(f"{SP}/kairo.json"))["agents"]; FS = json.load(open(f"{SP}/sprites.json"))["frames"]
F = ImageFont.truetype(f"{ROOT}/fonts/PressStart2P-Regular.ttf", 10); FS8 = ImageFont.truetype(f"{ROOT}/fonts/PressStart2P-Regular.ttf", 8)
IDS = ["nerd", "makelar", "alcapone", "sisotoy", "kuku", "kurir", "jack"]
NAMES = {"nerd": "nerd", "makelar": "makelar", "alcapone": "Alcapone", "sisotoy": "el sotoy", "kuku": "kuku", "kurir": "Kurir", "jack": "bang jack"}
ACC = dict(__import__("re").findall(r'id:"(\w+)".*?accent:"(#[0-9a-fA-F]{6})"', open(f"{ROOT}/js/agents.js").read()))
sheet = {i: Image.open(f"{SP}/{K[i]['sheet']}").convert("RGBA") for i in IDS}
cellk = lambda i, f: sheet[i].crop((f * 64, 0, f * 64 + 64, 96))
up = lambda im, s: im.resize((im.width * s, im.height * s), Image.NEAREST)
BG = (17, 11, 43, 255)

def lineup():
    a = K["alcapone"]; lab = {f: f"{s}{j}" for s, fs in a["seq"].items() for j, f in enumerate(fs)}; n = sheet["alcapone"].width // 64
    old = Image.open(f"{SP}/alcapone.png").convert("RGBA"); per = 14; S = 3
    W = per * 64 * S + 40; rows = (n + per - 1) // per
    H = 40 + 96 * 4 + 40 + 40 + rows * (96 * S + 18) + 40 + 96 * 2 + 30
    c = Image.new("RGBA", (W, H), BG); d = ImageDraw.Draw(c)
    d.text((20, 14), "ALCAPONE B · 7 kru (idle, 4x) · putih mutiara + emas + biru es #38c8ff", fill=(255, 230, 120), font=F)
    x = 20
    for i in IDS:
        z = up(cellk(i, K[i]["seq"]["idle"][0]), 4).crop((40, 0, 216, 384)); c.alpha_composite(z, (x, 36))
        d.text((x + 10, 36 + 384 + 4), NAMES[i], fill=ACC[i], font=F); x += 182
    y = 36 + 384 + 34; d.text((20, y), f"semua sel alcapone_kairo.png ({n} sel, 3x) - label = urutan di kairo.json", fill=(255, 230, 120), font=F); y += 24
    for f in range(n):
        xx = 20 + (f % per) * 64 * S; yy = y + (f // per) * (96 * S + 18)
        c.alpha_composite(up(cellk("alcapone", f), S), (xx, yy + 14)); d.text((xx + 4, yy), f"{f}:{lab.get(f, '')}", fill=(53, 242, 255), font=FS8)
    y += rows * (96 * S + 18) + 10
    d.text((20, y), "frame klasik alcapone.png (2x) + ikon 40x40 + potret dialog", fill=(255, 230, 120), font=F); y += 20
    for j, nm in enumerate(FS):
        c.alpha_composite(up(old.crop((j * 64 + 8, 0, j * 64 + 56, 96)), 2), (20 + j * 96, y))
    icon = Image.open(f"{SP}/alcapone_portrait.png").convert("RGBA"); c.alpha_composite(up(icon, 3), (20 + len(FS) * 96 + 10, y + 20))
    por = Image.open(f"{ROOT}/assets/portraits/alcapone.png").convert("RGBA")
    c2 = Image.new("RGBA", (max(W, 20 + len(FS) * 96 + 150 + por.width * 2), H + max(0, por.height * 2 - 200)), BG); c2.alpha_composite(c, (0, 0))
    c2.alpha_composite(up(por, 2), (20 + len(FS) * 96 + 150, y - 10)); c = c2
    c.convert("RGB").save(f"{ROOT}/screenshots/alcapone-b-lineup.png")

def anim():
    a = K["alcapone"]; S = 4
    cols = [("walk", "walk >", False), ("walkd", "walkd kanan-bawah", False), ("walkd", "walkd kiri-bawah", True),
            ("backd", "backd kanan-atas", False), ("backd", "backd kiri-atas", True), ("back", "back", False), ("idle", "idle", False)]
    frames = []
    for t in range(120):                                   # one gif frame = 2 game ticks (60 fps)
        c = Image.new("RGBA", (len(cols) * 60 * S, 96 * S + 30), BG); d = ImageDraw.Draw(c)
        for j, (s, l, fl) in enumerate(cols):
            fs = a["seq"][s]; f = fs[(t * 2 // a["ticks"][s]) % len(fs)]; im = cellk("alcapone", f).crop((2, 0, 62, 96))
            if fl: im = im.transpose(Image.FLIP_LEFT_RIGHT)
            c.alpha_composite(up(im, S), (j * 60 * S, 26)); d.text((j * 60 * S + 6, 8), l, fill=(53, 242, 255), font=FS8)
        frames.append(c.convert("RGB"))
    pal = frames[0].quantize(255, method=Image.Quantize.MEDIANCUT); q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames]
    q[0].save(f"{ROOT}/screenshots/alcapone-b-anim.gif", save_all=True, append_images=q[1:], duration=33, loop=0, optimize=True)

if __name__ == "__main__":
    os.makedirs(f"{ROOT}/screenshots", exist_ok=True); lineup(); anim(); print("ok")
