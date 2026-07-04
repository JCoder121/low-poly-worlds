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

- `src/world.js` — island terrain, sakura tree, petals, fire, path, torii
- `src/musashi.js` — the figure, his four activities, the state machine
- `src/travelers.js` — spawner, walking figures, speech-bubble links
- `src/links.js` — the travelers' library (~100 Wikipedia links, shuffled deck)
- `src/main.js` — renderer, golden-hour light, isometric camera + parallax, loader, status line

## Tuning knobs

- Activity length: `activityDuration` in `musashi.js` (seconds)
- Traveler frequency: `nextSpawnAt` in `travelers.js` (20–45 s gap)
- Bubble linger: `bubbleTimer` in `travelers.js` (8 s)
- Petal density: `Petals` count in `world.js` (90; 30 under reduced motion)
- Zoom: `FRUSTUM` in `main.js` (smaller = closer)
