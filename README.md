# sparrow's wake

A hove-to pirate brig bobbing on open Caribbean swell — a low-poly living
postcard. The captain drifts through his routines (helm, spyglass, a wobbly
compass, rum, the occasional sword flourish), three crew mill about, and the
sea delivers odd visitors: bottles with maps, canoes, turtles, a shark fin,
and — night only, far off — a ghost ship. Every few minutes, someone walks
the plank (comedically; they backstroke off toward the horizon, relieved).

Design brief: `../design/sparrows-wake-brief.md` · built per the
`low-poly-living-postcard` skill · reference build: `../musashi-homepage/`.

## Run

```sh
npm install
npm run dev      # expanse at /, framed island diorama at /island.html
npm run build
```

## The water (the showpiece)

GPU waves: `three-custom-shader-material` over
`MeshStandardMaterial({ flatShading: true })`. Four directional sines
(`src/waves.js` — the GLSL is string-generated from the same constants that
drive all CPU buoyancy, so sea and floaters can never disagree). Facet-crisp
color comes from **`flat` varyings** (per-provoking-vertex wave height +
hash tint), not smooth interpolation; the trough→mid→crest ramp is biased so
mid-teal owns the sea. Hard-won notes:

- Near-orthogonal wave dirs + harmonic wavelengths ⇒ argyle checkerboard.
  Use non-orthogonal dirs, non-integer λ ratios, plus one very long λ to
  push the repeat period past the viewport.
- Fog must start beyond the ship (camera is ~23 units out) or it washes the
  whole postcard.
- Ortho camera ⇒ no sky dome: moon/stars are camera children drawn with
  `depthTest: false` into the hazed top strip.
- PointLights (stern lantern) need ~7× the emissive intensity in physical
  light units to read.

## Anatomy

- `src/waves.js` — canonical wave model (JS + generated GLSL)
- `src/water.js` — ocean surface (expanse rect / island disc + skirt), splash/ring foam pools
- `src/ship.js` — the brig: hull, sails, lantern, wheel, plank; 4-point buoyancy bob; deck `spots`/keepouts contract
- `src/captain.js` — 9-activity state machine, swagger walks, plank supervision
- `src/crew.js` / `src/plank.js` — crew task loops; the walk-the-plank choreography
- `src/traffic.js` + `src/links.js` — drifting visitors + 30-link maritime Wikipedia deck (speech bubbles)
- `src/cycle.js` — day/night state + 3s crossfade; `src/sound.js` — synthesized ambience (off by default)
- `src/figures.js` / `src/palette.js` — shared cast builder + the only color source
- `src/main.js` — renderer, ortho camera + parallax, lights, loader, toggles, sky

Scrub params & verification recipe: `.claude/skills/verify/SKILL.md`.
