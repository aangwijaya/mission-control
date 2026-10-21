# Mission Control

A chibi cyberpunk mini city, drawn isometric, that shows the owner's AI agents as animated characters on a canvas map.

A static site (plain HTML, CSS, and JavaScript, no build step). The page (`index.html`, `js/neohq.js`, `css/neohq.css`) is a Neo HQ city: a Mega Man X style Hunter Base cutaway (command desks, holo table, servers, charge capsules), a power core plaza, two teleporters, neon buildings, hover cars, drones, rain, and BIP, the mascot drone that patrols inside the base. Crew members who are working go to the command desks, standby crew roam the city or teleport, and offline crew charge in the capsules. Live status comes from `status.json`.

The previous top-down HQ is still available at `classic.html` (`js/villagemegax.js`).

## Run locally

From the repository root:

```bash
python3 -m http.server
```

Open http://localhost:8000/. Add `?demo=1` to load the built-in sample status. Credits are at http://localhost:8000/credits.html and the old version is at http://localhost:8000/classic.html.

## Status

`status.json` is refreshed by `update_status.py` on the owner's machine. The script reads local agent activity and writes `status.json` beside itself; it does not run in GitHub Actions. Optional short summaries live in `summaries.json`. The page reloads `status.json` about once a minute.
