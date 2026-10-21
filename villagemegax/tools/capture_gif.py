"""Rekam GIF demo: simulasi dijeda lalu dimajukan langkah demi langkah (deterministik), tiap langkah di-screenshot."""
import sys, asyncio, io
from PIL import Image
from playwright.async_api import async_playwright
# usage: capture_gif.py url out.gif w h setup_js frames steps_per_frame [clip x,y,w,h]
async def main():
    url, out, w, h, setup, n, spf = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5], int(sys.argv[6]), int(sys.argv[7])
    clip = dict(zip(["x", "y", "width", "height"], map(int, sys.argv[8].split(",")))) if len(sys.argv) > 8 else None
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await (await b.new_context(viewport={'width': w, 'height': h})).new_page()
        await pg.goto(url); await pg.wait_for_function("document.body.dataset.ready==='1'", timeout=120000)
        await pg.evaluate("VMX.pause();" + setup)
        frames = []
        for i in range(n):
            await pg.evaluate(f"VMX.step({spf})")
            png = await pg.screenshot(clip=clip) if clip else await pg.screenshot()
            frames.append(Image.open(io.BytesIO(png)).convert("RGB"))
        await b.close()
    pal = frames[len(frames) // 2].quantize(255, method=Image.Quantize.MEDIANCUT)
    q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames]
    q[0].save(out, save_all=True, append_images=q[1:], duration=int(1000 * spf / 30), loop=0, optimize=True)
    print(out, len(q), "frames")
asyncio.run(main())
