// The water: river, pool, waterfall — the diorama's standout artifact.
import * as THREE from "three";
import { COLORS, mat } from "./world.js";

export const WATER = 0x93bfd0;
export const ICE = 0xd8e4ea;
export const FOAM = 0xdcecf0;

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
  }

  return { spots, update };
}
