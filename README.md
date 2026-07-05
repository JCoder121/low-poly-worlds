# sparrow's wake

A hove-to pirate brig bobbing on open Caribbean swell — a low-poly living
postcard. The captain drifts through his routines (helm, spyglass, a wobbly
compass, rum, the occasional sword flourish), three crew mill about, and the
sea delivers odd visitors: bottles with maps, canoes, turtles, a shark fin,
and — night only, far off — a ghost ship. Every few minutes, someone walks
the plank (comedically; they backstroke off toward the horizon, relieved).

Design brief: `./sparrows-wake-brief.md` · built per the
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

## v2 — the big ship, the whole day, the weather

- **The brig is the world now**: hull ~3× (19 units), rig height-capped
  (~2.4×) and detail ~2× so the size-1 figures read right. 12 captain
  activities (+fishing, quarterdeck pacing, the ship's bell), 4 crew.
- **Continuous day** (`src/cycle.js`): 6-min day, ring-lerped anchors with
  HOLD plateaus (day 0.25–0.45, golden hour 0.55–0.62, night 0.72–0.93) —
  without plateaus every state is mid-fade. Dawn rose / noon turquoise /
  golden-hour ember / night slate water ramps.
- **Weather machine** (`src/weather.js`): clear ↔ fog ↔ rain → storm
  (Markov, storm only via rain); fog factor scales scene fog, rain is an
  instanced streak field, lightning is a full-scene flash (no bolt), each
  with synthesized audio (rain bed, delayed thunder).
- **The sky admits it's a postcard** (`src/sky.js`): expanse discs arc the
  top haze band and slip off-frame near apex ("absent noon"); moon is
  phase-masked (real synodic phase in live mode); stars + pooled shooting
  star on clear nights. The fishbowl page gets real overhead celestials.
- **Island = open glass fishbowl**: lathe glass wall + rim, sea disc r13.2
  inside, celestials hung above like a mobile. Traffic and the plank
  swimmer fade at the rim.
- **Rare far-lane sights**: night ghost ship, and a passing palm island
  (~90s, fog-hazed, never bobs).
- Physical-light-unit lesson repeated: the 3× cabin hid the stern lantern —
  raised above the roofline at intensity ≈16.

## v3 — the snow globe, the cast, the quiet sky

- **Island = reverse snow globe**: glass hemisphere BELOW the waterline only
  (flattened pole, equator ring), sea disc r11, world at 0.55× inside.
- **Expanse sea fills every corner** (96-unit grid, cell 0.65); ship 0.9×.
- **No sun/moon discs** — the discs felt awkward; lighting alone tells time.
  Sky keeps stars/shooting stars and gains meteor showers, gull flocks; the
  water gains a porpoising dolphin pod. (A post-rain rainbow arch shipped
  here too but was cut later — it read as tacky against the low-poly palette.)
- **Fog weather removed** (rain/storm remain; distance fog stays aesthetic).
- **A real cast**: captain / first mate / lookout / cook / deckhand + the
  recurring prisoner ("not again…"). Tiny bark bubbles, deck-spot occupancy
  registry, junior-yields sidesteps, paired exchanges when two stop close.
- **Rig fix**: sails 60% calmer and offset forward of the masts.
- **Ship detail pass**: plank seams, hull strakes, cannonball pyramids,
  anchor, rudder, stern trim, rope coils, crate.
