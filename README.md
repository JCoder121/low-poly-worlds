# musashi's hill · 武蔵の丘

Personal homepage as a living low-poly diorama. Musashi cycles through his day
(zazen by the fire → sword kata → reading → painting) under a cherry tree while
travelers pass on the road offering world-history Wikipedia links in speech bubbles.

Design brief: `../design/musashi-homepage-brief.md`

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/
```

## Anatomy

- `src/world.js` — island/expanse terrain, sakura tree, fire, path, torii, season tints
- `src/musashi.js` — the figure, his ten activities, the walk/settle state machine
- `src/travelers.js` — spawner, walking figures, speech-bubble links
- `src/links.js` — the travelers' library (99 Wikipedia links, shuffled deck)
- `src/cycle.js` — the day/night + season clock (`ws` state read by everything else)
- `src/weather.js` — seasonal falling particles (petals/leaves/snow), rain, fireflies, mist
- `src/landmarks.js` — temple, lantern, zen garden, river/bridge/waterfall
- `src/main.js` — renderer, lighting, isometric camera + parallax, loader, status line

## Tuning knobs

- Activity length: `activityDuration` in `musashi.js` (seconds)
- Traveler frequency: `nextSpawnAt` in `travelers.js` (20–45 s gap)
- Bubble linger: `bubbleTimer` in `travelers.js` (14 s)
- Petal/leaf/snow density: `Weather` max count in `weather.js` (110 normal; 30 under reduced motion)
- Zoom: `FRUSTUM` in `main.js` (smaller = closer)

## v2 — a living day, a living year

Musashi's hill now runs on two slow clocks instead of one fixed golden hour:

- **Day/night** (`src/cycle.js`) — a full day takes 6 minutes real time
  (`DAY_LENGTH` = 360 s), sweeping through dawn → day → dusk (the original
  v1 golden hour, and the default landing state) → night, with stars, a
  glowing stone lantern, and firefly-lit summer nights after dark.
- **Seasons** (`src/weather.js`, `src/world.js`) — a full year (all four
  seasons) takes 12 minutes (`DAYS_PER_SEASON` = 2 days/season), cross-fading
  terrain and sakura-tree palettes and swapping the falling-particle system:
  spring petals (with occasional rain bursts), summer (fireflies after dark,
  no fall particles), autumn leaves and drifting mist, winter snow (with the
  river/waterfall freezing over).

Musashi now practices **10 activities** (up from 4): zazen, kata, reading,
painting, tea, raking, temple (bowing), misogi (standing under the falls),
carving, and watching from the bridge — each at its own spot around the
island, with a proper walk (not a cut) between them. Night biases him toward
the quiet indoor-feeling activities (zazen, tea, reading); winter skips the
cold-water misogi.

New landmarks (`src/landmarks.js`): a small temple, a stone lantern that
lights at night, a raked zen garden, and a river/bridge/waterfall.

**Two pages**: `/` is the original framed island diorama; `/expanse.html` is
the same world rendered as a full-viewport terrain with no island edge. A
small `expanse ↗` / `island ↗` link (bottom-right) toggles between them.

**Dev scrub params** (query string, either page) let you jump straight to a
scene instead of waiting for the clock:

| param | example | effect |
|---|---|---|
| `time` | `?time=0.8` | day position 0..1 (dawn 0, day 0.25, dusk 0.55 default, night 0.8) |
| `season` | `?season=winter` (or `0-3`) | starting season |
| `speed` | `?speed=0` | clock rate multiplier; 0 freezes it (great for screenshots), 60 fast-forwards a season in ~12 s |
| `activity` | `?activity=carving` | starting activity (one of the 10 above) |
| `duration` | `?duration=15` | seconds before the next walk (default 75) |

See `.claude/skills/verify/SKILL.md` for the full verification recipe.
