# Mission Control

16-bit Robot HQ that shows the owner's AI agents as animated characters on a canvas map.

A static site (plain HTML, CSS, and JavaScript, no build step). The page is a Megaman-style command center: the crew walks the HQ, and live status comes from `status.json`.

## Run locally

From the repository root:

```bash
python3 -m http.server
```

Open http://localhost:8000/. Add `?demo=1` to load the built-in sample status. Credits are at http://localhost:8000/credits.html.

## Status

`status.json` is refreshed by `update_status.py` on the owner's machine. The script reads local agent activity and writes `status.json` beside itself; it does not run in GitHub Actions. Optional short summaries live in `summaries.json`. The page reloads `status.json` about once a minute.
