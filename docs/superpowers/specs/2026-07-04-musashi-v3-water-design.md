# Musashi Homepage v3 — The Water

Date: 2026-07-04 · Status: approved by Jeffrey (motion/palette/extras decisions confirmed; pool widening requested)

Builds on v2 (merged at `8818964`). Goal: the water (river, misogi pool, waterfall) becomes the page's **standout artifact** — higher-res but still polygonal/flat-shaded, drawing on Thronefall (pastel cell bands, shoreline foam), Horizon Chase (flat gradient bands), Kings and Castles (chunky diorama water).

## Decisions

- **Motion: flowing but calm.** Gentle faceted swell, slow downstream foam streaks, soft pool ripple rings. Zen pace; clearly the most animated thing on the page, never frantic.
- **Palette: sky-mirror.** Water base hue lerps ~55% toward `ws.lighting.bg` each frame — rose dawn, gold dusk, deep ink night — with depth banding riding on top so it always reads as water. Winter ice palette overrides (existing freeze behavior).
- **Extras: all three.** Two koi in the pool; ~20 night sparkle glints on river+pool (opacity ∝ `ws.night`); two dragonflies skimming the river in summer daytime (`season === "summer" && night < 0.3`).
- **Technique: CPU faceted geometry + vertex colors** (approach A). No shaders/textures. Subdivided meshes, per-frame vertex sine displacement (flat shading makes facets glitter), per-vertex color banding, mesh/instanced foam. ~2k animated vertices per frame — negligible.
- **Pool widened** from radius 0.55 to ~0.85 to accommodate koi + ripple rings; misogi action spot adjusted so Musashi still stands at the cascade.

## Architecture

New module **`src/water.js`** owns every water element; `landmarks.js` slims to temple/lantern/garden/bridge + action spots. Interface follows house style:

```js
buildWater(island, mode /* "island" | "expanse" */) → { update(dt, t, ws), spots: { misogi } }
```

- `water.js` consumes `ws.night`, `ws.season`, `ws.seasonBlend`, `ws.nextSeason`, `ws.lighting.bg` only.
- Winter-freeze math (the `frozen` 0..1 used in v2's landmarks) moves into water.js unchanged.
- The misogi spot moves from landmarks.spots to water.spots (it belongs to the pool); main.js merges both spot objects into the Musashi spot map.
- Expanse mode keeps its basin variant (short fall into sunken hollow) — implemented inside water.js's mode branch.

## Elements

### River
- Ribbon rebuilt: ~160 segments × 4 lanes (v2: 48 × 1), vertex-colored, flat-shaded.
- **Swell:** two-octave traveling sine displacement on y, amplitude ≈ 0.02, phase moving downstream.
- **Banding:** deep center lane → pale aqua edge lanes (vertex colors), multiplied by the sky-mirror material color.
- **Bank foam:** thin white semi-transparent ribbon hugging each bank with a subtle opacity pulse (the Thronefall shoreline line).
- **Foam streaks:** ~10 instanced white dashes flowing downstream at current pace, staggered fade in/out.
- Dark banks (v2) stay beneath for the sunken-channel read.

### Misogi pool
- Widened disc (radius ≈ 0.85), subdivided, same mirror tint + edge foam ring.
- **Ripple rings:** 3 expanding, fading rings cycling from the cascade impact point.
- **Koi:** 2 low-poly koi (kite body + swaying tail fin; one orange w/ white patch, one white w/ orange) circling slowly, occasional pauses. They swim just above the pool's surface plane (y +0.01, flattened) so the iso camera sees them — reads as "at the surface" since the disc is opaque. Hidden in winter (under ice).

### Waterfall
- 3 overlapping vertical ribbons (subdivided), wave phase scrolling downward, slight per-ribbon alpha/width variation — replaces the single box column.
- White zigzag **lip foam fringe** where the river tips over.
- Falling chunks (v2 instanced) retinted white-blue to match.
- **Splash ring** expanding at the base (island: at the tall fall's foot; expanse: in the basin).
- Mist puffs stay (slightly softened).
- Cascade (the small step-fall into the pool) gets the same ribbon treatment at mini scale.

### Night sparkles
~20 tiny additive glint points scattered on river + pool surfaces, opacity ∝ `ws.night`, gentle drift.

### Dragonflies
2 in summer daytime only: thin cylinder body + 2 flat wing planes with rapid flutter, skimming along the river curve with brief hovers. Gone at night/other seasons (fade, don't pop).

## Season / motion rules

- **Winter:** all water motion stops; ice palette (existing lerp); foam streaks, ripples, sparkles, koi, dragonflies hidden; waterfall ribbons static and pale. Freeze cross-fades over the existing 20 s `seasonBlend` window.
- **Reduced motion:** static banded water (no vertex animation, no streaks/ripples), koi drift very slowly, no dragonflies; sky-mirror tint still applies (it's lighting, not motion).
- All v2 behavior (autumn mist, spring rain, traveler/musashi systems) unchanged.

## Out of scope (noted, not built)

Petals landing on and drifting down the river — future nice-to-have; couples weather to water.

## Verification

Runtime observation on both pages via existing scrub params: dawn/dusk/night × spring/summer/winter screenshots (sky-mirror + freeze + sparkles), multi-frame diffs for swell/streak/ripple/koi motion, `?season=summer&speed=0` day vs night for dragonflies, expanse basin variant, reduced-motion code check, console clean, `npm run build` smoke.
