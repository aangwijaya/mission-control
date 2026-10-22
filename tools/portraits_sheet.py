"""Contact sheet of the dialog portraits -> screenshots/portraits-sheet.png (2x, bottom-aligned, names in PS2P)."""
import os
from os.path import dirname, abspath
from PIL import Image, ImageDraw, ImageFont
ROOT = dirname(dirname(abspath(__file__)))
IDS = [("nerd", "nerd"), ("makelar", "makelar"), ("alcapone", "Alcapone"), ("sisotoy", "el sotoy"), ("kuku", "kuku"), ("kurir", "Kurir"), ("jack", "bang jack")]
F = ImageFont.truetype(f"{ROOT}/fonts/PressStart2P-Regular.ttf", 8)
S, CW, CH = 2, 160, 160
c = Image.new("RGB", (len(IDS) * CW * S, CH * S + 28), (17, 11, 43)); d = ImageDraw.Draw(c)
for i, (k, name) in enumerate(IDS):
    p = Image.open(f"{ROOT}/assets/portraits/{k}.png").convert("RGBA"); z = p.resize((p.width * S, p.height * S), Image.NEAREST)
    x = i * CW * S + (CW * S - z.width) // 2; y = CH * S - z.height
    d.rectangle((i * CW * S + 4, 4, (i + 1) * CW * S - 4, CH * S), outline=(58, 44, 122))
    c.paste(z, (x, y), z)
    d.text((i * CW * S + 10, CH * S + 10), f"{name}  {p.width}x{p.height}", fill=(53, 242, 255), font=F)
os.makedirs(f"{ROOT}/screenshots", exist_ok=True); c.save(f"{ROOT}/screenshots/portraits-sheet.png"); print(c.size)
