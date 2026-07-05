---
name: verify
description: How to verify the musashi-homepage diorama end-to-end (dev server + Playwright)
---

# Verifying musashi-homepage (v4)

Vite static site, no tests. Surface = pixels + DOM overlays. Two pages, one
scene graph: `/` (**expanse**, full-viewport terrain — the default since v4)
and `/island.html` (framed single-slab island diorama). Toggle link
bottom-right on each (`island ↗` / `expanse ↗`).

## Launch
- `npm run dev` in this dir → usually http://localhost:5173 (check terminal for actual port). Often already running.
- Drive with Playwright MCP: navigate, screenshot, `browser_evaluate`.

## Dev scrub params (query string, either page)
| param | values | effect |
|---|---|---|
| `time` | 0..1 | day position; dawn 0.0, day 0.25, dusk 0.55, night 0.8 (wraps at 1). **Since v5 the default is RANDOM per load** — always pin `time` explicitly for deterministic screenshots |
| `season` | `spring｜summer｜autumn｜winter` or `0-3` | starting season. **Since v5 the default is RANDOM** (and a random offset within the season); a pinned `?season=` starts at the season's beginning for a full stable window |
| `speed` | multiplier | day/night + season clock rate; `0` **freezes** the clock (use for clean screenshots); `60` fast-forwards a season boundary in ~12s (`DAY_LENGTH`=360s, `DAYS_PER_SEASON`=2 → 720s/season) |
| `activity` | one of the 10 names below | starting activity |
| `duration` | seconds | override activity-hold time before the next walk (default 75s) |

Negative/garbage values are guarded (clamped or ignored) — see `e444ef8` fix commit.

Always pair `time`/`season` screenshots with `&speed=0` so the frame doesn't drift mid-capture.

## The 10 activities
`zazen, kata, reading, painting, tea, raking, temple, misogi, carving, bridge`
— each has a home "spot" (`musashi.js SPOT_FOR`); several share a spot
(zazen/tea @ fire, reading/carving @ tree), so `pickNext` excludes
same-spot activities as candidates. Night (`ws.night > 0.5`) biases the
pool to `[zazen, tea, reading]`. Winter excludes `misogi`. Since v4, misogi
means standing in the koi pond shallows facing the river's inflow.

## Key hooks for driving
- **No status pill since v4** — the `#status` narration line was removed. Musashi's activity is verified visually (pose + spot); traveler arrivals are verified by their speech bubble alone.
- Wordmark = `musashi's hill` + a live season line: `document.getElementById('season').textContent` must equal `ws.season` (updates on season flips; check with `?speed=60` — flips within ~12s).
- Musashi cycles activities every `activityDuration` seconds (default 75, `?duration=` override); walks between spots via a `CatmullRomCurve3` with two jittered waypoints (`startWalk`/`updateWalk`).
- Travelers spawn ~7-45s apart (first visit early, `travelers.js` `nextSpawnAt`); bubble = `.bubble` overlay (one `<a>` inside), 141 links in `src/links.js`. Since v5 the cast is weighted (`KINDS` table): monk/farmer/merchant/ronin/pilgrim/fisherman/noblewoman common-ish, samurai 4%, fox spirit 5%, shogun 1%. Humanoids are scaled 1.3× (Musashi-comparable); the fox is animal-scaled with a lower bubble anchor (`bubbleY`).
- Musashi's walks route AROUND the fire pit at (0.9, 0.2) (`musashi.js` FIRE/KEEPOUT + curve resample); his kata is an 8s six-phase form (chudan → rise → poise → cut → follow-through → return) with a curved 3-segment blade — verify with `?activity=kata&speed=0&time=0.55&season=spring` and 2-3 screenshots a few seconds apart showing distinct phases.
- **Traveler speed is uniform since v4**: stepping is `u += dir * (speed / curveLength) * dt` with `getPointAt/getTangentAt` (arc-length), speed 0.36-0.44 world-units/s. On `/` (long road curve), spawn happens where `|x|` first drops under 13 (just inside the fog); the bubble triggers at `|world x| < 1.6` (mid-frame). Verify no fast-then-slow snap: sample the bubble's `style.left` per second — deltas should be steady (~±10%, road curvature only).
- **Bubble timing**: linger 14s from creation (`traveler.bubbleTimer = 14`); hovering the bubble sets `traveler.paused = true`, freezing its position; `mouseleave` resumes and re-extends the timer to `Math.max(bubbleTimer, 10)`. Removal has a 750ms CSS fade tail, so creation→DOM-removal measures ~14.7-14.8s total — correct, not a bug.
- Hover-pause verification: dispatch `mouseenter` directly on `document.querySelector('.bubble')`, sample `getBoundingClientRect().left` every ~150ms before/during/after — unhovered drifts several px/sample, hovered `left` is bit-for-bit frozen.
- Night/lantern/stars: `ws.night` (0..1) is a continuous ramp between the dusk (0.55) and night (0.8) `KEYS` in `cycle.js`. It drives: star field opacity (island page only), the stone lantern's light/glow, summer fireflies. Use `?time=0.8&speed=0` for full night; `?time=0.55` (default) for zero night effects.
- Tilt: dispatch `PointerEvent('pointermove')` on window, wait ~1 s for lerp, compare screenshots. Disabled under reduced motion.
- Loader: `#loader` gets class `done`; the 武蔵の丘 splash is intentionally kept (it's the splash mon, not the top-left wordmark).
- Reduced motion: code-only check. Touchpoints: `main.js` parallax off; `cycle.js` clock frozen; `musashi.js` instant activity swap instead of walks; `weather.js` particle cap 30, no rain, static fireflies/mist; `style.css` bubble animations off; `water.js` (grep `reducedMotion`) — swell baked once, foam static, streaks/rings hidden, koi at 0.15× speed.

## v4 water (river → koi lake)
The big cliff waterfall, expanse basin, night sparkles, and dragonflies are
**gone** since v4. The rig, identical on both pages: river enters at the NW
(tapering to a point + sinking into the ground over its first ~12% — no hard
start), runs under the bridge, and flows straight into the **koi pond/lake**
(disc r 1.1, top face y 0.06, at grade like the road) at world (-2.4, 5.2).
Since v5 the river is 9 control points and winds — the bridge crossing at
(-4.2, 2.6) sits roughly halfway along its arc. On the island page the road
is trimmed per-load to the generated cliff edge (world.js outline
interpolator), so its ends always meet the rim exactly.
The river curve's tail ends inside the disc so the surfaces overlap and share
the mirror tint (no seam); the dark bank ribbons stop at u 0.88 so no bank
juts into the open water; 3 ripple rings cycle outward from the inflow.

**Sky-mirror tint** — river + pond color = `WATER (0x93bfd0)` lerped 30% toward
`ws.lighting.bg`, scaled 0.90, then lerped toward `ICE (0xd8e4ea)` by `frozen`.
Rose-pale at dawn, gold at dusk, ink-dark at night. Screenshot each `&speed=0`.

**Gating conditions** (check by screenshot, not just code):
| feature | visible when | hidden/altered when |
|---|---|---|
| bank foam lines + drifting streaks | `frozen < 0.5` (streaks; clamped to u∈[0.15,0.95], never on the tapered tip) | winter: fade to nothing, no popping |
| ripple rings (3, at the river's inflow into the pond) | `!reducedMotion && frozen < 1` | winter or reduced motion: invisible |
| koi (2, circling the pond at radii 0.4/0.62) | `frozen < 0.5` | frozen: hidden; reduced motion: 0.15× speed |

**No-sparkle/no-dragonfly check**: `?time=0.8&speed=0` → zero glints on the
water; `?season=summer&time=0.25&speed=0` → zero dragonflies over the river.

**Frozen-stillness check**: at `?season=winter&speed=0`, two screenshots ~3s
apart — the water crop must be pixel-identical. `frozen` ramps across the
`SEASON_FADE=20` window, so autumn-nearing-winter shows a partial ice tint.

**Two-frame-diff technique** (confirming motion): live clock, screenshot, wait
2-4s, screenshot, diff the water region only (crop first). Expect ripple-ring
phase change, a koi displaced, streaks shifted.

**Season-boundary sweep**: `?season=autumn&speed=60`, screenshot every ~1s from
t=0 — the 20-sim-second crossfade is ≈0.3s real at speed 60; a genuine blend
frame shows leaves + snow at once and water already shifting toward ice.

## Gotchas
- Playwright MCP saves screenshots to claude_playground root (its cwd), not this dir — move them out after.
- Console shows ~20-26 benign three.js "toNonIndexed(): already non-indexed" warnings on load; not a regression signal. Use `browser_console_messages` **without** `all: true` — with it you'll see stale HMR noise from earlier live-edit sessions.
- The expanse ground grid is coarse (~2.4 world-units/vertex; only ONE vertex would land inside the pond). That's why the pond sits AT grade on flat ground (disc embedded just above y=0) — any sunken-pond design needs a deep, wide terrain carve or bilinear interpolation buries the water under the mesh.
- The expanse haze at the top of the frame is intentional `THREE.Fog` depth fog (`main.js`), tuned closer on `/` (16/30) than island (20/38). Not a bug.
