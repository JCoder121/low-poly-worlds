# low-poly worlds

A collection of low-poly living postcards — miniature worlds that run by
themselves, built per the `low-poly-living-postcard` skill. Each is its own
standalone site; this dir just keeps them together.

## Current builds

- **`musashi-homepage/`** — personal homepage as a living diorama (Musashi's
  Hill). `musashi` shell alias.
- **`sparrows-wake/`** — a hove-to pirate brig on open Caribbean swell.
  `sparrow` shell alias.

(`archive/salary-atlas` also lives under here but is a separate, unfinished,
standalone project — not part of the roadmap below.)

## Roadmap: a shared landing site

Host a single GitHub Pages site that acts as the front door to every
diorama, in the same charming, simplistic style as the postcards themselves
(same loading splash screen convention carries over to the landing page).

- **Default view: a low-poly 2D map of Earth.** Each diorama gets a marker
  at its real-world location — a fixed marker in Japan for musashi's Hill,
  a marker that drifts across the seas for sparrow's wake (it's a ship, not
  a place). Clicking a marker navigates to that diorama, landing in
  **expanse mode by default**.
- **An "off-world" link** for fantasy dioramas (not tied to any real
  location) — future homepages for fictional settings. Exact presentation
  TBD, but the working idea is one low-poly "galaxy" per universe (e.g. one
  for the Cosmere, one for the world of Red Rising), each holding markers
  for that universe's characters/homepages.
