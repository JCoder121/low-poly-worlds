// The water: river, pool, waterfall — the diorama's standout artifact.
import * as THREE from "three";
import { COLORS, mat } from "./world.js";

export const WATER = 0x93bfd0;
export const ICE = 0xd8e4ea;
export const FOAM = 0xdcecf0;
export const FOAM_LINE = 0xfdfaf2;

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// module-scope scratch: zero per-frame allocations
const _mirror = new THREE.Color(), _base = new THREE.Color(WATER), _ice = new THREE.Color(ICE);
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
    const w = width / 2 + Math.sin(u * 17) * 0.04;
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
// Returns { mesh, base, frames } — Tasks 3/6 consume `frames`.
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
// MeshBasicMaterial + DoubleSide sidesteps the winding trap from Task 2
// (thin unlit strips don't need correct-facing normals to be visible).
function buildFoamEdges(frames, width) {
  const { points, normals } = frames;
  const segments = points.length - 1;
  const positions = [];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < segments; i++) {
      const u0 = i / segments, u1 = (i + 1) / segments;
      const w0 = width / 2 + Math.sin(u0 * 17) * 0.04 - 0.02;
      const w1 = width / 2 + Math.sin(u1 * 17) * 0.04 - 0.02;
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

// radial vertex-color banding for the pool disc: centre dark, rim pale
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

  // river: NW edge → under the road → mini-cascade pool → off the south cliff
  const riverCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-6.6, 0, -3.4),
    new THREE.Vector3(-5.2, 0, -0.9),
    new THREE.Vector3(-4.2, 0, 2.6),
    new THREE.Vector3(-3.9, 0, 4.1),
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
  const streakState = Array.from({ length: STREAK_N }, () => ({
    u: Math.random(),
    lane: (Math.random() - 0.5) * 0.6,
    speed: 0.018 + Math.random() * 0.01,
  }));

  // dark banks so the water reads as sunken (low-res, not animated)
  const banks = bankRibbon(riverCurve, 0.8);
  banks.material = mat(COLORS.mossDark);
  banks.position.y = 0.028;
  group.add(banks);

  // mini-cascade: a stone step the river drops over, into a small pool (misogi spot)
  const step = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.42, 0.24), mat(COLORS.stone));
  step.position.set(-3.9, 0.21, 3.55);
  step.castShadow = true;
  const cascade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.44, 0.08), mat(FOAM, { transparent: true, opacity: 0.85 }));
  cascade.position.set(-3.9, 0.22, 3.7);
  const poolGeo = new THREE.CylinderGeometry(0.85, 0.78, 0.06, 24, 3).toNonIndexed();
  bandRadial(poolGeo, 0.85);
  const poolMat = mat(WATER, { roughness: 0.5, vertexColors: true });
  const pool = new THREE.Mesh(poolGeo, poolMat);
  pool.position.set(-3.9, 0.03, 4.15);
  group.add(step, cascade, pool);

  // ripple rings: 3 cycling outward from the cascade's impact point. Pool top
  // sits at y 0.03+0.03=0.06 — the brief's y 0.045 sits inside the disc, so
  // rings are raised to 0.075 (matches the koi plane below) to clear it.
  const RING_ORIGIN = new THREE.Vector3(-3.9, 0.075, 3.85);
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

  // koi: two small silhouettes circling the pool, flattened so they read as
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
  // pool center — matches pool.position above (x, z); Task 2 left it here.
  const POOL = new THREE.Vector3(-3.9, 0, 4.15);
  const koiA = koi(0xd96f38, 0xfdfaf2);
  const koiB = koi(0xfdfaf2, 0xd96f38);
  group.add(koiA, koiB);
  // orbit radii (0.32/0.45) + body half-length (~0.13) stay well inside the
  // 0.85 pool rim; started at opposite angles and staggered pause phases so
  // the two never read as synced.
  const koiState = [
    { g: koiA, angle: 0, radius: 0.32, speed: 0.5, pauseTimer: 1.0 },
    { g: koiB, angle: 2.1, radius: 0.45, speed: 0.38, pauseTimer: -3.0 },
  ];

  // the waterfall: island mode pours off the cliff edge, down past the
  // island's foot; expanse mode has no cliff at all (just rolling ground), so
  // the river instead ends in a sunken, misty basin at ground level.
  let fallOrigin, fallDelta, CHUNK_TOP, CHUNK_BOTTOM, mistBaseY, fall;

  if (mode === "expanse") {
    // no cliff to occlude the fall here, so no camera-axis shift is needed —
    // the basin sits right at the river's literal end point.
    fallOrigin = new THREE.Vector3(-3.85, -0.35, 4.75);
    fallDelta = new THREE.Vector3(0, 0, 0);

    const basin = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.0, 0.12, 12),
      mat(0x4a5a4e)
    );
    basin.position.set(-3.9, -0.18, 5.2);
    basin.receiveShadow = true;
    group.add(basin);

    fall = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.14), mat(FOAM, { transparent: true, opacity: 0.8 }));
    fall.position.set(fallOrigin.x, -0.35, fallOrigin.z);
    group.add(fall);

    CHUNK_TOP = 0.1;
    CHUNK_BOTTOM = -0.7;
    mistBaseY = -0.1;
  } else {
    // At the brief's literal coordinates (-3.85,-2.2,4.75) this column sits at
    // radius ~6.1 from the island's center — inside the mid cliff-tier's
    // footprint (radius ~8.3, up to ~9 with jitter) — so it rendered fully
    // hidden behind solid ground. Rather than move it sideways (which pulled it
    // away from the pool into visibly empty air), it's pulled toward the
    // camera along the camera's own view axis: since that axis is orthogonal to
    // the screen plane in this orthographic view, translating along it leaves
    // every pixel of the fall's silhouette exactly where the brief placed it,
    // while lifting it in front of the cliff mesh instead of inside it.
    const CAM_FORWARD = new THREE.Vector3(-13, -10.9, -13).normalize();
    const FALL_SHIFT = 7; // world units toward the camera; clears the cliff occlusion
    fallOrigin = new THREE.Vector3(-3.85, -2.2, 4.75);
    fallDelta = CAM_FORWARD.clone().multiplyScalar(-FALL_SHIFT);
    const fallPos = fallOrigin.clone().add(fallDelta);

    fall = new THREE.Mesh(new THREE.BoxGeometry(0.55, 4.6, 0.14), mat(FOAM, { transparent: true, opacity: 0.8 }));
    fall.position.copy(fallPos);
    group.add(fall);

    CHUNK_TOP = 0.1 + fallDelta.y;
    CHUNK_BOTTOM = -4.5 + fallDelta.y;
    mistBaseY = -4.3 + fallDelta.y;
  }

  // falling water chunks (instanced) + mist puffs at the base — offsets are
  // relative to fallOrigin, then shifted by the same fallDelta so they stay
  // visually locked to the fall column.
  const chunkGeo = new THREE.BoxGeometry(0.1, 0.22, 0.08);
  const chunks = new THREE.InstancedMesh(chunkGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }), 14);
  group.add(chunks);
  const chunkState = Array.from({ length: 14 }, () => ({
    y: CHUNK_TOP + Math.random() * (CHUNK_BOTTOM - CHUNK_TOP),
    x: fallOrigin.x + fallDelta.x + Math.random() * 0.4,
    speed: 1.6 + Math.random() * 0.9,
  }));
  const mists = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.32 + i * 0.1, 0),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false })
    );
    m.position.set(
      fallOrigin.x + fallDelta.x - 0.25 + i * 0.25,
      mistBaseY,
      fallOrigin.z + fallDelta.z + (i % 2) * 0.2
    );
    mists.push(m);
    group.add(m);
  }

  const dummy = new THREE.Object3D();

  const spots = {
    misogi: { position: new THREE.Vector3(-3.9, 0, 3.95), facing: Math.PI },       // standing at the pool's cascade edge, facing the cascade
  };

  function update(dt, t2, ws) {
    const frozen = ws.season === "winter" ? 1 - ws.seasonBlend : ws.nextSeason === "winter" ? ws.seasonBlend : 0;
    // sky-mirror tint: warm/ink sky, then ice as it freezes
    mirror(_mirror, frozen, ws);
    riverSurf.mesh.material.color.copy(_mirror);
    poolMat.color.copy(_mirror);
    // traveling swell — glides to stillness across the freeze window; skipped
    // for reducedMotion (baked once at build time)
    if (!reducedMotion && frozen < 1) swell(riverSurf, t2, 1 - frozen);
    cascade.material.opacity = 0.85 * (1 - frozen);
    fall.material.opacity = 0.8 * (1 - frozen * 0.55); // frozen falls: paler, still
    chunks.visible = frozen < 0.5;
    if (chunks.visible) {
      chunkState.forEach((c, i) => {
        c.y -= c.speed * dt;
        if (c.y < CHUNK_BOTTOM) c.y = CHUNK_TOP;
        dummy.position.set(c.x, c.y, fallOrigin.z + fallDelta.z);
        dummy.updateMatrix();
        chunks.setMatrixAt(i, dummy.matrix);
      });
      chunks.instanceMatrix.needsUpdate = true;
    }
    mists.forEach((m, i) => {
      m.visible = frozen < 0.5;
      m.position.y = mistBaseY + Math.sin(t2 * 0.9 + i * 2.1) * 0.12;
      m.material.opacity = 0.16 + Math.sin(t2 * 1.3 + i) * 0.05;
    });

    // bank foam: slow opacity pulse, calmed to a static value under
    // reducedMotion; fades out entirely as the river freezes.
    foamMat.opacity = (reducedMotion ? 0.4 : 0.4 + Math.sin(t2 * 0.9) * 0.12) * (1 - frozen);

    // drifting current streaks: hidden once mostly frozen or under reducedMotion
    streaks.visible = frozen < 0.5 && !reducedMotion;
    if (streaks.visible) {
      const { points, normals } = riverSurf.frames;
      streakState.forEach((s, i) => {
        s.u += s.speed * dt;
        if (s.u > 0.98) s.u -= 0.96;
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
    // under reducedMotion or once the pool is fully frozen
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
      k.g.position.set(POOL.x + Math.cos(k.angle) * k.radius, 0.075, POOL.z + Math.sin(k.angle) * k.radius);
      k.g.rotation.y = -k.angle; // tangent to the circle
      k.g.userData.tail.rotation.y = Math.sin(t2 * 6) * 0.5; // tail sway
    });
  }

  return { spots, update };
}
