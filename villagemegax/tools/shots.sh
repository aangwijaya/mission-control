#!/bin/bash
# screenshot villagemegax (butuh server lokal di :8765 yang nyajiin /workspace/mission-control, dan Chrome + playwright)
O=/workspace/mission-control/villagemegax/screenshots; B="http://localhost:8765/villagemegax/"; PY=/tmp/pwenv/bin/python; S="$(dirname "$0")/shot.py"
H="document.querySelectorAll('.win,.tools').forEach(e=>e.style.display='none');"
W="VMX.pause();VMX.step(240);"   # 8 detik simulasi biar semua sudah di tempat
$PY $S "$B?time=day" $O/01-default.png 1280 800 "" 6
$PY $S "$B?demo=1&time=day" $O/01b-default-demo.png 1280 800 "${W}VMX.step(1)" 1
$PY $S "$B?demo=1&time=day&zoom=2" $O/02-demo-zoom.png 1280 800 "${W}VMX.view(520,300,2);VMX.step(1)" 1
$PY $S "$B?demo=1&time=day" $O/03-closeup.png 1280 800 "${H}${W}const g=VMX.AG[2];VMX.select(g);VMX.pause(true);VMX.view(g.x,g.y-30,3);VMX.step(8)" 1
$PY $S "$B?demo=1&time=day" $O/03b-closeup-wave.png 1280 800 "${H}${W}const g=VMX.AG[3];g.setTasks([{wait:99}]);g.pose='stand';VMX.step(2);g.react();VMX.view(g.x,g.y-40,3);VMX.step(4)" 1
$PY $S "$B?demo=1&time=day" $O/04-info-panel.png 1280 800 "${W}VMX.select(VMX.AG[0]);VMX.step(10)" 1
$PY $S "$B?demo=1&time=day" $O/05-mobile.png 390 844 "${W}VMX.step(1)" 1
$PY $S "$B?demo=1&time=day" $O/05b-mobile-info.png 390 844 "${W}VMX.select(VMX.AG[2]);VMX.step(10)" 1
$PY $S "$B?demo=1&time=night" $O/06-night.png 1280 800 "${W}VMX.step(1)" 1
$PY $S "$B?demo=1&time=dusk" $O/07-dusk.png 1280 800 "${W}VMX.step(1)" 1
$PY $S "$B?demo=1&time=day" $O/08-fit-1920x1080.png 1920 1080 "${W}VMX.step(1)" 1
$PY $S "$B?demo=1&time=day" $O/08b-fit-1280x720.png 1280 720 "${W}VMX.step(1)" 1
DPR=2 $PY $S "$B?demo=1&time=day" $O/08c-fit-1440x900-retina.png 1440 860 "${W}VMX.step(1)" 1
$PY $S "$B?demo=1&time=night" $O/09-recharge-pods.png 1280 800 "${H}${W}VMX.view(520,640,2);VMX.step(1)" 1
$PY $S "$B?demo=1&time=day" $O/10-teleport.png 1280 800 "${H}VMX.pause();const g=VMX.AG[3];g.mode='idle';g.hidden=true;g.x=VMX.PADS[1].x;g.y=VMX.PADS[1].y-4;g.setTasks([{beam:'in',pad:1},{wait:99}]);VMX.step(12);VMX.view(g.x-60,g.y-60,3);VMX.step(1)" 1
$PY $S "$B?demo=1&time=day" $O/10b-teleport-materialize.png 1280 800 "${H}VMX.pause();const g=VMX.AG[3];g.mode='idle';g.hidden=true;g.x=VMX.PADS[1].x;g.y=VMX.PADS[1].y-4;g.setTasks([{beam:'in',pad:1},{wait:99}]);VMX.step(15);VMX.view(g.x-60,g.y-60,3);VMX.step(1)" 1
$PY $S "http://localhost:8765/villagemegax/tools/frames.html" $O/11-sprite-frames.png 1300 920 "" 1
