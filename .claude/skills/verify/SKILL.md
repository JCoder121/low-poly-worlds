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
| `weather` | `?weather=storm` | pin clear / rain / storm (fog removed in v3) |
| `speed` | `?speed=0` | clock multiplier; 0 freezes sea + cycle for pixel-diff shots (event choreography runs on real dt) |
| `activity` | `?activity=fishing` | captain start (helm, spyglass, compass, map, rum, flourish, rail, gull, nap, fishing, pace, bell) |
| `duration` | `?duration=15` | secs per captain activity (default 75) |
| `event` | `?event=plank` | plank event once, 3s after load (~20s) |
| `real` | `?real=1` | force live-clock mode |

## The checklist

1. **Cycle sweep** `/?time=` 0.04 rose dawn / 0.25 turquoise noon / 0.58
   golden hour / 0.85 night plateau (stars + lantern). NO sun/moon discs
   anywhere since v3 — lighting alone tells the time.
2. **Weather** `?weather=rain|storm` — rain streaks + dimmed light; storm
   adds full-scene flashes every 6-16s. Sky events: rainbow after a daytime
   rain→clear break, meteor shower bursts + shooting stars on clear nights,
   gull flocks by day. Water events: dolphin pod porpoising the lane.
3. **Ship** — 0.9× on expanse, plank seams/strakes/anchor/cannonball
   stacks visible; sails offset forward of the masts (masts NEVER hidden by
   canvas sway); cast of 5 roles + recurring prisoner, tiny bark bubbles
   every ~9-15s, figures never overlap or share a spot.
4. **Snow globe** `/island.html` — glass HEMISPHERE below the waterline
   only (nothing rises above it), equator ring at the rim, everything at
   0.55× inside; star cloud hovers over the bowl at night; traffic + plank
   swimmer fade at the rim.
5. **Plank** `?event=plank` — muster → shuffle → two bounces → longer
   splash arc (deck is high now) → backstroke exit.
6. **Bubble** — drifters 40-80s apart: paper bubble, vermillion link,
   hover holds. Rare cast: shark fin, whale spout, dolphins, night ghost
   ship, passing palm island (~90s, no bob). Expanse sea must fill every
   viewport corner at wide aspect (96-unit grid).
7. **Console** — zero errors (favicon 404 known).

Screenshots land in the CWD the Playwright MCP was started from — check
`~/Documents/claude_playground/` if not beside the project.
