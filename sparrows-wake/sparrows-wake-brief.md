# sparrow's wake — Design Brief (prototype)

A hove-to pirate brig bobbing on open Caribbean swell — toy-ship charm,
moonlit-sea calm. The captain drifts through his routines, three crew mill
about, and the sea delivers odd little visitors. Built per the
`low-poly-living-postcard` skill; musashi-homepage is the reference build.

## Throughline

**A toy ship becalmed at the edge of the map** — city-builder geometry and
springy agents, but the composition is one ship, one swell, one drifting lane
of visitors, floating on treasure-map parchment.

## Decisions (2026-07-04, approved)

1. Ship is **adrift / hove-to** — bobs and sways on the swell, sails loosely
   set, slow heading drift. No wake, no sailing motion.
2. Traffic offers **speech-bubble links** — ~30 piracy/maritime-history
   Wikipedia links.
3. Walk-the-plank is **comedic**: bounce, cannonball splash, relieved
   backstroke toward the horizon. Every 3–5 min.
4. Folder: `~/Documents/claude_playground/sparrows-wake/`.
5. Prototype scope: **two discrete modes only** — clear day (sun) / clear
   night (moon + stars). 3s eased crossfade. Random on load; `day/night ↗`
   toggle; `live ↗` real-clock mapping; `?mode=` pins. No seasons, no
   weather, no postprocessing.

## The water (single showpiece slot)

- GPU waves: `three-custom-shader-material` over
  `MeshStandardMaterial({ flatShading: true })`. Vertex shader displaces a
  non-indexed grid with 3 directional sines (swell λ7/amp .14, chop λ2.8/.05,
  shimmer λ1.3/.02). flatShading derives facet normals per-fragment — free.
- JS twin `waveHeight(x, z, t)` (src/waves.js) drives all buoyancy on CPU.
- Height-ramped color in fragment: day `#14506E → #1D6E93 → #57B7C4`;
  night `#0B2238 → #1E3A5C → #3E6E8E`. Base lerps ~25% toward fog color
  (sky-mirror). Moon-glitter path emerges free from facets + directional
  light — no sparkle system.
- Foam `#FBF6EA`: unlit hull waterline strip riding the sampled swell;
  splash burst + ripple rings for events. Never depth-based foam.

## Light

- Day: sun `#FFE8C0` (~1.8, NE, PCFSoft 2048, bias -0.0006), warm hemi, fog
  to parchment `#F4E9D4`.
- Night: moon `#BFD4EC` (~0.75, W), cool hemi, fog to indigo `#161F36`,
  stars (Points, alpha by blend), stern lantern + cabin windows emissive
  `#FFB65C`. Warm-vs-cool is the night composition.

## Cast & scene

- **Brig**: chunky extruded hull `#4A3728`/trim `#2E2016`, deck `#8A6A47`,
  2 masts, loose sails `#EDE3CB` (slow billow), bowsprit, stern cabin with
  windows, wheel, crow's nest, black flag, **plank permanently mounted
  starboard**. Bob = sample waveHeight at 4 hull points → y/pitch/roll.
- **Captain** (Jack-shaped: tricorn, red bandana `#A63D33`, faded navy coat
  `#3A3F55`): ~9 activities — helm, spyglass at bow, wobbly compass, map on
  barrel, rum on steps, sword flourish, rail lean, feed gull, mast nap
  (night-biased). Real walks, keep-outs, ~75s per activity.
- **Crew ×3** (striped shirts): swab, haul/coil rope, crow's-nest climb,
  cannon polish, night doze.
- **Traffic lane** past starboard: bottle-with-map, canoe + paddler, sea
  turtle, driftwood + gull, barrel; rare: shark fin 4%, whale spout 2%,
  ghost-ship silhouette far off 1% night-only. Spawns 20–45s, uniform
  world-speed drift, bubbles near center linger ~14s.
- **Plank event**: crew escorts prisoner from hatch, captain supervises,
  two springy bounces, splash, backstroke exit along the lane. ~20s.

## Pillars checklist

Loader (parchment, skull-and-sparrow mon, "hoisting the colours… / counting
the rum… / waking the captain…") · ambience (nothing idles; sound toggle OFF
by default — synthesized ocean bed, timber creaks, sparse gull, ship's bell)
· parallax ±2° ortho iso camera · island (faceted ocean slab on parchment,
`/island.html`) / expanse (landing `/`) · scrub params `?mode ?speed
?activity ?duration ?event` (`?speed=0` freezes for screenshots).

## Anatomy (file-partitioned for parallel build)

Shared contracts (main session): palette.js, waves.js, figures.js, cycle.js,
main.js, style.css, html. Agents: water.js · ship.js · captain.js ·
crew.js+plank.js · traffic.js+links.js · sound.js. Contracts doc:
`sparrows-wake/docs/contracts.md`.

## Type & UI

Wordmark "sparrow's wake" — display serif (Pirata One is too costumey; use
IM Fell English or similar weathered serif); labels IBM Plex Mono small caps
0.2em. Toggles: `island/expanse ↗` bottom-right; `day/night ↗`, `sound ↗`,
`live ↗` bottom-left. No panels, no narration.
