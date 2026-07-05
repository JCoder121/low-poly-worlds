# Musashi Homepage — Design + Build Brief

Personal homepage as a living low-poly diorama: a closeup of polygonal Musashi under a cherry tree, cycling through quiet activities, while travelers walk past offering links. Charm of Bit City / Nova Roma / levels.fyi Atlas; soul of Yoshikawa's *Musashi*.

## Throughline (one sentence)

**A toy shrine to discipline** — the cheerful, flat-shaded geometry of a city-builder game, but stripped of its bustle and repainted in washi paper, ink, and sakura, so the page feels like a miniature you could pick up and a monk's clearing you shouldn't disturb.

## Where inspirations conflict — calls made

- **Game refs are busy (cities, HUDs, dozens of agents); Musashi is austere.** Austerity wins on composition (one clearing, one figure, one tree, one path), game-charm wins on geometry and motion (flat-shaded polygons, autonomous little agents, springy pop-in animations).
- **Atlas is an explorable map; this is a homepage.** No camera freedom — one fixed isometric closeup with subtle mouse parallax. The scene comes to you; you don't navigate it.
- **Minimalist homepage vs. game UI.** Steal Atlas's *restraint*: tiny letterspaced mono labels, one wordmark, nothing else. No panels, no menus.
- Jeff's design manifesto (quiet-cyberpunk) **not applied** — wrong mood for washi/sakura; this brief stands alone.

## Extracted from levels.fyi/atlas (live inspection, 2026-07-03)

- Fonts actually rendered: **Nunito** (round UI sans), **IBM Plex Mono** (small-caps letterspaced labels — the signature move), **Fraunces** (serif italic accent lines).
- Colors: ink navy `#071230`, paper `#F7F9FB` (loader cream `#FAF6EC`-ish), accent red `#D6453C`, muted 45–72% navy alphas for secondary text.
- Terrain grammar: faceted low-poly hills in 2–3 flat greens, cone/blob trees, tiny box houses, flat-shaded (no textures), soft single-direction light, gentle fog at horizon.
- Life: autonomous cars/trains on paths; themed loading bar ("Planting 6,000 trees…"); place labels in mono caps with wide tracking.
- Tech: bundled Three.js canvas, full-viewport, HTML overlay for UI.

## Translated from non-browsable inspirations

- **Bit City**: cheerful flat shading, tilt-shift toy feel, everything slightly chunky/rounded.
- **Nova Roma / Kings and Castles**: handcrafted-diorama warmth; buildings as a few extruded prisms; saturated-but-earthy greens.
- ***Musashi* (Yoshikawa)**: the activity set is literally Musashi's arc — sword practice (kata), meditation (zazen by fire), reading, painting (sumi-e — the historical Musashi was a painter). Travelers = the road-companions motif (monks, ronin, merchants, farmers). Cherry blossom = impermanence; petals always falling.

## Design tokens

- **Palette**: washi paper/sky `#F5F0E4`; ink navy (text, outlines, night) `#1C2333`; sakura blossom `#F2B8C6` + highlight `#FBDCE4`; vermillion accent (bubbles' link tint, torii, sash) `#C93E33`; moss greens (hill facets) `#A9BC8B` / `#8CA873` / `#6E8B5E`; path sand `#E6DABE`; ember orange (fire) `#E8853D`; stone grey `#B9B4A6`.
- **Type**: wordmark + headings **Shippori Mincho** (Japanese serif, ink-brush formality); labels/captions **IBM Plex Mono** small caps, `letter-spacing: 0.2em` (direct Atlas steal); body/UI system sans.
- **Motion**: slow and continuous — nothing idles completely. Petals always drift; fire always flickers; figure always breathes. Travelers are the spontaneity beat (random 20–45s intervals). Eases springy on pop-ins (speech bubbles scale-in with slight overshoot), glacial on ambient loops.
- **Signature structural device**: the diorama edge — terrain ends in a clean faceted cliff on all sides (like Atlas's landmass edge), floating on the paper background with a soft shadow. The world is explicitly a miniature.

## The scene (fixed isometric closeup)

1. **Terrain**: 2–3 stacked faceted hill layers, moss green tops, visible polygon facets, diorama cliff edges. A flat clearing center-stage.
2. **Cherry tree**: one large low-poly sakura, canopy of 5–8 pink blobs, dark trunk. Petal particle system falling continuously, drifting with a faint wind curve, settling briefly on ground then fading.
3. **Musashi**: small low-poly figure (capsule/prism build, topknot, navy kimono, vermillion sash, two swords at hip). Activity state machine on a slow clock (~60–90s per activity, eased transitions):
   - *Zazen* — seated by a small campfire (ember light flickers, affects nearby vertex colors)
   - *Reading* — seated against trunk, scroll in hands
   - *Painting* — kneeling at low table, brush strokes appear on a small canvas
   - *Kata* — standing sword practice, slow deliberate swings
4. **Path**: sand-colored dirt path winding across the lower third, entering/exiting at the diorama edges.
5. **Travelers**: spawn at random intervals (20–45s), walk the path, small cast (monk with staff, farmer with basket, merchant pulling cart, wandering ronin). Near center, a speech bubble pops (mono type, paper card, vermillion link): "the sengoku period →", "history of japan →", "how hollywood began →", "the book of five rings →", etc. Clickable (opens Wikipedia in new tab); bubble lingers ~8s, traveler pauses while hovered.
6. **Sky/light**: warm fixed golden-hour key light + soft ambient; option for real-time day/night (open question).
7. **UI overlay** (HTML, not canvas): wordmark top-left ("Jeffrey" or chosen name + small jp gloss), 3–4 mono links bottom-left (github / email / etc.), tiny mono status line bottom-center narrating the scene ("musashi is practicing kata"). Nothing else.
8. **Loading screen**: paper background, wordmark, themed progress copy ("planting the cherry tree…", "lighting the fire…", "sharpening both swords…") — direct homage to Atlas's loader.

## Functional plan

- Single static page. **Vite + Three.js** (flat-shaded MeshLambert/Toon materials, vertex colors, no textures). No backend.
- Fixed orthographic-ish camera; mouse parallax ±2°; no user camera control.
- Systems: activity state machine (timer-driven), traveler spawner + link table (curated ~15 Wikipedia links, shuffled no-repeat), petal particles (instanced), fire light flicker, status-line narrator synced to state machine.
- Overlay links + speech bubbles are DOM (accessible, real `<a>` tags), positioned via projected 3D coordinates for bubbles.
- Lives at `~/Documents/claude_playground/musashi-homepage/`.
- Perf: instancing for petals/trees, capped pixel ratio, pause loop on `document.hidden`.

## Decisions (2026-07-03)

1. Personal content: **name only** — wordmark, no link list, no intro line.
2. Traveler links: **random world-history Wikipedia mix**, start with ~100 basics; list curated later.
3. Light: **fixed golden hour**.
4. Build approved — Vite + Three.js at `~/Documents/claude_playground/musashi-homepage/`.
