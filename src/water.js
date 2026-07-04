// The water: river, pool, waterfall — the diorama's standout artifact.
import * as THREE from "three";
import { COLORS, mat } from "./world.js";

export const WATER = 0xa9cbd4;
export const ICE = 0xd8e4ea;
export const FOAM = 0xdcecf0;

function riverRibbon(curve, width) {
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
  const river = riverRibbon(riverCurve, 0.55);
  river.position.y = 0.035; // slightly above ground, below the 0.02+path? path is 0.02 — river crosses under bridge only
  river.receiveShadow = true;
  group.add(river);

  // dark banks so the water reads as sunken
  const banks = riverRibbon(riverCurve, 0.8);
  banks.material = mat(COLORS.mossDark);
  banks.position.y = 0.028;
  group.add(banks);

  // mini-cascade: a stone step the river drops over, into a small pool (misogi spot)
  const step = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.42, 0.24), mat(COLORS.stone));
  step.position.set(-3.9, 0.21, 3.55);
  step.castShadow = true;
  const cascade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.44, 0.08), mat(FOAM, { transparent: true, opacity: 0.85 }));
  cascade.position.set(-3.9, 0.22, 3.7);
  const pool = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.5, 0.06, 9), mat(WATER, { roughness: 0.5 }));
  pool.position.set(-3.9, 0.03, 4.05);
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
  const waterMats = [river.material, pool.material];
  const riverC = new THREE.Color(WATER), iceC = new THREE.Color(ICE);

  const spots = {
    misogi: { position: new THREE.Vector3(-3.9, 0, 3.95), facing: Math.PI },       // standing in the pool, facing the cascade
  };

  function update(dt, t2, ws) {
    const frozen = ws.season === "winter" ? 1 - ws.seasonBlend : ws.nextSeason === "winter" ? ws.seasonBlend : 0;
    for (const m of waterMats) m.color.lerpColors(riverC, iceC, frozen);
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
