---
name: verify
description: How to verify the musashi-homepage diorama end-to-end (dev server + Playwright)
---

# Verifying musashi-homepage

Vite static site, no tests. Surface = pixels + DOM overlays.

## Launch
- `npm run dev` in this dir → usually http://localhost:5199 (check terminal for actual port). Often already running.
- Drive with Playwright MCP: navigate, screenshot, `browser_evaluate`.

## Key hooks for driving
- Status pill: `document.querySelector('[class*="status"], [class*="pill"]').textContent` — narrates Musashi's activity ("musashi is sitting by the fire" / kata / reading / painting) and traveler events ("the ronin knows a story").
- Musashi cycles activities every 75 s (`activityDuration` in src/musashi.js:155); activities: zazen, kata, reading, painting.
- Travelers spawn 20–45 s apart (src/travelers.js:194); bubble = `a[href*="wikipedia"]` overlay, ~99 links in src/links.js. Bubbles expire in seconds — poll, don't sleep-then-check.
- Hover-pause: dispatch `mouseenter` on the bubble's parent div (listener is on the bubble, src/travelers.js:113); measure bubble getBoundingClientRect drift over ~1.2 s hovered vs not (~5 px → <1 px).
- Tilt: dispatch `PointerEvent('pointermove')` on window, wait ~1 s for lerp, compare screenshots.
- Loader: `#loader` gets class `done`; catch phrases by polling `#loader` innerText immediately after `location.reload()` (a fresh evaluate call — reload kills the JS context of the polling one).
- Narrow fallback: resize to 390×844 — frustum widens (src/main.js:49) so island stays framed.
- Reduced motion: media-query checks in src/main.js:6, src/world.js:428, src/style.css:179 — code-only check; Playwright MCP has no emulateMedia tool.

## Gotchas
- Playwright MCP saves screenshots to claude_playground root (its cwd), not this dir — move them out after.
- Console shows ~20 benign three.js "toNonIndexed(): already non-indexed" warnings on load; not a regression signal.
