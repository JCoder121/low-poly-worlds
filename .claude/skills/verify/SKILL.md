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
| `time` | `?time=0.55` | day position 0..1 (dawn 0, midday 0.25, dusk/golden 0.55, deep night 0.8; night holds to 0.93). Random per load otherwise |
| `mode` | `?mode=night` | alias → time 0.25 / 0.8 |
| `weather` | `?weather=storm` | pin clear / fog / rain / storm (else Markov machine) |
| `phase` | `?phase=0.5` | moon phase (0 new, 0.5 full); live mode uses the real moon |
| `speed` | `?speed=0` | clock multiplier; 0 freezes sea + cycle for pixel-diff shots (event choreography runs on real dt) |
| `activity` | `?activity=fishing` | captain start (helm, spyglass, compass, map, rum, flourish, rail, gull, nap, fishing, pace, bell) |
| `duration` | `?duration=15` | secs per captain activity (default 75) |
| `event` | `?event=plank` | plank event once, 3s after load (~20s) |
| `real` | `?real=1` | force live-clock mode |

## The checklist

1. **Cycle sweep** `/?time=` 0.04 (rose dawn, sun disc low-left), 0.25
   (bright turquoise noon, NO disc in expanse — absent-noon is intentional),
   0.58 (golden hour: ember sun setting right, gold crests), 0.85 (deep
   night PLATEAU — dark indigo must HOLD, stars out, stern lantern glowing
   above the roofline; moon returns descending ~0.91).
2. **Weather** `?weather=fog|rain|storm` — fog pulls the wall in + mist;
   rain streaks + dimmed light; storm adds blue-white full-scene flashes
   every 6-16s (no bolt geometry). Status line suffix updates.
3. **Ship at 3×** — crew (4) + captain read as little figures ON a big brig;
   sails cream (not grey) at any hour; bob is gentle (long hull averages
   the swell).
4. **Fishbowl** `/island.html` — glass wall + rim visible, sea inside, ship
   clears the glass; sun/moon arc OVERHEAD in world space (visible at noon
   here, unlike expanse); stars above the bowl at night; no parchment
   slivers; traffic + plank swimmer fade at the rim, never cross the glass.
5. **Plank** `?event=plank` — muster → shuffle → two bounces → longer
   splash arc (deck is high now) → backstroke exit.
6. **Bubble** — drifters are rarer now (40-80s gaps, lane z≈8.4): paper
   bubble, vermillion link, hover holds. Rare cast: shark fin, whale spout,
   night ghost ship (far lane), passing palm island (~90s crossing, no bob).
7. **Console** — zero errors (favicon 404 known).

Screenshots land in the CWD the Playwright MCP was started from — check
`~/Documents/claude_playground/` if not beside the project.
