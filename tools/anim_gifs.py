"""KAIRO deliverables (all agents): lineup GIF (walk + idle), teleport/defeat GIF, frames contact sheet.
Timing = the in-game tick table at 60 fps. Old frames (code-made) are read from assets/sprites/<id>.png."""
import json, sys
from PIL import Image, ImageDraw, ImageFont
ROOT = "/workspace/mission-control/villagemegax-anim"; SS = f"{ROOT}/screenshots"; SP = f"{ROOT}/assets/sprites"
CW, CH = 64, 96
IDS = ["nerd", "makelar", "alcapone", "sisotoy", "kuku", "kurir", "jack"]
NAMES = {"nerd": "nerd", "makelar": "makelar", "alcapone": "Alcapone", "sisotoy": "el sotoy", "kuku": "kuku", "kurir": "Kurir", "jack": "bang jack"}
KJ = json.load(open(f"{SP}/kairo.json"))["agents"]
SHEET = {i: Image.open(f"{SP}/{i}_kairo.png").convert("RGBA") for i in IDS}
OLD = {i: Image.open(f"{SP}/{i}.png").convert("RGBA") for i in IDS}
FR = {n: k for k, n in enumerate(json.load(open(f"{SP}/sprites.json"))["frames"])}
try: FONT = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 13)
except Exception: FONT = ImageFont.load_default()
BG = (22, 52, 104, 255)
cellof = lambda im, i: im.crop((i * CW, 0, (i + 1) * CW, CH))
def kidx(id_, seq, tick, once=False):
    K = KJ[id_]; s = K["seq"][seq]; i = tick // K["ticks"][seq]; return s[min(i, len(s) - 1)] if once else s[i % len(s)]

def strip(cells, labels, title, Z=2):
    w = len(cells) * (CW * Z + 4) + 8; h = CH * Z + 26 + 20
    p = Image.new("RGBA", (w, h), BG); d = ImageDraw.Draw(p); d.text((8, 3), title, fill=(255, 230, 90), font=FONT)
    for k, (c, lb) in enumerate(zip(cells, labels)):
        x = 6 + k * (CW * Z + 4); y = 20
        d.ellipse((x + CW * Z // 2 - 26, y + 92 * Z - 5, x + CW * Z // 2 + 26, y + 95 * Z + 3), fill=(10, 26, 60, 255))
        if c is not None: p.alpha_composite(c.resize((CW * Z, CH * Z), Image.NEAREST), (x, y))
        d.text((x + 4, y + CH * Z + 4), lb, fill=(255, 255, 255), font=FONT)
    return p

def stack(ps):
    W = max(p.width for p in ps); H = sum(p.height for p in ps) + 4 * (len(ps) - 1)
    f = Image.new("RGBA", (W, H), (8, 22, 52, 255)); y = 0
    for p in ps: f.alpha_composite(p, (0, y)); y += p.height + 4
    return f

def save_gif(frames, path, ms=1000 / 60):
    out, dur = [], []
    for f in frames:
        b = f.tobytes()
        if out and out[-1][1] == b: dur[-1] += ms
        else: out.append((f, b)); dur.append(ms)
    ims = [f.convert("RGB") for f, _ in out]
    pal = ims[len(ims) // 2].quantize(255, method=Image.Quantize.MEDIANCUT)
    q = [i.quantize(palette=pal, dither=Image.Dither.NONE) for i in ims]
    q[0].save(path, save_all=True, append_images=q[1:], duration=[max(20, round(d / 10) * 10) for d in dur], loop=0, optimize=False)
    print(path, len(q), "frames")

# 1) lineup: all 7 — side walk, walk up, idle (2.4 s loop: lcm of all cycles)
frames = []
for tick in range(144):
    rows = [strip([cellof(SHEET[i], kidx(i, "walk", tick)) for i in IDS], [NAMES[i] for i in IDS], "KAIRO · jalan samping (4 tick/frame)"),
            strip([cellof(SHEET[i], kidx(i, "back", tick)) for i in IDS], [NAMES[i] for i in IDS], "KAIRO · jalan ke atas (5 tick/frame)"),
            strip([cellof(SHEET[i], kidx(i, "idle", tick)) for i in IDS], [NAMES[i] for i in IDS], "KAIRO · idle (9 tick/frame)")]
    frames.append(stack(rows))
save_gif(frames, f"{SS}/kairo-lineup-walk-idle.gif")

# 2) teleport-in -> idle -> defeat for 4 agents side by side (beam falls 0.3 s first, like in-game)
GROUP = ["makelar", "alcapone", "kuku", "jack"]
TPA = 18; ntp = 7 * 3; nde = 6 * 5; tl = [("beam", t) for t in range(TPA)] + [("tp", t + 3) for t in range(ntp - 3)] + [("idle", t) for t in range(45)] + [("def", t) for t in range(nde)] + [("none", t) for t in range(30)]
frames = []
for kind, tick in tl:
    cells = []
    for i in GROUP:
        if kind == "beam":
            b = cellof(SHEET[i], KJ[i]["seq"]["tp"][0]); c = Image.new("RGBA", (CW, CH)); c.paste(b, (0, int(-96 * (1 - tick / TPA))), b)
        elif kind == "tp": c = cellof(SHEET[i], kidx(i, "tp", tick, True))
        elif kind == "idle": c = cellof(SHEET[i], kidx(i, "idle", tick))
        elif kind == "def": c = cellof(SHEET[i], kidx(i, "def", tick, True))
        else: c = None
        cells.append(c)
    frames.append(strip(cells, [NAMES[i] for i in GROUP], {"beam": "teleport-in", "tp": "teleport-in (3 tick)", "idle": "standby", "def": "defeat / offline (5 tick)", "none": "(hilang -> kapsul)"}[kind], Z=3))
save_gif(frames, f"{SS}/kairo-teleport-defeat-group.gif")

# 3) contact sheet: every agent, every frame, grouped by sequence
SEQ = ["idle", "blink", "walk", "back", "tp", "def"]
Z = 2; cols = max(sum(len(dict.fromkeys(KJ[i]["seq"][s])) for s in SEQ) for i in IDS)
W = 110 + cols * (CW * Z + 2) + len(SEQ) * 10; H = len(IDS) * (CH * Z + 22) + 30
cs = Image.new("RGBA", (W, H), BG); d = ImageDraw.Draw(cs)
d.text((8, 6), "KAIRO frames · " + "  ".join(f"{s}: {KJ['nerd']['ticks'][s]} tick" for s in SEQ) + " @60fps", fill=(255, 230, 90), font=FONT)
for r, i in enumerate(IDS):
    y = 28 + r * (CH * Z + 22); d.text((8, y + CH * Z // 2), NAMES[i], fill=(255, 255, 255), font=FONT); x = 110
    for s in SEQ:
        d.text((x, y), s, fill=(255, 230, 90), font=FONT)
        for k in dict.fromkeys(KJ[i]["seq"][s]):
            cs.paste((14, 36, 80, 255), (x, y + 16, x + CW * Z, y + 16 + CH * Z)); cs.alpha_composite(cellof(SHEET[i], k).resize((CW * Z, CH * Z), Image.NEAREST), (x, y + 16)); x += CW * Z + 2
        x += 10
cs.save(f"{SS}/kairo-frames-contact.png"); print("contact", cs.size)

# 4) old vs new (all agents): old code walk/idle vs KAIRO walk/idle
frames = []
for tick in range(144):
    t = tick / 60
    rows = [strip([cellof(OLD[i], FR["walk0"] + int(t * 7.5) % 4) for i in IDS], [NAMES[i] for i in IDS], "OLD · jalan (kode)"),
            strip([cellof(SHEET[i], kidx(i, "walk", tick)) for i in IDS], [NAMES[i] for i in IDS], "NEW · jalan (KAIRO)"),
            strip([cellof(OLD[i], FR["idle1"] if int(t * 1.7) % 2 else FR["idle0"]) for i in IDS], [NAMES[i] for i in IDS], "OLD · idle (bob)"),
            strip([cellof(SHEET[i], kidx(i, "idle", tick)) for i in IDS], [NAMES[i] for i in IDS], "NEW · idle (KAIRO)")]
    frames.append(stack(rows))
save_gif(frames, f"{SS}/kairo-all-old-vs-new.gif")
