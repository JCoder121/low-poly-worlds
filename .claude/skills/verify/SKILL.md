---
name: verify
description: How to verify the musashi-homepage diorama end-to-end (dev server + Playwright)
---

# Verifying musashi-homepage (v2)

Vite static site, no tests. Surface = pixels + DOM overlays. Two pages, one
scene graph: `/` (island, framed diorama) and `/expanse.html` (full-viewport
terrain, same actors). Toggle link bottom-right on each (`expanse ↗` /
`island ↗`).

## Launch
- `npm run dev` in this dir → usually http://localhost:5199 (check terminal for actual port). Often already running.
- Drive with Playwright MCP: navigate, screenshot, `browser_evaluate`.

## Dev scrub params (query string, either page)
| param | values | effect |
|---|---|---|
| `time` | 0..1 | day position; dawn 0.0, day 0.25, **dusk 0.55 (default)**, night 0.8 (wraps at 1) |
| `season` | `spring｜summer｜autumn｜winter` or `0-3` | starting season (default spring/0) |
| `speed` | multiplier | day/night + season clock rate; `0` **freezes** the clock (use for clean screenshots); `60` fast-forwards a season boundary in ~12s (`DAY_LENGTH`=360s, `DAYS_PER_SEASON`=2 → 720s/season) |
| `activity` | one of the 10 names below | starting activity (see known nit) |
| `duration` | seconds | override activity-hold time before the next walk (default 75s) |

Negative/garbage values are guarded (clamped or ignored) — see `e444ef8` fix commit.

Always pair `time`/`season` screenshots with `&speed=0` so the frame doesn't drift mid-capture.

## The 10 activities
`zazen, kata, reading, painting, tea, raking, temple, misogi, carving, bridge`
— each has a home "spot" (`musashi.js SPOT_FOR`); several share a spot
(zazen/tea @ fire, reading/carving @ tree), so `pickNext` excludes
same-spot activities as candidates. Night (`ws.night > 0.5`) biases the
pool to `[zazen, tea, reading]`. Winter excludes `misogi`.

## Key hooks for driving
- Status pill: `document.getElementById('status').textContent` — narrates Musashi's current activity, walk-starts ("musashi walks to the fire" etc.), and traveler events ("a monk approaches on the road" / "the monk knows a story"). Best observed via a `MutationObserver` on `#status` logging `[performance.now(), textContent]`, not by polling — see known nit below.
- Musashi cycles activities every `activityDuration` seconds (default 75, `?duration=` override; `musashi.js` ~line 190); walks between spots via a `CatmullRomCurve3` with two jittered waypoints (`startWalk`/`updateWalk`).
- Travelers spawn ~7-45s apart (first visit early, `travelers.js` `nextSpawnAt`); bubble = `.bubble a[href*="wikipedia"]`-ish overlay (actual class is `.bubble`, one `<a>` inside), ~130 links in `src/links.js`.
- **Bubble timing**: linger 14s from creation (`traveler.bubbleTimer = 14`); hovering the bubble itself (`bubble.addEventListener("mouseenter", ...)` — NOT a parent wrapper) sets `traveler.paused = true`, freezing its position; `mouseleave` resumes and re-extends the timer to `Math.max(bubbleTimer, 10)` (10s minimum post-hover linger). Removal itself has a 750ms CSS fade tail after the timer hits 0 (`dismissBubble`), so creation→DOM-removal measures ~14.7-14.8s total — that's correct, not a bug.
- Hover-pause verification: dispatch `mouseenter` directly on `document.querySelector('.bubble')` (not its parent), sample `getBoundingClientRect().left` every ~150ms before/during/after — unhovered drifts several px/sample, hovered `left` is bit-for-bit frozen (only the walk-bob `top` jitter continues, since that's t-based not position-based).
- Night/lantern/stars: `ws.night` (0..1) is derived from the lighting keyframe interpolation between the dusk (0.55) and night (0.8) `KEYS` in `cycle.js` — it's a continuous ramp, not a hard threshold. It drives: star field opacity (`cycle.js addStars`), the stone lantern's point light + glow emissive (`landmarks.js` ~line 298-300, scales `ws.night * 1.6` / `* 1.1`), summer fireflies opacity (`weather.js updateFireflies`, `ws.night * pulse`). Use `?time=0.8&speed=0` for full night; `?time=0.55` (default) for zero night effects.
- Season boundary: `?speed=60` advances one full season in ~12s real time — confirmed by watching the tree/terrain palette flip (e.g. `?season=winter` → spring → summer) and season-appropriate weather (fireflies only in summer, mist only in autumn, rain bursts only in spring) come and go.
- River freezes in winter (`landmarks.js`); frozen river reads as a pale icy strip vs. the blue-green summer water.
- Tilt: dispatch `PointerEvent('pointermove')` on window, wait ~1 s for lerp, compare screenshots. Disabled entirely under reduced motion (see below).
- Loader: `#loader` gets class `done`; catch phrases by polling `#loader` innerText immediately after `location.reload()` (a fresh evaluate call — reload kills the JS context of the polling one).
- Narrow fallback: resize to 390×844 — on `/`, the frustum widens (`main.js frameCamera`, `Math.max(FRUSTUM, 16.5/aspect)`) so the island stays framed; on `/expanse.html`, frustum height is fixed (no island to fit) and only narrows horizontally on tall screens, to avoid clipping into the ground on portrait aspects.
- Reduced motion: code-only check, no Playwright emulateMedia tool available. Five touchpoints:
  1. `main.js` (top-level `reducedMotion` const) — disables the `pointermove` parallax listener entirely.
  2. `cycle.js` `Cycle` constructor — `this.speed = reducedMotion ? 0 : ...`, i.e. the whole day/night/season clock freezes.
  3. `musashi.js` (`this.reducedMotion`, in `update()`) — skips `startWalk`, falls back to the old instant-fade activity swap instead of a physical walk.
  4. `weather.js` constructor + per-system guards — particle cap drops from 110 to 30; spring rain is skipped entirely (`if (!reducedMotion)` around rain setup); fireflies stop orbiting (position stays at `base`, only opacity pulses); autumn mist stops drifting.
  5. `style.css` `@media (prefers-reduced-motion: reduce)` block — disables the `.bubble` CSS animations (appear/leave).

## Gotchas
- Playwright MCP saves screenshots to claude_playground root (its cwd), not this dir — move them out after.
- Console shows ~20-26 benign three.js "toNonIndexed(): already non-indexed" warnings on load; not a regression signal. Use `browser_console_messages` **without** `all: true` (i.e. since-last-navigation) when checking for errors — with `all: true` you'll also see stale HMR noise (duplicate-identifier / transient reference errors) left over from earlier live-edit sessions against the same dev server; that's an artifact of hot-reload during development, not a defect in the current code.
- Known nit: Musashi's "musashi walks to X" status line only fires `if (!interrupted)` (`main.js` `onWalkStart`), and `interrupted` is `true` for a traveler's **entire** time on screen (from spawn's "approaches on the road" line through full departure), not just while its speech bubble is up. Because a traveler's road transit is much longer (~40s+) than a short `?duration=` test value, the walk-transition line is very often silently swallowed by a concurrent traveler — the walk still happens physically (position/pose update), just without its own status line. To observe the "walks to" text reliably, use a `duration` long enough to clear the traveler window, or accept the arrival line (`"musashi is <activity>..."`) as the transition's confirmation instead.
- Known nit: initial status pill text is stale when `?activity=` is used to start on a non-default activity — the pill still shows the default zazen line until the first transition fires.
