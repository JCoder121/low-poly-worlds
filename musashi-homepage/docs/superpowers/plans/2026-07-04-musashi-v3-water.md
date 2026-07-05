# Musashi v3 — The Water Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the river/pool/waterfall the page's standout artifact — higher-res faceted water with sky-mirror tinting, shoreline foam, drifting streaks, ripple rings, layered waterfall ribbons, koi, night sparkles, and summer dragonflies.

**Architecture:** Extract all water from `landmarks.js` into a new `src/water.js` (parity refactor first, visuals second). CPU-animated non-indexed geometry (flat-shaded facets), per-vertex color banding, material-level sky-mirror tint from `ws.lighting.bg`. No shaders, no textures.

**Tech Stack:** Vite + Three.js, plain MeshStandardMaterial/MeshBasicMaterial. NO test suite — **verification is runtime observation** via the dev server + scrub params (`?time= ?season= ?speed=`), per the project verify skill (`.claude/skills/verify/SKILL.md`).

## Global Constraints

- Flat-shaded polygonal look throughout — non-indexed geometry so `computeVertexNormals()` yields facets; no smooth shading, no textures, no ShaderMaterial.
- Motion character: **flowing but calm** — swell amplitude ≈ 0.02, streaks drift at the current's pace, nothing frantic.
- **Sky-mirror:** water base hue lerps 55% toward `ws.lighting.bg` every frame; banding rides on top via vertex colors. Winter `frozen` overrides toward ICE `0xd8e4ea` (existing cross-fade math, verbatim: `frozen = ws.season === "winter" ? 1 - ws.seasonBlend : ws.nextSeason === "winter" ? ws.seasonBlend : 0`).
- Winter: ALL water motion stops; streaks/rings/sparkles/koi/dragonflies hidden; falls static and pale.
- Reduced motion (`prefers-reduced-motion`): no vertex animation, no streaks/rings/dragonflies; koi at 0.15× speed; sparkles static.
- Both pages: island and expanse (basin fall variant) get everything.
- `water.js` consumes ONLY `ws.night`, `ws.season`, `ws.seasonBlend`, `ws.nextSeason`, `ws.lighting.bg`.
- Zero per-frame allocations in update paths (reuse scratch Vector3/Color; the codebase is disciplined about this — match it).
- Palette: WATER `0xa9cbd4`, ICE `0xd8e4ea`, FOAM `0xdcecf0`, foam-white `0xfdfaf2`, koi orange `0xd96f38`, dragonfly `0x4e7d8a`; banding = vertex-color multipliers, center `0.80`, mid `1.0`, edge `1.18`.
- Dev server: `npm run dev -- --port 5199` (usually already running). Screenshot verification after every task; commit after every task. Work on branch `v3`.

---

### Task 0: Branch

- [ ] `cd ~/Documents/claude_playground/musashi-homepage && git checkout -b v3`

---

### Task 1: Extract `water.js` (parity refactor)

**Files:**
- Create: `src/water.js`
- Modify: `src/landmarks.js` (remove all water; keep temple/lantern/garden/bridge + their spots)
- Modify: `src/main.js` (wire buildWater; merge spots)

**Interfaces:**
- Produces: `buildWater(island, mode = "island") → { spots: { misogi: {position, facing} }, update(dt, t, ws) }`. Also exports `RIVER_CURVE` points are internal — but exports `const WATER = 0xa9cbd4, ICE = 0xd8e4ea, FOAM = 0xdcecf0` for later tasks.
- `buildLandmarks(island, mode)` now returns `{ spots: { garden, temple, bridge }, update(dt, t, ws) }` (update = lantern only).
- main.js: `const water = buildWater(world.island, mode);` after buildLandmarks; Musashi spot map becomes `{ fire, tree, easel, kata, ...landmarks.spots, ...water.spots }`; loop adds `water.update(dt, t, ws);`.

- [ ] **Step 1: Create `src/water.js`** by MOVING from `landmarks.js` verbatim (this is a refactor — zero visual change): the `riverRibbon` function, the river curve (`riverCurve` CatmullRom points (-6.6,0,-3.4) (-5.2,0,-0.9) (-4.2,0,2.6) (-3.9,0,4.1)), river + banks meshes, step/cascade/pool, the whole mode-branched waterfall block (`fallOrigin/fallDelta/CHUNK_TOP/CHUNK_BOTTOM/mistBaseY/fall`, incl. the CAM_FORWARD comment block and expanse basin), chunks + chunkState, mists, the misogi spot, and the water part of `update` (frozen computation, waterMats lerp, cascade/fall opacity, chunks loop, mists loop). Module header comment: `// The water: river, pool, waterfall — the diorama's standout artifact.` Keep `WATER/ICE/FOAM` consts here and export them.
- [ ] **Step 2: Slim `landmarks.js`**: delete everything moved; its `update` keeps only the lantern block; its `spots` keeps garden/temple/bridge (misogi moves out). Remove now-unused consts (WATER/ICE/FOAM stay only in water.js; keep SAND_LIGHT/ROOF/PLASTER).
- [ ] **Step 3: Wire `src/main.js`**: `import { buildWater } from "./water.js";` → `const water = buildWater(world.island, mode);` immediately after `buildLandmarks`; extend the Musashi spot map with `...water.spots`; add `water.update(dt, t, ws);` next to `landmarks.update(dt, t, ws);`.
- [ ] **Step 4: Verify parity at runtime.** Screenshots: default `/`, `/?season=winter&speed=0` (freeze still works), `/expanse.html` (basin variant intact), `/?time=0.8&speed=0` (nothing regressed). Each must be indistinguishable from pre-refactor. `?activity=misogi&speed=0` — Musashi still walks to the pool. Console clean.
- [ ] **Step 5: Commit** — `git commit -am "refactor: extract water into water.js (parity, no visual change)"` (+ standard trailers).

---

### Task 2: High-res river surface — lanes, swell, banding, sky-mirror

**Files:**
- Modify: `src/water.js` (replace `riverRibbon` for the water surface; banks keep the old low-res builder renamed `bankRibbon`)

**Interfaces:**
- Produces (internal to water.js, used by Tasks 3-6): `buildLanedRibbon(curve, width, segments, lanes)` returning `{ mesh, base: Float32Array, frames: {points[], normals[]} }`; a module-scope `mirror(colorOut, frozen, ws)` helper; `this`-less closure state pattern matching the existing code style.

- [ ] **Step 1: Laned ribbon builder.** Replace the river surface construction with:

```js
// laned, non-indexed ribbon: `lanes` strips across the width so vertex colors
// can band the water and per-vertex swell can ripple it. Flat-shaded facets.
function buildLanedRibbon(curve, width, segments, lanes) {
  const pt = new THREE.Vector3(), tangent = new THREE.Vector3(), normal = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const cols = []; // [segments+1][lanes+1] world positions
  const frames = { points: [], normals: [] };
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    curve.getPoint(u, pt);
    curve.getTangent(u, tangent);
    normal.crossVectors(up, tangent).normalize();
    frames.points.push(pt.clone());
    frames.normals.push(normal.clone());
    const w = width / 2 + Math.sin(u * 17) * 0.04;
    const row = [];
    for (let l = 0; l <= lanes; l++) {
      const k = l / lanes - 0.5; // -0.5..0.5 across
      row.push([pt.x + normal.x * w * 2 * k, 0, pt.z + normal.z * w * 2 * k, k]);
    }
    cols.push(row);
  }
  // banding by |k|: center dark, edges pale
  const shade = (k) => { const a = Math.abs(k) * 2; return a < 0.45 ? 0.80 : a < 0.8 ? 1.0 : 1.18; };
  const positions = [], colors = [];
  const pushV = ([x, y, z, k]) => { positions.push(x, y, z); const s = shade(k); colors.push(s, s, s); };
  for (let i = 0; i < segments; i++) {
    for (let l = 0; l < lanes; l++) {
      const a = cols[i][l], b = cols[i][l + 1], c = cols[i + 1][l], d = cols[i + 1][l + 1];
      pushV(a); pushV(b); pushV(c); pushV(b); pushV(d); pushV(c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat(WATER, { roughness: 0.5, vertexColors: true }));
  return { mesh, base: new Float32Array(positions), frames };
}
```

River: `buildLanedRibbon(riverCurve, 0.55, 160, 4)`, mesh at y 0.035, receiveShadow. Banks: keep the OLD single-lane `riverRibbon` (rename `bankRibbon`) at width 0.8, mossDark, y 0.028 — banks don't animate.

- [ ] **Step 2: Swell animation.** In `update`, when `!reducedMotion && frozen < 1`:

```js
// two-octave traveling swell; flat shading turns each displaced facet into a glint
const pos = riverSurf.mesh.geometry.attributes.position;
const arr = pos.array, base = riverSurf.base;
const speed = 1 - frozen; // glides to stillness across the freeze window
for (let v = 0; v < arr.length; v += 3) {
  const bx = base[v], bz = base[v + 2];
  arr[v + 1] = base[v + 1]
    + AMP * speed * (Math.sin(bx * 5.1 + bz * 3.7 + t2 * 1.3) + 0.5 * Math.sin(bx * 9.3 - bz * 6.1 + t2 * 2.2));
}
pos.needsUpdate = true;
riverSurf.mesh.geometry.computeVertexNormals();
```

with `const AMP = 0.02;`. reducedMotion: run this ONCE at build time with `t2 = 1.7` fixed, so the surface is faceted but static.

- [ ] **Step 3: Sky-mirror tint.** Module scratch colors `const _mirror = new THREE.Color(), _base = new THREE.Color(WATER), _ice = new THREE.Color(ICE);` In `update`:

```js
_mirror.copy(_base).lerp(ws.lighting.bg, 0.55).lerp(_ice, frozen);
riverSurf.mesh.material.color.copy(_mirror);
poolMat.color.copy(_mirror);
```

(This REPLACES the old `waterMats` lerpColors line.) Pool disc also upgrades: `CylinderGeometry(0.85, 0.78, 0.06, 24, 3)` → `.toNonIndexed()`, vertex-color band via the same `shade` idea radially (center 0.80, rim 1.18), position `(-3.9, 0.03, 4.15)`; verify visually it doesn't overhang the cliff edge — nudge center up to ±0.15 if needed and note it. Misogi spot stays `(-3.9, 0, 3.95)` — confirm Musashi stands at the pool's cascade edge, adjust z ±0.15 if the wider pool swallows him.

- [ ] **Step 4: Verify at runtime.** `?speed=0` screenshots: default dusk (water warm gold-tinted, banding visible, facets shimmering across two screenshots 3 s apart), `?time=0.0` (rose water), `?time=0.25` (pale day water), `?time=0.8` (ink-dark water), `?season=winter&speed=0` (ice color, surface STILL — two screenshots identical), expanse page dusk. Console clean.
- [ ] **Step 5: Commit** — `git commit -am "feat(water): laned faceted river + widened pool, traveling swell, sky-mirror tint"`.

---

### Task 3: River foam — bank lines + drifting streaks

**Files:**
- Modify: `src/water.js`

**Interfaces:**
- Consumes: `riverSurf.frames` (curve points/normals from Task 2) for positioning.

- [ ] **Step 1: Bank foam lines.** Two thin white ribbons hugging the water edges: reuse `buildLanedRibbon(riverCurve, 0.55, 160, 1)` twice is wasteful — instead build one `foamEdges` non-indexed strip per side directly from `frames`: for each segment i, two triangles forming a strip centered at `point ± normal * (w(u) - 0.02)` with strip width 0.035, y 0.045. Material `new THREE.MeshBasicMaterial({ color: 0xfdfaf2, transparent: true, opacity: 0.5, depthWrite: false })` shared by both sides. In `update`: `foamMat.opacity = (0.4 + Math.sin(t2 * 0.9) * 0.12) * (1 - frozen)` (frozen hides foam).
- [ ] **Step 2: Foam streaks.** InstancedMesh, 10 × `BoxGeometry(0.14, 0.008, 0.03)`, same foam material color (own material, opacity 0.65). State per streak: `{ u: rand, lane: (rand-0.5)*0.6, speed: 0.018+rand*0.01, life offset }`. Per frame (skip when frozen ≥ 0.5 or reducedMotion → `streaks.visible = false`):

```js
s.u += s.speed * dt; if (s.u > 0.98) s.u -= 0.96;
const idx = Math.min(FRAME_N - 1, Math.floor(s.u * FRAME_N));
const p = frames.points[idx], n = frames.normals[idx];
dummy.position.set(p.x + n.x * s.lane * 0.5, 0.05, p.z + n.z * s.lane * 0.5);
dummy.rotation.y = Math.atan2(frames.points[idx+1>=FRAME_N?idx:idx+1].x - p.x, frames.points[idx+1>=FRAME_N?idx:idx+1].z - p.z);
const pulse = 0.6 + 0.4 * Math.sin(t2 * 1.7 + i * 2.4);
dummy.scale.set(pulse, 1, pulse);
```

`setMatrixAt` + one `needsUpdate` after the loop.
- [ ] **Step 3: Verify.** `?speed=0` dusk: white edge lines visible along both banks, streaks drifting downstream between two screenshots 4 s apart (positions differ). `?season=winter&speed=0`: no foam lines, no streaks. Night `?time=0.8`: foam reads as pale threads on dark water (screenshot). Console clean.
- [ ] **Step 4: Commit** — `git commit -am "feat(water): bank foam lines + drifting current streaks"`.

---

### Task 4: Pool life — ripple rings + koi

**Files:**
- Modify: `src/water.js`

- [ ] **Step 1: Ripple rings.** 3 flat rings cycling from the cascade impact point `(-3.9, 0.045, 3.85)`: `new THREE.RingGeometry(0.9, 1.0, 20)` rotated flat (`rotation.x = -Math.PI/2`), MeshBasicMaterial white, transparent, depthWrite false. Per ring i, phase `((t2 * 0.45 + i / 3) % 1)`: `scale.setScalar(0.12 + phase * 0.55); material.opacity = 0.38 * (1 - phase) * (1 - frozen)`. reducedMotion or frozen ≥ 1 → all invisible.
- [ ] **Step 2: Koi.** Builder:

```js
function koi(bodyColor, patchColor) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 4), mat(bodyColor));
  body.rotation.x = Math.PI / 2; // nose forward along +z
  body.scale.y = 0.45; // flattened for the top-down view
  const patch = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4, 3), mat(patchColor));
  patch.position.set(0.012, 0.02, 0.02);
  patch.scale.y = 0.4;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 3), mat(bodyColor));
  tail.rotation.x = -Math.PI / 2;
  tail.position.z = -0.1;
  g.add(body, patch, tail);
  g.userData.tail = tail;
  return g;
}
```

Two: `koi(0xd96f38, 0xfdfaf2)` and `koi(0xfdfaf2, 0xd96f38)`. State: `{ angle, radius: 0.32/0.45, speed: 0.5/0.38, pauseTimer }`. Per frame (hidden when `frozen >= 0.5`):

```js
k.pauseTimer -= dt;
const moving = k.pauseTimer < 0 || k.pauseTimer > 1.5; // pause = 1.5s window every ~8-14s
if (k.pauseTimer < -8 - i * 6) k.pauseTimer = 1.5 + Math.random() * 0; // deterministic-ish restart ok
const sp = k.speed * (moving ? 1 : 0.05) * (reducedMotion ? 0.15 : 1);
k.angle += sp * dt;
g.position.set(POOL.x + Math.cos(k.angle) * k.radius, 0.075, POOL.z + Math.sin(k.angle) * k.radius);
g.rotation.y = -k.angle; // tangent to the circle
g.userData.tail.rotation.y = Math.sin(t2 * 6) * 0.5; // tail sway
```

(Use `POOL = new THREE.Vector3(-3.9, 0, 4.15)` matching Task 2's pool center; if Task 2 nudged it, read the actual pool mesh position.) Koi y = 0.075, just above the pool surface (0.06), flattened so it reads as at-the-surface from the iso camera.
- [ ] **Step 3: Verify.** `?speed=0` dusk closeup screenshots ×2 (4 s apart): rings expanding (different phases), both koi visible and at different positions; koi stay inside the pool rim; `?activity=misogi&speed=0` — Musashi + koi + rings coexist without overlap weirdness (nudge koi radii if he stands on one). `?season=winter&speed=0`: no rings, no koi. Console clean.
- [ ] **Step 4: Commit** — `git commit -am "feat(water): pool ripple rings + two circling koi"`.

---

### Task 5: Waterfall — layered ribbons, lip fringe, splash ring

**Files:**
- Modify: `src/water.js` (both mode branches)

- [ ] **Step 1: Ribbon columns.** Replace the single `fall` box (BOTH modes) with 3 vertical laned strips: for ribbon r in 0..2, `buildVerticalStrip(width, height, rows)` — non-indexed plane strip `width 0.16 + r*0.04`, `rows = mode === "expanse" ? 6 : 16`, positioned at `fallPos.x + (r-1)*0.16`, z jitter `(r%2)*0.05`, `MeshBasicMaterial({ color: FOAM, transparent: true, opacity: 0.55 + r*0.12, depthWrite: false, side: THREE.DoubleSide })`, vertex colors optional (skip — Basic + opacity variation is enough). Store `{ mesh, base }` like the river. Per frame (when `frozen < 1 && !reducedMotion`): `arr[v] = base[v] + Math.sin(base[v+1] * 6 + t2 * 4 + r) * 0.025` (x wiggle scrolling downward via the y-phase), `pos.needsUpdate = true` (no normal recompute — Basic material). Frozen: static + `opacity *= (1 - frozen * 0.55)` as before.
- [ ] **Step 2: Lip fringe + splash ring.** Lip: a zigzag strip of 8 small triangles (non-indexed, white 0xfdfaf2, opacity 0.8) along the fall's top edge (island: at the cliff lip `fallPos.y + 2.3`; expanse: basin rim `y 0.1`), width matching the fall (~0.55). Static geometry; opacity `0.8 * (1 - frozen)`. Splash ring: same RingGeometry recipe as Task 4's ripples but single ring at the fall's base (island `y ≈ fallPos.y - 2.2` on the mist plane; expanse: basin water level `y -0.15`), cycle 1.6 s, `scale 0.2 → 0.9`, `opacity 0.45 * (1-phase) * (1 - frozen)`, hidden under reducedMotion.
- [ ] **Step 3: Cascade mini-ribbons.** Replace the cascade box with 2 mini vertical strips (width 0.2, height 0.44, rows 4) at the step face, same animation at half amplitude. Retint chunks material `0xffffff` → keep white but drop opacity to 0.7 (they now sit over ribbons).
- [ ] **Step 4: Verify.** Island `?speed=0`: fall reads as layered living columns (two screenshots differ), fringe at lip, splash ring pulsing at base above the mist. Expanse: basin fall + ring + fringe. Winter both pages: static pale columns, no ring. Night: fall visibly pale against dark cliff. Console clean.
- [ ] **Step 5: Commit** — `git commit -am "feat(water): layered waterfall ribbons, lip fringe, splash rings, cascade upgrade"`.

---

### Task 6: Night sparkles + summer dragonflies

**Files:**
- Modify: `src/water.js`

- [ ] **Step 1: Sparkles.** `THREE.Points`, 22 positions sampled on the water: 16 along the river via `frames.points[randIdx] ± normal * rand*0.2` at y 0.06, 6 in the pool disc at y 0.08. `PointsMaterial({ color: 0xfdfaf2, size: 2.5, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false, fog: false })`. Per frame: `mat.opacity = ws.night * (0.35 + 0.35 * Math.sin(t2 * 2.3)) * (1 - frozen)`; drift: rotate the Points group's position phase subtly `points.position.x = Math.sin(t2 * 0.15) * 0.05` (cheap, no per-vertex work); reducedMotion → static `ws.night * 0.5` opacity, no drift.
- [ ] **Step 2: Dragonflies.** Builder: body `CylinderGeometry(0.008, 0.012, 0.14, 4)` rotated horizontal, color 0x4e7d8a; 2 wing pairs: 4 × `PlaneGeometry(0.09, 0.025)` MeshBasic 0xfdfaf2 opacity 0.45 double-sided, attached at ±60°. Two dragonflies with state `{ u: 0.3/0.55, dir, hoverT }`; visible only when `ws.season === "summer" && ws.night < 0.3 && !reducedMotion` — fade via a 1s opacity ramp on all its materials rather than popping (track `vis` 0..1, `vis += (target - vis) * dt`). Flight: follow `frames.points[u]` at `y 0.28 + Math.sin(t2 * 3) * 0.04`, u oscillates in [0.25, 0.65] (`u += dir * 0.012 * dt-ish`, reverse at bounds), hover: every ~6 s hold u for 1.2 s. Wing flutter: `wing.rotation.x = Math.sin(t2 * 40 + side) * 0.5` (fast flutter reads as shimmer at 60fps).
- [ ] **Step 3: Verify.** `?time=0.8&speed=0`: sparkle glints on river+pool (screenshot; compare with `?time=0.55` — none). `?season=summer&speed=0` (dusk = night<0.3 false? dusk starOpacity=0 → night=0 ✓ visible): two dragonflies over the river, wings shimmering between frames; `?season=summer&time=0.8`: gone; `?season=spring`: gone; winter: everything hidden. Both pages spot-check. Console clean.
- [ ] **Step 4: Commit** — `git commit -am "feat(water): night sparkle glints + summer dragonflies"`.

---

### Task 7: Final sweep + docs

**Files:**
- Modify: `.claude/skills/verify/SKILL.md`, `README.md`

- [ ] **Step 1: Sweep** (both pages): dawn/dusk/night × spring/summer/winter screenshot matrix focused on the water; motion sanity (two-frame diffs for swell/streaks/rings/koi/fall); `?speed=60` across an autumn→winter boundary — water glides to ice, all life fades without popping; reduced-motion code-path listing; default-load first impression intact (golden hour, spring, zazen); `npm run build` exit 0 + preview smoke both pages; console clean throughout.
- [ ] **Step 2: Docs.** SKILL.md: add a "v3 water" section — what to look for per time/season, koi/sparkle/dragonfly gating conditions, the frozen-stillness check. README: v3 paragraph + water anatomy line (water.js).
- [ ] **Step 3: Commit** — `git commit -am "docs: v3 water verify recipe + README"`. Merge decision via finishing-a-development-branch.
