# Credits — villagemegax (Mission Control · Robot HQ 16-bit)

## Art
- **Original AI-generated art.** The 7 character sprites (plus their sit, wave and back-view sheets), the background concept, the props and the Command Center consoles were generated with an AI image generator, then processed by our own scripts in `tools/`: background key, 16-colour palette per character, downscale, outline, and programmatic walk/blink/bob/wave frames.
- The style is *inspired by* SNES/PS1-era robot action games. It is **not** Capcom/Mega Man art: no official sprites, tiles or characters were used or traced. Mega Man is a trademark of Capcom, and this project is not affiliated with Capcom.
- The floor, walls, recharge pods, energy core, teleporters, teleport beam FX, screens and time-of-day lighting are drawn procedurally in code.

## Music
- `assets/audio/hq-theme.mp3` is the HQ owner's own MP3 file, re-encoded to 112 kbps. It loops at 40% volume and can be muted with the speaker button; the choice is saved in localStorage.

## Fonts (shared from `../fonts/`)
- Press Start 2P by CodeMan38, SIL Open Font License 1.1
- Pixelify Sans by Stefie Justprince, SIL Open Font License 1.1
- The licence text is in `../fonts/FONTS-LICENSE.txt`.

## Code
- The camera and A* pathfinding are adapted from our own `village2d`. Everything else is new code.
