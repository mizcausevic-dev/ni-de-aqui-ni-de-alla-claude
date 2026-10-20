# Ni de Aquí Ni de Allá with Claude — 30-second recipe animation

A deterministic, capture-ready HTML5 Canvas animation that builds the cocktail
**Ni de Aquí Ni de Allá** from an empty rocks glass to the finished drink in
exactly 30 seconds. Recipe: Danny González and Pedro Tobar, Bar Providencia,
Washington, D.C.

- Live: https://mizcausevic-dev.github.io/ni-de-aqui-ni-de-alla-claude/
- Video: `out/ni-de-aqui-ni-de-alla.mp4` (1080×1080, 30 fps, H.264, 30.000 s)

## Timeline

| Window | Content |
|---|---|
| 0–3 s | Title card, credit, empty rocks glass |
| 3–25 s | Banana-leaf lining · large ice cube · mixing glass with ice · Bourbon 1 oz · Mezcal 1 oz · Plantain syrup ½ oz · Angostura 2 dashes · Banana bitters 2 dashes · stir until chilled · strain into the prepared glass |
| 25–30 s | Garnish (fresh banana leaf), hero reveal with the cocktail name, hold |

Every step shows its name and exact measurement for at least 2 seconds.

## Run locally

No build step. Fonts are bundled (Playfair Display and Inter, SIL OFL).

```bash
git clone https://github.com/mizcausevic-dev/ni-de-aqui-ni-de-alla-claude
cd ni-de-aqui-ni-de-alla-claude
python3 -m http.server 8080
# open http://localhost:8080/
```

Opening `index.html` directly from disk also works in Chromium-based browsers.

Controls: Play / Pause, Restart, a 30-second scrubber, plus keyboard **Space**
(play/pause) and **R** (restart).

Query parameters:

| Param | Effect |
|---|---|
| `?autoplay=0` | Load paused at 0 s |
| `?capture=1` | Capture mode: fixed 1080×1080 canvas, controls hidden, no autoplay |
| `?capture=1&t=12.5` | Capture mode, draw the frame at t = 12.5 s |

In capture mode the page exposes `window.renderAt(t)` and sets
`window.__ready = true` once fonts have loaded.

## Edit the recipe or timing

Everything editable is in [`recipe.js`](recipe.js): title, credit, colours, and
an ordered `steps` array with `at` (start, seconds), `dur` (seconds), `kind`,
`label`, `amount`, `oz`, `color`. The renderer (`animation.js`) reads that file
and derives liquid volume and the blended colour from it, so changing a
measurement changes both the caption and the pour.

Keep the build steps inside 3–25 s to preserve the intro and reveal windows.

## Render the MP4

The animation is a pure function of time (`render(t)`), so capture is frame
exact and does not depend on wall-clock playback.

```bash
pip install playwright
python3 -m playwright install chromium
python3 render.py            # -> out/frames/*.png and out/ni-de-aqui-ni-de-alla.mp4
```

`render.py` opens `index.html?capture=1` in headless Chromium, calls
`renderAt(frame / fps)` for each of the 900 frames, screenshots the canvas, and
encodes with ffmpeg (`libx264`, `yuv420p`, `crf 17`, `+faststart`). Use
`--fps 60` for a 1800-frame version; `--frames 0,450,899` renders only those
frames for a quick check.

## Determinism notes

- No `Math.random` at frame time; ice placement uses a fixed-seed PRNG at load.
- All motion derives from `t` via easing functions; nothing accumulates between frames.
- The playback loop computes `t` from `performance.now()` offsets, so pause and
  scrub are lossless and the captured MP4 matches browser playback.

## Files

```
index.html     page, controls, @font-face declarations
animation.js   renderer and player (pure render(t))
recipe.js      recipe content, colours, timeline
render.py      headless frame capture + ffmpeg encode
fonts/         bundled woff2 fonts and licences
out/           rendered MP4 (frames are git-ignored)
```

## Source of the recipe

Ingredients, measurements, prep steps and the plantain-syrup description are
taken verbatim from the Bar Providencia recipe supplied with the brief. Nothing
in the recipe was invented or altered; colours are presentational.
