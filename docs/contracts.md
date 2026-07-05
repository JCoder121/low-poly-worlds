# sparrow's wake — Module Contracts

Read FIRST: `../design/sparrows-wake-brief.md` (from repo root:
`~/Documents/claude_playground/design/sparrows-wake-brief.md`) and the skill at
`~/.claude/skills/low-poly-living-postcard/SKILL.md`. Reference implementation
patterns: `~/Documents/claude_playground/musashi-homepage/src/*.js`.

Already written (do NOT edit; import from them): `palette.js` (COLORS, mat,
unlit, jitterGeometry), `waves.js` (WAVES, WAVE_MAX, waveHeight(x,z,t),
waveGLSL()), `figures.js` (makeFigure, breathe, walkPose, restPose),
`cycle.js`, `main.js`, `style.css`, both HTML pages. `main.js` shows exactly
how your module is constructed and called — match it.

Shared frame state `ws` (from cycle): `{ mode: 'day'|'night', blend: 0..1
(0=day), time: seconds (scrubbed by ?speed; USE THIS for all animation, not
your own clocks), reduced: bool, lighting: { bg, sun, hemiSky, hemiGround,
trough, mid, crest: THREE.Color; sunIntensity, hemiIntensity, fillIntensity,
starAlpha, lampIntensity: number } }`.

Shared `events` object: `{ plank: { active: bool, phase: 'idle'|'muster'|
'walk'|'bounce'|'splash'|'swim' } }` — plank.js writes, captain/crew read.

World frame: ortho iso camera at (14, 11.5, 14) → (0, 0.4, 0), frustum
half-height 12.5. Sea level y=0, swell peaks ±0.21 (WAVE_MAX). Ship sits at
origin, bow toward +x, starboard = +z (camera-side: plank & traffic visible).
Units ≈ musashi scale; figures are ~1.0 tall.

## water.js — `class Water(scene, pageMode)` [agent A]

THE showpiece. `update(ws)` per frame.
- Ocean surface: non-indexed grid, GPU-displaced via CustomShaderMaterial
  (`import CustomShaderMaterial from "three-custom-shader-material/vanilla"`)
  over `MeshStandardMaterial({ flatShading: true, roughness: 1, metalness: 0 })`.
  Vertex GLSL from `waveGLSL()`; uniforms: uTime (set from ws.time), uTrough/
  uMid/uCrest (vec3, copied from ws.lighting each frame). Fragment: mix the
  three colors by displaced height (csm_Position.y mapped -WAVE_MAX..+WAVE_MAX
  → 0..1, trough→mid at .5, mid→crest above; slight bias toward mid).
  Receive shadows. flatShading gives facet normals automatically.
- `pageMode === 'expanse'`: rect grid ~56×56 units, cell ~0.55 (fog eats the
  far edge). `'island'`: disc radius ~10.5 (CircleGeometry rotated flat,
  toNonIndexed) + a faceted slab skirt below (cliff-edge ring, mat(trough
  color), slight inward taper, jitterGeometry) so the ocean reads as a cut
  block of sea floating on parchment; soft round shadow blob (unlit, 0.08
  alpha) beneath is optional-nice.
- Helpers other modules call:
  `splash(x, z, scale=1)` — white burst: 6-10 unlit foam shards popping up +
  expanding ripple ring, self-removing ~1.2s;
  `ring(x, z)` — single expanding fading ripple ring;
  both animated inside water.update via ws.time.
- Perf: one draw call per surface; no per-frame geometry writes (GPU does
  displacement); reduced motion → halve wave amps via a uAmp uniform.

## ship.js — `class Ship(scene)` [agent B]

The brig. `group` (THREE.Group added to scene), `update(ws)`.
- Hull: chunky extruded/boxy prism ~6.5 long (bow +x), jittered; bulwarks,
  deck at local y≈1.05, stern cabin aft (-x) with 3 window planes + stern
  lantern (brass + glow sphere), bowsprit, 2 masts (x≈+1.2, -0.9, h≈4.8),
  loose square sails (PlaneGeometry 6×4 segments, gentle vertex billow by
  ws.time — CPU fine at this vertex count), black flag at mainmast tip
  (waving strip), crow's nest ring on mainmast, ratline hints (4-6 thin
  cylinders), ship's wheel aft, deck hatch amidships, 2 barrels + coiled
  rope props, one cannon portside, **plank protruding starboard at z≈+1.1,
  local x≈0.4, ~1.4 long** — permanently mounted.
- Bob: sample `waveHeight` (import from waves.js) at 4 corners (±2.6, ±1.0)
  in WORLD space each frame → group.position.y = mean (+ tiny constant so
  hull sits IN the water ~0.35 deep), group.rotation.z/x from fore-aft &
  port-starboard height deltas (damped lerp 0.06); slow heading sway
  rotation.y = sin(ws.time*0.05)*0.04. All deck life is children of `group`
  so everyone rides for free.
- Night: window/lantern materials get emissive `COLORS.lanternGlow`,
  emissiveIntensity = ws.lighting.lampIntensity * ~1.6 (0 by day).
- Exports for others: `spots` — map of named deck positions (LOCAL coords)
  `{ position: THREE.Vector3, facing: radians }`: helm, bow, compass,
  mapBarrel, steps, rail, gullRail, mastNap, cannon, ropeSpot, hatch,
  plankBase, plankTip, crowsNest, swabA, swabB. `keepouts` — array of
  `{ x, z, r }` circles (masts, hatch, wheel) in local coords. `deckY` num.
  `deckBounds` — `{ minX, maxX, minZ, maxZ }` walkable rect (inside
  bulwarks). All meshes castShadow/receiveShadow sensibly.

## captain.js — `class Captain(ship, events)` [agent C]

Jack-shaped figure via makeFigure({ hat:'tricorn', bandanaColor crimson under
hat is fine to skip, coat: COLORS.captainCoat, shirt: crewShirt,
pants: boots-dark }), scale 1.0, added to ship.group. `update(ws, dt)`.
- State machine like musashi.js: activities ~75s (`?duration=` overrides;
  `?activity=` starts one): helm (hands on wheel), spyglass (bow, arm raised
  holding thin cylinder), compass (stands, head+body wobble following a
  wandering compass held flat), map (leans over mapBarrel), rum (sits on
  steps, periodic swig), flourish (slow sword figure-8, 8s form, ~like
  musashi kata), rail (leans on rail watching traffic), gull (crouches at
  gullRail, tosses crumb — a gull prop perches there while active), nap
  (lies under mastNap; night bias: nap/rum/rail weighted 3× after dark).
- Walks between spots: straight-ish path with keep-out detours (offset
  waypoint around any keepout circle the segment crosses), arc-length
  stepping ~0.55 u/s, walkPose(u, swing 0.85 — the swagger), slight rocking
  roll. Props (spyglass, sword, compass, mug) are tiny meshes toggled
  visible per activity.
- During events.plank.active: walk to a spot near plankBase, stand facing
  it (arms crossed pose: both arm pivots rotation.x ≈ 0.9), return to
  routine when phase back to 'idle'.
- breathe() always; restPose when standing.

## crew.js — `class Crew(ship, events)` [agent D — also writes plank.js]

3 figures (makeFigure, bandana hats, varied shirt/stripe colors), children of
ship.group. `update(ws, dt)`. Each crew member has its own small task loop
(~40-60s per task, staggered): swab (at swabA/swabB, mop prop, figure-8
scrub sway), ropeHaul (at ropeSpot, rhythmic pull lean), coil (crouch bob),
crowsNest (walk to mainmast, simple vertical glide up to crowsNest spot,
scan left-right, glide down — no ladder animation needed), cannonPolish
(crouch at cannon, circular arm), doze (night-biased, slumps by hatch).
Keep-outs + arc-length walking same as captain. Crew never leave the deck.
`requestEscort()` → nearest crew abandons task, escorts prisoner (plank.js
positions the prisoner; the escort walks behind it to plankBase, waits,
returns). Expose `escortBusy` bool.

## plank.js — `class Plank(ship, captain, crew, water, events)` [agent D]

The event. `update(ws, dt)`. Every 3–5 min (`?event=plank` fires one 3s
after load; suppress first 45s otherwise). Sequence (phases into
events.plank): muster — prisoner figure (makeFigure, drab colors, arms
pinned: arm pivots rotation.x = -0.4 fixed) pops from hatch, crew escort +
captain converge; walk — prisoner shuffles (short steps, swing 0.3) from
hatch to plankBase then out to plankTip; bounce — two springy dips at the
tip (scale/position bounce with overshoot); splash — prisoner arcs off
(ballistic ~0.7s), calls water.splash(worldX, worldZ, 1.4) on entry, hidden
briefly; swim — resurfaces, backstroke pose (on back, lazy alternating
arms), drifts along traffic lane direction (+x world, ~0.5 u/s) sampling
waveHeight for y, fades/removes at fog edge. Then phase 'idle'. Whole thing
~20s. The prisoner is world-space once airborne (reparent from ship.group
to scene at launch, keeping world transform).

## traffic.js + links.js — `class Traffic(scene, camera, events)` [agent E]

Musashi travelers, seaborne. `update(ws, dt)`.
- Lane: straight world line z ≈ +3.4 (starboard, camera side), running -x →
  +x from ~(-26, 3.4) to (+26, 3.4) with per-spawn z jitter ±0.8. Uniform
  world-speed drift 0.35-0.5 u/s, bob via waveHeight (+ small roll).
- Cast (weighted): bottle-with-rolled-map 22%, canoe+paddler (paddle dips
  alternate sides) 20%, sea turtle (flipper sway) 18%, driftwood+perched
  gull 16%, barrel 14%, shark fin (just a fin slicing, slight S-curve) 4%,
  whale (back arc + spout of foam shards, submerges) 2%, ghost ship 1% —
  NIGHT ONLY (unlit COLORS.ghostShip flat silhouette, far lane z≈-14,
  slow, no bubble), else reroll. Spawn every 20–45s, one at a time on the
  near lane. All geometry from primitives + palette; ~0.3-0.9 scale.
- Bubbles: when |x| < 1.8 (except fin/whale/ghost), pause drift 2s, DOM
  bubble in #bubbles div: `<div class="bubble"><a href target="_blank"
  rel="noopener">the golden age of piracy →</a></div>` positioned every
  frame by projecting (x, y+1.2, z) through camera → screen px (see
  musashi travelers.js pattern). Linger ~14s total then .out + remove.
  Hovering the bubble holds the drifter until pointer leaves.
- links.js: export LINKS = 30 curated `{ label, url }` piracy/maritime
  Wikipedia entries (golden age of piracy, letters of marque, Blackbeard,
  Anne Bonny, the Spanish Main, doldrums, scurvy, pieces of eight, Davy
  Jones' locker, flying dutchman, message in a bottle, celestial
  navigation…). Shuffled no-repeat deck (reshuffle when exhausted).

## sound.js — `class Ambience()` [agent F]

WebAudio, all synthesized, OFF until `toggle()`. `enabled` bool,
`update(ws, dt)`. Lazy AudioContext on first enable (user gesture). Persist
localStorage `sw-sound` = '1'/'0'; auto-enable on construction if '1' BUT
only after first pointerdown (autoplay policy). Layers: ocean bed — brown
noise (buffer) through lowpass ~420Hz, slow gain LFO (0.05Hz ±30%) so it
swells like rollers; wash accents — bandpassed noise burst every 6-14s
(gentle breaking crest); timber creak every 9-20s — short (0.4s) sawtooth
80-140Hz sweep through narrow bandpass, very quiet; gull cry (day only,
every 25-60s) — two-note descending sine chirp w/ vibrato, distant (gain
0.05); ship's bell (every 90-150s) — struck FM/decaying sine pair, softer
at night. Night: bed lowpass down to ~300Hz, no gulls. Master gain 0.5,
2s fade in/out on toggle. No audio files.

## Rules for every agent

- Import three as `import * as THREE from "three"`. Colors ONLY from
  palette COLORS; materials ONLY via mat()/unlit() (+ CSM for water).
- Animate from `ws.time` (scrub-safe), never Date.now/your own clock.
  Springy pop-ins, glacial ambient loops. Respect `ws.reduced`.
- castShadow on figures/props; receiveShadow on deck/water.
- Zero per-frame allocations in update loops (module-scope scratch vectors).
- Write ONLY your assigned file(s). If a contract detail is ambiguous,
  match the musashi-homepage equivalent module.
- Your file must be import-clean (no side effects beyond class/const
  exports) and must not crash if a named spot is missing (fallback
  Vector3(0, deckY, 0)).

---

# v2 addendum — continuous cycle, weather, sky, fishbowl

The two-mode day/night system is replaced by a CONTINUOUS clock + a weather
machine + a dedicated sky module. Camera: expanse frustum 13.8 target (0,2,0);
island page frustum 16 (bowl needs headroom) — main.js owns this.

## ws v2 (cycle.js) — superset, back-compatible

`ws = { dayPos: 0..1 (dawn 0, midday 0.25, dusk 0.55, deep night 0.8 — musashi
convention, ?time= scrubs it), blend: 0..1 nightness (KEEP — captain/crew/ship
read it; derive smoothly from dayPos), mode: 'dawn'|'day'|'dusk'|'night' (band
label), moonPhase: 0..1 (0 new → 0.5 full → 1 new; random per load; live mode
= real synodic phase), time, reduced, lighting: { bg, sun, hemiSky, hemiGround,
trough, mid, crest: Color; sunIntensity, hemiIntensity, fillIntensity,
starAlpha, lampIntensity: number; sunColor: Color for the sky DISC; discPos:
0..1 rise→set progress of whichever disc is up (sun by day, moon by night) },
weather: { kind: 'clear'|'fog'|'rain'|'storm', blend: 0..1 into kind,
fogFactor: 1 clear → 0.45 heavy (main.js multiplies fog distances),
dim: 1 → 0.75 (light multiplier, applied by cycle to intensities BEFORE
publishing), rainAmount: 0..1, flash: 0..1 (lightning this frame, decays fast) } }`

Lighting keyframes at the four anchors, ring-lerped: dawn rose-gold low sun /
midday bright warm-white high sun / dusk ember-gold low sun (the postcard
default) / night cool moon. Water ramps shift with them (dawn rose-tinted
crests, dusk gold, night slate — sky-mirror stays).

?time=, ?weather=clear|fog|rain|storm (pins), ?speed (0 freezes), ?phase=0..1
(moon), ?mode=day|night kept as aliases → time 0.25 / 0.8.

## Files & owners (v2 wave)

- **cycle.js rewrite + NEW weather.js + sound.js patch** [agent cycle-weather]
  - weather.js: `class Weather(scene)` `update(ws, dt)` — state machine:
    clear (dwell 60-150s, weighted 60%) ↔ fog (25%) ↔ rain (12%) → storm (3%,
    only via rain); 10-18s eased transitions writing ws.weather. Rain =
    instanced streak field over the visible sea (musashi weather.js pattern),
    ~140 streaks (40 reduced), only near-camera volume. Storm = rain + flash:
    every 6-16s, flash spikes to 1 then exponential decay ~0.25s; NO bolt
    geometry (calm wins — light does it). Fog kind also raises a low unlit
    mist plane opacity ~0.12 over the water. Cycle owns publishing
    ws.weather; weather.js drives its numbers + owns rain/mist meshes.
  - sound.js patch: rain bed (bandpassed noise, gain by rainAmount), soft
    thunder roll 0.8-2s after each flash (filtered noise swell, quiet),
    gulls only when clear/day. No other layer changes.
- **NEW sky.js** [agent sky] — `class Sky(scene, camera, pageMode)`
  `update(ws)`. Owns EVERYTHING celestial (main.js's old star/moon code is
  being deleted; do not depend on it).
  - Expanse: camera-child band layer (positions are camera-local, z ≈ -57,
    depthTest false, fog false, renderOrder 90+; band half-width ~23, y 3..13
    visible). Sun disc (r .8, color ws.lighting.sunColor, day) and moon disc
    (r .75, pale #e8e4d4, night) arc by ws.lighting.discPos: x = lerp(-19,
    19, discPos), y = 2.5 + 16·sin(π·discPos) — the apex intentionally
    exceeds the band → disc slides off-frame near midday/midnight ("absent
    noon"). Moon phase: full disc + an offset overlay disc tinted to
    ws.lighting.bg (slides across by moonPhase; at 0.5 fully clear = full
    moon). Stars: ~150 points in the band, opacity starAlpha·(weather clear
    ? 1 : 0.25). Shooting star: clear nights only, random every 100-240s —
    a thin bright streak (scaled plane) crossing ~1/3 of the band in 0.7s
    with a fading tail. All opacities also × weather visibility (fog/rain
    hide discs 60%).
  - Island (fishbowl): celestials are WORLD-anchored above the bowl —
    same discs (r 1.1) arcing a real semicircle over it: rise (+13, 1, 0),
    apex (0, 13.5, 0), set (-13, 1, 0) by discPos; stars = small Points
    cloud (r ~12 shell, y > 4) at night; shooting star streaks over the
    bowl. No camera-child hack on this page; depthTest normal (they're
    above everything).
- **water.js island branch → glass bowl** [agent fishbowl]
  - Replace slab skirt/cap with an OPEN GLASS BOWL: lathe profile — rim lip
    at (r 14.2, y 4.6), wall curving down/in to a rounded bottom (r ~4.5,
    y -6.2); LatheGeometry ~48×8 segs, flat-shaded. Glass material:
    MeshStandardMaterial roughness 0.15, transparent, opacity 0.16, side
    DoubleSide, depthWrite false + a slightly more opaque rim torus
    (opacity 0.35) at the lip. Inside below waterline: a dark inner wall
    cylinder (mat troughNight-ish, opacity 1) so the sea reads deep, plus
    the existing cap disc at y -0.23 (keep). Sea surface disc: reuse the
    grid-clip code, radius 13.2. Soft shadow blob under bowl r 15.5. The
    sea + ship must clear the near glass: ship half-length 9.75 < 13.2 ✓.
    Splash/ring pools unchanged. ws.weather.rainAmount > 0 → nothing
    special (rain streaks from weather.js fall inside bowl radius only on
    island — weather.js handles clipping by pageMode; you don't).
- **main.js, traffic.js (passing-island rare far-lane cast, spawn/lane
  numbers), html/css (toggle removal: mode toggle goes away — time flows;
  live ↗ / sound ↗ / island-expanse ↗ remain), skyline status line** — MAIN
  SESSION ONLY. Do not touch.

Rules unchanged: palette-only colors, ws.time animation, zero per-frame
allocs, `node --check` your files, edit ONLY your files.

---

# v3 addendum — reverse snow globe, cast roles, disc-less sky, cleaner rig

## Global: page scale

main.js calls `ship.setScale(s)` after construction: s = 0.9 (expanse) /
0.55 (island). ship.js OWNS the implementation: group.scale.setScalar(s) AND
scales its buoyancy sample offsets + draft by s (children — figures included —
inherit the group scale; that is intended for v3). plank.js must copy the
prisoner's world scale when reparenting to scene. Traffic spawn scale is
multiplied by the page factor (main-session work, not yours).

## water.js [agent bowl] — island → REVERSE SNOW GLOBE + expanse extent

- Island: DELETE the lathe wall/rim above the waterline. New form: a glass
  HEMISPHERE below only — lathe/sphere half (r ≈ 11.6) from the waterline
  equator down to the bottom pole, same glass material recipe; a thin
  glass equator ring (torus r 11.6, tube 0.06, opacity 0.3) right at y≈0.05
  marks the waterline edge. Sea disc: grid-clip radius 11.0. Inner dark
  volume: replace the straight cylinder with a hemisphere-ish inner shell or
  cone (opaque, deep tint) tucked inside the glass so the water reads deep;
  cap disc stays just under the surface (r 11.1). Soft shadow blob r 12.5,
  fatter (the globe SITS on the parchment — slight flatten illusion is fine).
  Nothing rises above the waterline. Splash/ring pools unchanged.
- Expanse: the sea must fill EVERY corner of any viewport at aspect ≤ 2.4
  under frustum half-height 13.8 and camera (15,12.5,15): grow EXPANSE to 96
  and CELL to 0.65 (keeps vertex count sane). Verify corners covered by
  projecting: half-width at 2.4 aspect ≈ 33 world units — a 96-square centred
  at origin covers it.

## ship.js [agent ship-detail] — detail pass + rig fix + setScale

- `setScale(s)` per Global above (default 1 if never called).
- Sails: billow amplitude REDUCED ~60% and the sail planes OFFSET +0.4 local
  x forward of their mast axis so the mast cylinder is never hidden by the
  swaying canvas. Masts stay where they are.
- Finer polygon detail, all code-built from palette (no textures — skill
  rule; kenney/poly.pizza NOT needed here): deck plank seams (thin darker
  strips flush on the deck, ~14 across), hull strakes (2-3 long thin bands
  of hullDark along each side), gunwale cap rail, 3-4 cannonball pyramid
  stacks, a stocked anchor hanging at the port bow (shank+ring+flukes), a
  rudder blade at the stern below the waterline band, simple carved stern
  trim (thin brass band under the cabin windows), a coiled-rope torus or
  two, a crate beside the hatch. castShadow on the chunky ones only (skip
  seams/strakes — shadow map cost).

## captain.js + crew.js + plank.js [agent cast] — roles, banter, manners

- FIVE distinct roles: captain (existing activity set), first mate (map,
  compass, wheel-relief, pacing), lookout (crow's nest, bow watch, gullRail),
  cook (new stew-pot prop near the hatch — small pot + ladle gesture; also
  barrel checks), deckhand (swab/rope/cannon/coil). Crew figures get one
  role each (distinct shirt/stripe/bandana colorways from palette); captain
  is the 5th role. The prisoner is a RECURRING 6th character: the SAME drab
  figure every plank event (persist him; between events he's absent), lines
  acknowledge the routine ("not again", "the water's fine actually").
- Tiny speech bubbles: DOM div.bubble.small into #bubbles (CSS exists —
  main session adds it): plain text, NO link, project from the figure's
  head (+0.5 above), ~2.6s life, springy in/out. Each role gets 6-10 short
  lines (≤ 24 chars, lowercase, pirate-flavored but understated). Global
  rate limit: one ambient bark per 9-15s across the whole cast; plank
  phases may add theirs (escort "this way, mate", prisoner protest, captain
  send-off at the splash).
- Natural interaction, NO overlap: a shared deck-occupancy registry (own it
  in crew.js, export; captain consumes): figures CLAIM their target spot —
  never two on one spot; while walking, if two figures come within 0.8u,
  the junior (deckhand < cook < lookout < mate < captain) pauses + sidesteps
  (existing sidestep pattern); when they stop within 1.6u of each other
  facing, ~30% chance of a paired exchange (A barks, 1.2s later B replies
  from its role's reply lines, both face each other for the beat, then
  resume).

## sky.js + weather.js + cycle.js [agent skyweather]

- sky.js: REMOVE the sun/moon discs, phase overlay, and halo on BOTH pages —
  lighting alone tells the time now (user call: discs felt awkward). Keep
  stars (both pages) + shooting star. ADD rare events:
  rainbow — when ws.weather.kind transitions rain→clear during day (track
  prev kind internally), a soft 5-band arc (thin torus segments or arched
  planes, low saturation palette-adjacent tints, opacity ≤ 0.35) spans the
  haze band ~25s, fade in/out; expanse camera-band + island world-arc.
  meteor shower — clear night, every 4-8 min chance: 5-7 shooting stars
  over ~12s reusing the pooled streak.
  gull flock — day, every 3-6 min: 5 tiny two-triangle gulls flap across
  the upper band in a loose V (camera-band on expanse, over the globe on
  island).
- weather.js: REMOVE the fog kind + mist plane entirely (machine = clear ↔
  rain → storm; rain 14%, storm via rain as before; redistribute fog's
  weight to clear). fogFactor: clear 1.0, rain 0.8, storm 0.7 (rain still
  thickens the air a little — that's atmosphere, not a fog event). Scene
  distance-fog itself STAYS.
- cycle.js: drop 'fog' from the ?weather= pin list; nothing else.

Rules unchanged (palette, ws.time, no per-frame allocs, own files only,
node --check). main session owns: main.js, traffic.js (dolphin pod rare
cast + island lane/scale numbers), style.css (.bubble.small), html, docs.
