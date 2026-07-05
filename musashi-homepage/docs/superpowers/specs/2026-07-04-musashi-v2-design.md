# Musashi Homepage v2 — Design Spec

Date: 2026-07-04 · Status: approved by Jeffrey (pacing/weather/dual-page decisions confirmed)

Builds on v1 (commit `2df18bf`, brief at `~/Documents/claude_playground/design/musashi-homepage-brief.md`). v1's throughline stands: **a toy shrine to discipline** — one clearing, one figure, one tree; austerity in composition, game-charm in geometry and motion.

## Features (user request)

1. Speech bubbles linger longer.
2. Day/night cycle on a timer (not machine time). Basic lighting is fine; must stay elegant/tranquil/beautiful.
3. Musashi walks gracefully between actions on slightly random paths; expand from 4 to 10 actions befitting Musashi.
4. Seasons + weather reflected in terrain and sky, layered with day/night.
5. New low-poly landmarks: small temple, river under a bridge leading to a waterfall, zen raked-sand garden by the temple. Scene must not get crowded.
6. LAST, after all above: two versions of the page — floating isometric island (as now) and a full-viewport "expanse" with no island edges.

Explicitly out of scope this session: other-character homepages (Darrow, Harry Potter, Kaladin, etc.) — noted as future project.

## Decisions

- **Pacing: slow & meditative.** Day = 360 s. Season = 2 days = 720 s. Year ≈ 48 min. Page always opens at golden hour (dusk keyframe), season starts at spring on load.
- **Weather: one signature per season** (constant, no random moods).
- **Dual pages: two entries + tiny toggle link** (`index.html` island, `expanse.html` fullscreen; letterspaced-mono link bottom-right).

## Architecture

Approach B (module per system, thin integration). New/changed files:

| File | Role |
|---|---|
| `src/cycle.js` (new) | Master clock. Owns `worldState = { dayT, season, seasonBlend, lightKey weights }`. Computes lerped lighting (sky/bg color, hemi + directional color/intensity, fog) from 4 keyframes: dawn, day, dusk (≡ v1 golden hour), night. Reads URL params `?season=&time=&speed=` for dev/verify scrubbing. |
| `src/weather.js` (new) | Seasonal particles + effects. Generalizes v1's `Petals` into one instanced falling-particle system (petals / leaves / snow: color, size, fall speed, count per season). Also: soft spring rain, summer nighttime fireflies, autumn ground-mist planes, winter snow cover flag. |
| `src/landmarks.js` (new) | Temple + stone lantern (night glow), zen garden (sand slab, raked grooves, 3 rocks), river + arched bridge + waterfall (particle/scrolling-facet water; freezes pale in winter). Exposes named action spots. |
| `src/musashi.js` (extend) | Locomotion layer (stand → walk jittered 2–3-waypoint Catmull-Rom path with travelers' bob → settle) + 6 new actions. Pill narrates walking ("musashi walks to the temple…"). |
| `src/world.js` (light refactor) | Base terrain; expose vertex-color palette lerp hook for seasons; `Petals` moves to `weather.js`. NE hill shrinks to make room for temple. |
| `src/main.js` (wire) | Instantiate cycle/weather/landmarks; pass `worldState` into every `update(dt, worldState)`; `mode: 'island' | 'expanse'` flag. |
| `expanse.html` (new) | Second Vite entry, `mode: 'expanse'`. |
| `src/travelers.js` (tweak) | Bubble lifetime numbers only. |

Single source of truth: modules read `worldState`; no module talks to another directly.

## Feature detail

### 1. Bubbles

Visible lifetime ~6 s → **~14 s**; slower fade; post-hover linger 6 s → **10 s**. (Verification of v1 flagged the read+click window as tight.)

### 2. Day/night

Four keyframes, smooth lerp (ease at boundaries, no hard cuts):

- **dawn** — pale rose sky, low warm light, faint mist
- **day** — clear warm neutral
- **dusk** — v1's golden hour, preserved exactly
- **night** — deep ink-indigo (`#1C2333` family), sparse stars, fire + temple lantern glow become the light sources; directional light very low, cool

Load starts at dusk. Fire/lantern point lights scale intensity inversely with sun.

### 3. Seasons + weather

Terrain vertex colors and sakura lerp over ~20 s at each boundary:

| Season | Terrain | Sakura | Signature weather |
|---|---|---|---|
| spring | fresh moss greens (v1 palette) | pink bloom | falling petals + occasional soft rain |
| summer | deeper saturated greens | green canopy | clear; fireflies at night |
| autumn | amber-tinged grass | red-gold leaves | drifting leaves + thin ground mist |
| winter | pale, snow-dusted tops | bare branches, snow line | gentle snowfall; river/waterfall freeze |

### 4. Landmarks (composition: edges only, clearing stays empty)

- **Temple**: 3–4 flat prisms, suggested curved roof, vermillion trim, NE rise. Stone lantern beside it, lit at night.
- **Zen garden**: sand slab + thin extruded raked grooves + 3 rocks, beside temple.
- **River/bridge/waterfall**: river enters west edge, flows under an arched wooden bridge where it crosses the road, pours off the cliff edge as a waterfall. Expanse mode: falls into a fog ravine.

### 5. Musashi — locomotion + 10 actions

Existing: 1 zazen by fire · 2 kata · 3 reading under sakura · 4 painting sumi-e.
New: 5 tea ceremony by fire · 6 raking the zen garden · 7 bowing at the temple · 8 misogi under the waterfall · 9 carving a bokken under the sakura · 10 gazing from the bridge.

Rules: night biases picker toward fire-adjacent quiet actions (zazen, tea, reading); misogi skipped in winter. Activity duration stays 75 s; walking time (~10–20 s) is between activities.

### 6. Expanse page

`mode: 'expanse'`: no cliff edges; terrain extends past all viewport edges with gentle rolling facets; distance fog replaces paper background; waterfall → fog ravine. Toggle link bottom-right: "expanse ↗" / "island ↗".

## Cross-cutting

- **Reduced motion**: freeze clock at golden hour, minimal particles (extends v1 behavior).
- **Perf**: all particles instanced; flat-shaded only; palette within brief tokens; pause loop on `document.hidden` (existing).
- **Narrow screens**: existing frustum-widening fallback must keep working in both modes.

## Verification plan

Project verify skill (`.claude/skills/verify/SKILL.md`) + new scrub params: drive `?season=winter&time=0.9&speed=30`, screenshot each season × day/night, watch one full walk transition, hover a bubble ≥ 10 s, check expanse page at wide + 390 px.
