---
name: verify
description: How to verify the sparrows-wake diorama end-to-end (dev server + Playwright screenshots)
---

# Verifying sparrow's wake

```sh
cd ~/Documents/claude_playground/sparrows-wake
npm run dev   # http://localhost:5173 (needs sandbox-free listen socket)
```

Loader takes ~2.5s — always `sleep 3` before screenshots.

## Scrub params (both pages)

| param | example | effect |
|---|---|---|
| `mode` | `?mode=night` | pin day/night (else random per load) |
| `speed` | `?speed=0` | wave/animation clock multiplier; 0 freezes the sea for pixel-diff shots (event choreography runs on real dt, not this clock) |
| `activity` | `?activity=flourish` | captain starts here (helm, spyglass, compass, map, rum, flourish, rail, gull, nap) |
| `duration` | `?duration=15` | secs per captain activity (default 75) |
| `event` | `?event=plank` | plank event fires once, 3s after load (~20s total) |
| `real` | `?real=1` | force live-clock mode |

## The checklist

1. **Day expanse** `/?mode=day` — sea reads as crisp facets (no smooth
   gradients, no repeating argyle lattice), mid-teal dominant, pale crests
   occasional; ship crisp (fog must NOT wash the center); crew moving.
2. **Night expanse** `/?mode=night` — moon + halo + stars in the top haze
   band; warm lantern pool at the stern vs cool moonlit sea; long
   moon-shadow; windows amber.
3. **Island** `/island.html?mode=day` — faceted disc with stepped hand-cut
   rim, no parchment slivers between surface/skirt, soft shadow blob;
   traffic enters/leaves at the rim (never floats on paper); no ghost ship
   here ever.
4. **Toggle** — click `night ↗`: 3s eased crossfade, labels flip, body class
   `night` (UI text lightens).
5. **Plank** `/?event=plank` — muster (captain + escort converge) → shuffle
   walk → two bounces at the tip → splash burst + ripple → backstroke exit
   toward +x. Captain resumes routine after.
6. **Bubble** — wait for a drifter to reach center: paper bubble, vermillion
   mono link, opens Wikipedia in new tab, drifter holds while hovered.
7. **Console** — zero errors (favicon 404 is known/harmless).

Screenshots land in the CWD the Playwright MCP was started from — check
`~/Documents/claude_playground/` if not beside the project.
