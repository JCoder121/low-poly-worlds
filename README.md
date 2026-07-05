# musashi's hill · 武蔵の丘

Personal homepage as a living low-poly diorama. Musashi cycles through his day
(zazen by the fire → sword kata → reading → painting) under a cherry tree while
travelers pass on the road offering world-history Wikipedia links in speech bubbles.
Since v4 the full-viewport **expanse** is the landing page; the framed island
diorama lives at `/island.html`.

Design brief: `../design/musashi-homepage-brief.md`

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/
```

## Anatomy

- `src/world.js` — island/expanse terrain, sakura tree, fire, road (rim-trimmed, torii astride it), season tints, wind sway
- `src/musashi.js` — the figure, his eleven activities, the walk/settle state machine, obstacle-aware pathing
- `src/travelers.js` — weighted-cast spawner, walking figures, speech-bubble links
- `src/links.js` — the travelers' library (141 Wikipedia links, shuffled deck)
- `src/cycle.js` — the day/night + season clock (`ws` state read by everything else); random or real-time start
- `src/weather.js` — seasonal falling particles (petals/leaves/snow), rain, fireflies, mist
- `src/landmarks.js` — temple, lantern, zen garden, bridge, winter snow caps
- `src/water.js` — the river and koi pond: laned faceted surface with per-vertex banding, sky-mirror tint, bank foam, koi
- `src/cat.js` — the napping cat and its little life
- `src/wind.js` — the gust clock (drives tree sway, particle drift, the sound bed)
- `src/sound.js` — synthesized ambience: brook, wind, bell, and Musashi's shinobue
- `src/main.js` — renderer, lighting, isometric camera + parallax, loader, wordmark, toggles, the frame loop

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

**Two pages**: the framed island diorama and the same world rendered as a
full-viewport terrain with no island edge. A small `expanse ↗` / `island ↗`
link (bottom-right) toggles between them. (v2 landed on the island; since v4
the expanse is `/` and the island is `/island.html`.)

**Dev scrub params** (query string, either page) let you jump straight to a
scene instead of waiting for the clock:

| param | example | effect |
|---|---|---|
| `time` | `?time=0.8` | day position 0..1 (dawn 0, day 0.25, dusk 0.55, night 0.8) — default is random per load since v5 |
| `season` | `?season=winter` (or `0-3`) | starting season — default is random per load since v5 |
| `speed` | `?speed=0` | clock rate multiplier; 0 freezes it (great for screenshots), 60 fast-forwards a season in ~12 s |
| `activity` | `?activity=flute` | starting activity (one of the 11) |
| `duration` | `?duration=15` | seconds before the next walk (default 75) |
| `real` | `?real=1` | live mode: the clock follows your actual local time and month (also the bottom-left `live ↗` toggle) |

See `.claude/skills/verify/SKILL.md` for the full verification recipe.

## v3 — the water

The river/pool/waterfall, once a simple low-poly ribbon, is now the page's
standout artifact (`src/water.js`, extracted whole from `landmarks.js`). The
surface is a laned, non-indexed, flat-shaded ribbon — four lanes across the
river's width, each vertex banded (dark center, pale edges) and rippled by a
two-octave traveling swell, so every facet catches the light a little
differently as it flows. The whole surface acts as a **sky-mirror**: its base
color lerps toward the current lighting tint every frame, so the water reads
rose at dawn, gold at dusk, ink-dark at night, and drains to a flat ice
palette across the winter freeze.

Around that surface: bank foam lines and ten drifting current streaks trace
the river's flow; a widened pool holds three cycling ripple rings and two
koi circling at the cascade's foot; the waterfall itself is three layered,
gently wiggling ribbons with a lip fringe and splash ring, plus a
two-strip cascade at the step. After dark, 22 sparkle glints wink across the
water's surface; on summer days, two dragonflies drift and hover over the
river, fading in and out rather than popping. Winter freezes all of it at
once — motion stops, the wildlife hides, and the palette goes pale and still.

See the "v4 water" section in `.claude/skills/verify/SKILL.md` for the full
per-season/per-time-of-day verification recipe.

## v4 — the quiet cut

- **Expanse is the landing page** (`/`); the framed island moved to
  `/island.html`. The island itself is now a **single slab** (one moss top +
  cliff side) instead of the old three-tier cake.
- **The water calmed down.** The big cliff waterfall, its expanse basin, the
  night sparkle glints, and the summer dragonflies are gone. The river now
  tapers in from the NW landscape (no hard entry edge), runs under the bridge,
  and flows straight into a **larger koi pond/lake** at grade — ripple rings
  mark the inflow. Same rig on both pages; nothing pours off the island edge
  anymore. Misogi now means standing in the pond shallows facing the inflow.
- **No narration.** The `#status` pill and all activity/traveler lines were
  removed; travelers still offer their Wikipedia speech bubbles.
- **Wordmark**: just `musashi's hill` plus a live season line (updates as the
  year turns). Name and kanji left the top-left corner (the loader splash
  keeps its 武蔵の丘 mon).
- **Travelers walk at a uniform pace.** Stepping is arc-length based
  (`getPointAt`, world-units/sec) instead of curve-param based, which used to
  race through the expanse road's long off-screen end segments and snap to
  normal speed mid-frame. Bubbles trigger by world position (`|x| < 1.6`).
- **Landmark polish**: the temple went vermillion, grew a third roof tier and
  taller pillars (Kyoto vibes); the bridge deck is ~20% wider; the sakura is
  18% bigger; the zen garden's sand is a jittered, subdivided surface with 10
  finer ridges and concentric raked arcs around its largest rock.

## v5 — the long river and the floating island

- **The river winds.** *(reverted in v6 — the meander fought the calm)* It
  briefly S-curved with the bridge at mid-arc; v6 restored the straight
  course, extended to a pond placed lower in the frame.
- **The island floats.** Three tiers again — but strictly tapering downward
  (7.6 → 6.5 → 5.0) like an island adrift in the sky, not the old wide-waisted
  cake. The road now ends exactly at the generated cliff edge: the top tier's
  blob outline is captured and a bearing→radius interpolator trims the road
  curve's endpoints to it (no more bleed-over on unlucky loads).
- **Every load is a different moment.** Fresh visits open at a random season
  and random time of day (`?time=`/`?season=` still pin them for testing);
  the weather system seeds from the cycle's pick instead of re-parsing the URL.
- **A richer road.** Travelers scaled to stand beside Musashi (1.3×), drawn
  from a weighted cast: monk/farmer/merchant/ronin joined by pilgrim,
  fisherman, and noblewoman — plus a samurai (4%), a two-tailed white fox
  spirit (5%), and the shogun himself (1%). The link deck grew to 141.
- **Musashi refined.** His walks route around the fire pit (waypoint keepout +
  curve resampling); his kata is a deliberate 8-second form — chudan, rise to
  jodan, a poised stillness, the cut with a hip pivot, follow-through, return —
  swung with a properly curved three-segment blade and both hands on the grip.
  The bridge deck widened again (1.35) with his watching spot offset from the
  road line, so travelers pass behind him without colliding.

## v6 — wind, a cat, the real sky

- **The river straightened back out** (the v5 meander fought the calm) and
  runs its old course, extended to the koi pond now sitting lower in the
  frame at (-2.2, 5.9). The island grew to fit (tiers 8.1/7.0/5.4).
- **The road belongs to the island.** Its ends are trimmed flush to the
  generated cliff edge — the final ribbon edge conforms to the rim's arc —
  and the torii is placed programmatically astride the road's west end, so
  travelers always pass through the gate.
- **Wind** (`src/wind.js`): a gust every 18–50s — pines lean, the sakura
  stirs, petals and snow stream sideways, fireflies scatter. A breath, not a
  storm; still under reduced motion.
- **A cat** (`src/cat.js`): paper-white with an ember patch, naps at one of
  four spots (temple steps, beneath the sakura, the zen garden, the river
  bank), breathes, flicks an ear, occasionally lifts its head toward the
  road, and every few minutes pads to a new spot (detouring around the
  fire). Fully asleep at night.
- **Live mode**: the `live ↗` toggle (bottom-left) locks the diorama to the
  visitor's real clock — season from the month, hour mapped through
  dawn/noon/dusk/night anchors. `?real=1` forces it; `?time=`/`?season=`
  still win for testing. Persisted in localStorage.
- **Ambience** (`src/sound.js`): a `sound ↗` toggle, off by default — a
  synthesized brook (band-passed noise), a wind bed that swells with the
  gusts, and a soft pentatonic bell every minute or two. No audio assets.
- **Snow accumulates**: as winter deepens, white caps grow on the temple's
  roof tiers, the stone lantern, the bridge rails, and the torii's kasagi.

## v7 — the flute, and manners

- **Musashi plays the flute** — an 11th activity: seated on a rock at the
  pond's south-east shore (also in his night rotation). When the ambience is
  on, a soft synthesized shinobue drifts in while he plays.
- **He minds his surroundings now.** Walk paths route around a keep-out list
  (fire, pond, zen garden, temple, sakura trunk) and never wade the river
  corridor; mid-walk he sidesteps a passing traveler and rejoins his path.
  Misogi moved to the water's edge (gassho facing the pond) instead of
  standing in it, and the relocated zen garden means praying at the temple
  no longer happens on raked sand.
- **The bridge sits square** — deck axis re-derived from the road's tangent
  at the crossing — and travelers arc over its crown instead of clipping
  through the planks.
- **Odds and ends**: expanse road runs past the browser borders (±30); the
  torii grew 1.3× for the taller travelers; the cat grew 33%; sakura fall
  spread tightened ~14%; the second back hill and a half-buried pine were
  removed; the torii's winter cap no longer peeks out in spring.
