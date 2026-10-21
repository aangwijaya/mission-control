# Joins the source parts into js/villagemegax.js. Edit the parts, not the output file.
cd "$(dirname "$0")" && cat a_head.js b_world.js c_paint.js d_agent.js e_render.js f_ui.js > ../../js/villagemegax.js && node --check ../../js/villagemegax.js
