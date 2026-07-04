// The water: river under the bridge, a stone weir with a small cascade, into a
// sunken koi pond/lake — the diorama's standout, still-high-poly artifact.
import * as THREE from "three";
import { COLORS, mat } from "./world.js";

export const WATER = 0x93bfd0;
export const ICE = 0xd8e4ea;
export const FOAM = 0xdcecf0;
export const FOAM_LINE = 0xfdfaf2;

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// module-scope scratch: zero per-frame allocations
const _mirror = new THREE.Color(), _base = new THREE.Color(WATER), _ice = new THREE.Color(ICE);
const _bankBase = new THREE.Color(COLORS.mossDark), _bankSnow = new THREE.Color(0xe9e7dd);
const AMP = 0.03;

// sky-mirror tint: WATER lerped toward the sky/fog colour, then toward ICE as
// the river freezes. Scene lighting on MeshStandard already carries most of
// the day/night darkening, so the lerp stays weak (a hue shift, not a wash)
// and the result is pulled slightly dark so water never assimilates into the
// warm terrain at dusk. Writes into `out` — no allocation.
function mirror(out, frozen, ws) {
  out.copy(_base).lerp(ws.lighting.bg, 0.30).multiplyScalar(0.90).lerp(_ice, frozen);
}

// banding by |k|: centre lane dark, edges pale. Contrast is pushed hard because
// the mirror tint washes the water pale — a gentle spread reads as flat.
const shade = (a) => (a < 0.45 ? 0.62 : a < 0.8 ? 0.90 : 1.22);

// single source of the river's half-width: the wobble term shared by the laned
// ribbon, the dark banks, and the foam edges, times an entry taper that pinches
// the ribbon to a point at its source so the river emerges from the NW
// landscape instead of starting on a hard edge.
function riverHalfWidth(width, u) {
  return (width / 2 + Math.sin(u * 17) * 0.04) * Math.min(1, u / 0.12);
}

// old low-res single-lane ribbon — used only for the dark banks now (not animated)
function bankRibbon(curve, width) {
  const samples = 48;
  const positions = [];
  const pt = new THREE.Vector3(), tangent = new THREE.Vector3(), normal = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const edge = [];
  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    curve.getPoint(u, pt);
    curve.getTangent(u, tangent);
    normal.crossVectors(up, tangent).normalize();
    const w = riverHalfWidth(width, u);
    edge.push([pt.x + normal.x * w, pt.z + normal.z * w, pt.x - normal.x * w, pt.z - normal.z * w]);
  }
  for (let i = 0; i < samples; i++) {
    const [ax, az, bx, bz] = edge[i];
    const [cx, cz, dx, dz] = edge[i + 1];
    positions.push(ax, 0, az, bx, 0, bz, cx, 0, cz, bx, 0, bz, dx, 0, dz, cx, 0, cz);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat(WATER, { roughness: 0.55 }));
}

// laned, non-indexed ribbon: `lanes` strips across the width so vertex colors
// can band the water and per-vertex swell can ripple it. Flat-shaded facets.
// Returns { mesh, base, frames } — the streaks consume `frames`.
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
    const w = riverHalfWidth(width, u);
    // sink the head into the ground so the source dips below the terrain rather
    // than sitting on it; baked into the BASE y (swell writes base[v+1]+wave, so
    // this survives animation).
    const yBase = u < 0.08 ? -0.08 * (1 - u / 0.08) : 0;
    const row = [];
    for (let l = 0; l <= lanes; l++) {
      const k = l / lanes - 0.5; // -0.5..0.5 across
      row.push([pt.x + normal.x * w * 2 * k, yBase, pt.z + normal.z * w * 2 * k, k]);
    }
    cols.push(row);
  }
  const positions = [], colors = [];
  const pushV = ([x, y, z, k]) => { positions.push(x, y, z); const s = shade(Math.abs(k) * 2); colors.push(s, s, s); };
  for (let i = 0; i < segments; i++) {
    for (let l = 0; l < lanes; l++) {
      const a = cols[i][l], b = cols[i][l + 1], c = cols[i + 1][l], d = cols[i + 1][l + 1];
      // wound so face normals point +y (lane order runs -k → +k; the plan's
      // (a,b,c)(b,d,c) order pointed them down and the river backface-culled)
      pushV(a); pushV(c); pushV(b); pushV(b); pushV(c); pushV(d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat(WATER, { roughness: 0.5, vertexColors: true }));
  return { mesh, base: new Float32Array(positions), frames };
}

// foam sits above the swell's peak (river mesh y 0.035 + AMP 0.03 = 0.065 max)
// so it never z-fights/stitches into the animated water surface.
const FOAM_Y = 0.08;
const FOAM_STRIP_W = 0.035;

// bank foam: two thin strips hugging both edges of the river, built straight
// from the ribbon's saved curve frames — no fresh curve sampling needed.
// MeshBasicMaterial + DoubleSide sidesteps the winding trap (thin unlit strips
// don't need correct-facing normals to be visible).
function buildFoamEdges(frames, width) {
  const { points, normals } = frames;
  const segments = points.length - 1;
  const positions = [];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < segments; i++) {
      const u0 = i / segments, u1 = (i + 1) / segments;
      const w0 = riverHalfWidth(width, u0) - 0.02;
      const w1 = riverHalfWidth(width, u1) - 0.02;
      const p0 = points[i], n0 = normals[i], p1 = points[i + 1], n1 = normals[i + 1];
      const a = [p0.x + n0.x * side * w0, FOAM_Y, p0.z + n0.z * side * w0];
      const b = [p0.x + n0.x * side * (w0 + FOAM_STRIP_W), FOAM_Y, p0.z + n0.z * side * (w0 + FOAM_STRIP_W)];
      const c = [p1.x + n1.x * side * w1, FOAM_Y, p1.z + n1.z * side * w1];
      const d = [p1.x + n1.x * side * (w1 + FOAM_STRIP_W), FOAM_Y, p1.z + n1.z * side * (w1 + FOAM_STRIP_W)];
      positions.push(...a, ...c, ...b, ...b, ...c, ...d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geo;
}

// two-octave traveling swell; flat shading turns each displaced facet into a
// glint. Writes into the existing position array — no allocation.
function swell(surf, t2, speed) {
  const pos = surf.mesh.geometry.attributes.position;
  const arr = pos.array, base = surf.base;
  for (let v = 0; v < arr.length; v += 3) {
    const bx = base[v], bz = base[v + 2];
    arr[v + 1] = base[v + 1]
      + AMP * speed * (Math.sin(bx * 5.1 + bz * 3.7 + t2 * 1.3) + 0.5 * Math.sin(bx * 9.3 - bz * 6.1 + t2 * 2.2));
  }
  pos.needsUpdate = true;
  surf.mesh.geometry.computeVertexNormals();
}

// vertical waterfall strip: a flat plane in local x-y, subdivided into `rows`
// stacked quads so the whole column can wiggle sideways as it descends. Built
// centred on origin (y in [-h/2, h/2]) so it drops in where placed.
function buildVerticalStrip(width, height, rows) {
  const hw = width / 2, hh = height / 2;
  const positions = [];
  for (let j = 0; j < rows; j++) {
    const y0 = -hh + (j / rows) * height;
    const y1 = -hh + ((j + 1) / rows) * height;
    positions.push(-hw, y0, 0, hw, y0, 0, -hw, y1, 0);
    positions.push(hw, y0, 0, hw, y1, 0, -hw, y1, 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return { geo, base: new Float32Array(positions) };
}

// lateral wiggle scrolling downward: shift each vertex's x by a sine keyed on
// its (static) y, so the ribbon sways side-to-side down the column. Position
// only — MeshBasicMaterial needs no normals. No allocation.
function wiggleStrip(strip, t2, amp) {
  const pos = strip.mesh.geometry.attributes.position;
  const arr = pos.array, base = strip.base, r = strip.r;
  for (let v = 0; v < arr.length; v += 3) {
    arr[v] = base[v] + Math.sin(base[v + 1] * 6 + t2 * 4 + r) * amp;
  }
  pos.needsUpdate = true;
}

// lip fringe: a row of downward-pointing triangles (teeth) along the weir's top
// edge — the white lace where the river tips over the lip. Non-indexed.
function buildFringe(width, depth, teeth) {
  const hw = width / 2;
  const positions = [];
  for (let i = 0; i < teeth; i++) {
    const x0 = -hw + (i / teeth) * width;
    const x1 = -hw + ((i + 1) / teeth) * width;
    const mid = (x0 + x1) / 2;
    positions.push(x0, 0, 0, x1, 0, 0, mid, -depth, 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geo;
}

// radial vertex-color banding for the pond disc: centre dark, rim pale
function bandRadial(geo, maxR) {
  const pos = geo.attributes.position;
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const s = shade(Math.min(1, Math.sqrt(x * x + z * z) / maxR));
    colors.push(s, s, s);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
}

export function buildWater(island, mode = "island") {
  const group = new THREE.Group();
  island.add(group);

  // river: NW edge → under the bridge → over the weir → into the koi pond. The
  // terminus sits just past the bridge deck; the pond itself is the sunken disc
  // at POND_CENTER, not the river's literal end.
  const riverCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-6.6, 0, -3.4),
    new THREE.Vector3(-5.2, 0, -0.9),
    new THREE.Vector3(-4.2, 0, 2.6),
    new THREE.Vector3(-3.5, 0, 3.5),
  ]);
  const riverSurf = buildLanedRibbon(riverCurve, 0.55, 160, 4);
  riverSurf.mesh.position.y = 0.035; // slightly above ground, below the path
  riverSurf.mesh.receiveShadow = true;
  group.add(riverSurf.mesh);
  // reducedMotion: bake one static displaced frame, never animate
  if (reducedMotion) swell(riverSurf, 1.7, 1);
  const FRAME_N = riverSurf.frames.points.length;

  // bank foam lines: crisp thin threads hugging both edges of the whole course
  const foamMat = new THREE.MeshBasicMaterial({ color: FOAM_LINE, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
  const foamEdges = new THREE.Mesh(buildFoamEdges(riverSurf.frames, 0.55), foamMat);
  group.add(foamEdges);

  // drifting foam streaks: short dashes carried downstream by the current
  const STREAK_N = 10;
  const streakMat = new THREE.MeshBasicMaterial({ color: FOAM_LINE, transparent: true, opacity: 0.65, depthWrite: false });
  const streaks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.008, 0.03), streakMat, STREAK_N);
  group.add(streaks);
  // clamped to u ∈ [0.15, 0.95] so streaks never ride the tapered/sunken tip
  const streakState = Array.from({ length: STREAK_N }, () => ({
    u: 0.15 + Math.random() * 0.8,
    lane: (Math.random() - 0.5) * 0.6,
    speed: 0.018 + Math.random() * 0.01,
  }));

  // dark banks so the water reads as sunken (low-res, not animated)
  const banks = bankRibbon(riverCurve, 0.8);
  banks.material = mat(COLORS.mossDark);
  banks.position.y = 0.028;
  group.add(banks);

  // ---- koi pond / lake, sunk into the terrain at POND_CENTER (world -2.7, 4.7) ----
  const PX = -2.7, PZ = 4.7;

  // pond water disc: top face at y -0.18 (centre y -0.21). Only the river ribbon
  // and this disc get the mirror() sky tint; everything else is static.
  const pondGeo = new THREE.CylinderGeometry(1.1, 1.02, 0.06, 28, 3).toNonIndexed();
  bandRadial(pondGeo, 1.1);
  const pondMat = mat(WATER, { roughness: 0.5, vertexColors: true });
  const pond = new THREE.Mesh(pondGeo, pondMat);
  pond.position.set(PX, -0.21, PZ);
  group.add(pond);

  // dark bowl so the pond reads sunken: an open-ended wall + a floor disc, both
  // static dark (the old basin colour). Wall spans y +0.04 → -0.45.
  const bowlMat = mat(0x4a5a4e);
  const bowlWall = new THREE.Mesh(
    new THREE.CylinderGeometry(1.28, 1.28, 0.49, 28, 1, true),
    bowlMat
  );
  bowlWall.position.set(PX, -0.205, PZ);
  const bowlFloor = new THREE.Mesh(new THREE.CircleGeometry(1.28, 28), bowlMat);
  bowlFloor.rotation.x = -Math.PI / 2;
  bowlFloor.position.set(PX, -0.42, PZ);
  group.add(bowlWall, bowlFloor);

  // flat moss ring covering the seam at the pond rim — the slab hole edge in
  // island mode, the bowl wall's top standing on the dished ground in expanse.
  const bankRing = new THREE.Mesh(
    new THREE.RingGeometry(1.05, 1.6, 28),
    mat(COLORS.mossDark)
  );
  bankRing.rotation.x = -Math.PI / 2;
  bankRing.position.set(PX, 0.045, PZ);
  group.add(bankRing);

  // weir: a stone box the river drops over just past the bridge, rotated
  // perpendicular to the flow (heading ~(0.7,0,0.7) toward the pond).
  const weir = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.36, 0.26), mat(COLORS.stone));
  weir.position.set(-3.5, 0.14, 3.55);
  weir.rotation.y = 0.66;
  weir.castShadow = true;
  group.add(weir);

  // all animated cascade ribbons live here; one update loop wiggles and
  // opacity-fades the lot. `fullFade` marks strips that vanish entirely on
  // freeze; the cascade only pales (to 45%).
  const fallStrips = [];
  function addStrip(r, width, height, rows, x, y, z, opacity, amp, fullFade, yaw) {
    const { geo, base } = buildVerticalStrip(width, height, rows);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: FOAM, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
    }));
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw; // buildVerticalStrip is local x-y, so yaw the mesh
    group.add(mesh);
    fallStrips.push({ mesh, base, r, opacity, amp, fullFade });
  }

  // small waterfall: 3 cascade ribbons at the weir face (widths 0.18/0.22/0.26,
  // spanning y +0.10 → -0.24 as height 0.34 centred at y -0.07), slight per-strip
  // x/z offsets for depth, yawed to match the weir. This IS the waterfall now.
  for (let r = 0; r < 3; r++) {
    addStrip(r, 0.18 + r * 0.04, 0.34, 4,
      -3.42 + (r - 1) * 0.05, -0.07, 3.7 + (r % 2) * 0.04,
      0.55 + r * 0.12, 0.02, false, 0.66);
  }

  // lip fringe: white lace at the weir lip where the river tips over
  const fringe = new THREE.Mesh(
    buildFringe(0.7, 0.12, 7),
    new THREE.MeshBasicMaterial({ color: FOAM_LINE, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide })
  );
  fringe.position.set(-3.42, 0.10, 3.68);
  fringe.rotation.y = 0.66;
  group.add(fringe);

  // ripple rings: 3 cycling outward from the cascade's impact point on the
  // pond's north rim.
  const RING_ORIGIN = new THREE.Vector3(-3.35, -0.16, 3.85);
  const ringGeo = new THREE.RingGeometry(0.9, 1.0, 20);
  const rings = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide })
    );
    m.rotation.x = -Math.PI / 2; // lie flat, facing up toward the iso camera
    m.position.copy(RING_ORIGIN);
    group.add(m);
    return m;
  });

  // splash ring: one flat ring pulsing outward where the cascade lands
  const splashRing = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.0, 20),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide })
  );
  splashRing.rotation.x = -Math.PI / 2;
  splashRing.position.set(-3.35, -0.15, 3.85);
  group.add(splashRing);

  // koi: two small silhouettes circling the pond, flattened so they read as
  // at-the-surface from the iso view. Nose-forward cone body + patch + a
  // tail cone that sways independently.
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
  // pond center (x, z); koi swim just under the pond surface.
  const POOL = new THREE.Vector3(PX, 0, PZ);
  const koiA = koi(0xd96f38, 0xfdfaf2);
  const koiB = koi(0xfdfaf2, 0xd96f38);
  group.add(koiA, koiB);
  // orbit radii (0.4/0.62) + body half-length (~0.13) stay inside the 1.1 pond
  // rim; started at opposite angles and staggered pause phases so the two never
  // read as synced.
  const koiState = [
    { g: koiA, angle: 0, radius: 0.4, speed: 0.5, pauseTimer: 1.0 },
    { g: koiB, angle: 2.1, radius: 0.62, speed: 0.38, pauseTimer: -3.0 },
  ];

  const dummy = new THREE.Object3D();

  const spots = {
    // musashi stands shin-deep in the pond, facing the cascade
    misogi: { position: new THREE.Vector3(-2.95, -0.30, 4.15), facing: -2.40 },
  };

  function update(dt, t2, ws) {
    const frozen = ws.season === "winter" ? 1 - ws.seasonBlend : ws.nextSeason === "winter" ? ws.seasonBlend : 0;
    // sky-mirror tint: warm/ink sky, then ice as it freezes
    mirror(_mirror, frozen, ws);
    riverSurf.mesh.material.color.copy(_mirror);
    pondMat.color.copy(_mirror);
    // the moss bank ring sits outside world.js's season tint registry, so it
    // whitens across the freeze here — a green donut in a snowfield reads wrong
    bankRing.material.color.lerpColors(_bankBase, _bankSnow, frozen);
    // traveling swell — glides to stillness across the freeze window; skipped
    // for reducedMotion (baked once at build time)
    if (!reducedMotion && frozen < 1) swell(riverSurf, t2, 1 - frozen);

    // cascade ribbons: sway laterally down the column, pale as the water
    // freezes; static under freeze.
    fallStrips.forEach((s) => {
      s.mesh.material.opacity = s.opacity * (s.fullFade ? (1 - frozen) : (1 - frozen * 0.55));
      if (!reducedMotion && frozen < 1) wiggleStrip(s, t2, s.amp);
    });
    // lip fringe: fades out entirely as the river freezes
    fringe.material.opacity = 0.8 * (1 - frozen);
    // splash ring: 1.6s cycle, pond-scaled 0.15→0.55; hidden under reducedMotion/freeze
    const splashVisible = !reducedMotion && frozen < 1;
    splashRing.visible = splashVisible;
    if (splashVisible) {
      const phase = (t2 / 1.6) % 1;
      splashRing.scale.setScalar(0.15 + phase * 0.4);
      splashRing.material.opacity = 0.45 * (1 - phase) * (1 - frozen);
    }

    // bank foam: slow opacity pulse, calmed to a static value under
    // reducedMotion; fades out entirely as the river freezes.
    foamMat.opacity = (reducedMotion ? 0.4 : 0.4 + Math.sin(t2 * 0.9) * 0.12) * (1 - frozen);

    // drifting current streaks: fade out approaching freeze (no single-frame
    // pop), then hidden once mostly frozen or under reducedMotion
    streakMat.opacity = 0.65 * Math.max(0, 1 - frozen * 2);
    streaks.visible = frozen < 0.5 && !reducedMotion;
    if (streaks.visible) {
      // streaks set their own rotation/scale each iteration below; dummy carries
      // no stale transform in from another consumer.
      const { points, normals } = riverSurf.frames;
      streakState.forEach((s, i) => {
        s.u += s.speed * dt;
        if (s.u > 0.95) s.u -= 0.8; // wrap back to 0.15, clear of the tapered tip
        const idx = Math.min(FRAME_N - 1, Math.floor(s.u * FRAME_N));
        const p = points[idx], n = normals[idx];
        const nextIdx = idx + 1 >= FRAME_N ? idx : idx + 1;
        dummy.position.set(p.x + n.x * s.lane * 0.5, FOAM_Y, p.z + n.z * s.lane * 0.5);
        dummy.rotation.set(0, Math.atan2(points[nextIdx].x - p.x, points[nextIdx].z - p.z), 0);
        const pulse = 0.6 + 0.4 * Math.sin(t2 * 1.7 + i * 2.4);
        dummy.scale.set(pulse, 1, pulse);
        dummy.updateMatrix();
        streaks.setMatrixAt(i, dummy.matrix);
      });
      streaks.instanceMatrix.needsUpdate = true;
    }

    // ripple rings: cycle outward from the cascade impact point; hidden
    // under reducedMotion or once the pond is fully frozen
    const ringsVisible = !reducedMotion && frozen < 1;
    rings.forEach((r, i) => {
      r.visible = ringsVisible;
      if (!ringsVisible) return;
      const phase = (t2 * 0.45 + i / 3) % 1;
      r.scale.setScalar(0.12 + phase * 0.55);
      r.material.opacity = 0.38 * (1 - phase) * (1 - frozen);
    });

    // koi: circular swim with occasional pauses; hidden once mostly frozen,
    // slowed (not hidden) under reducedMotion
    const koiVisible = frozen < 0.5;
    koiState.forEach((k, i) => {
      k.g.visible = koiVisible;
      if (!koiVisible) return;
      k.pauseTimer -= dt;
      const moving = k.pauseTimer < 0 || k.pauseTimer > 1.5; // pause = 1.5s window every ~8-14s
      if (k.pauseTimer < -8 - i * 6) k.pauseTimer = 1.5;
      const sp = k.speed * (moving ? 1 : 0.05) * (reducedMotion ? 0.15 : 1);
      k.angle += sp * dt;
      k.g.position.set(POOL.x + Math.cos(k.angle) * k.radius, -0.165, POOL.z + Math.sin(k.angle) * k.radius);
      k.g.rotation.y = -k.angle; // tangent to the circle
      k.g.userData.tail.rotation.y = Math.sin(t2 * 6) * 0.5; // tail sway
    });
  }

  return { spots, update };
}
