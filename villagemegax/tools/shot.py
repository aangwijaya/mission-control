import sys,asyncio,json,os
from playwright.async_api import async_playwright
# usage: kkapp.py url out.png [w h] [js-before-shot] [wait_s]
async def main():
  url,out=sys.argv[1],sys.argv[2]; w=int(sys.argv[3]) if len(sys.argv)>3 else 1280; h=int(sys.argv[4]) if len(sys.argv)>4 else 800
  js=sys.argv[5] if len(sys.argv)>5 else ''; wait=float(sys.argv[6]) if len(sys.argv)>6 else 2
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    mob = w<700
    ctx=await b.new_context(viewport={'width':w,'height':h},device_scale_factor=float(os.environ.get('DPR', 2 if mob else 1)),is_mobile=mob,has_touch=mob)
    pg=await ctx.new_page()
    pg.on('console',lambda m:print('console:',m.type,m.text[:300]))
    pg.on('pageerror',lambda e:print('err:',e))
    await pg.goto(url);await pg.wait_for_function("document.body.dataset.ready==='1' || !document.getElementById('scene')",timeout=120000)
    if js:
      r=await pg.evaluate(js); 
      if r is not None: print('js:',r)
    await pg.wait_for_timeout(wait*1000)
    await pg.screenshot(path=out);await b.close()
asyncio.run(main())
