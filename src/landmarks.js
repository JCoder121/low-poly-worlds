// The quiet places: a small temple with its lantern, a raked sand garden,
// and a river that slips under the road and off the edge of the world.
import * as THREE from "three";
import { COLORS, mat, rock, jitterGeometry } from "./world.js";

const SAND_LIGHT = 0xefe6cf;
const WATER = 0xa9cbd4;
const ICE = 0xd8e4ea;
const FOAM = 0xdcecf0;
const ROOF = 0x2a3247;
const PLASTER = 0xfdfaf2;

function temple() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 1.2), mat(COLORS.stone));
  base.position.y = 0.07;
  const hall = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.85), mat(PLASTER));
  hall.position.y = 0.44;
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.4, 0.02), mat(COLORS.ink));
  door.position.set(0, 0.36, 0.435);
  // four vermillion pillars at the corners
  for (const [x, z] of [[-0.5, 0.38], [0.5, 0.38], [-0.5, -0.38], [0.5, -0.38]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.62, 6), mat(COLORS.vermillion));
    p.position.set(x, 0.45, z);
    p.castShadow = true;
    g.add(p);
  }
  // two stacked pyramid roof slabs with overhang (4-sided cones read as hips)
  const roofLow = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.3, 4), mat(ROOF));
  roofLow.rotation.y = Math.PI / 4;
  roofLow.scale.z = 0.82;
  roofLow.position.y = 0.86;
  const roofHigh = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.24, 4), mat(ROOF));
  roofHigh.rotation.y = Math.PI / 4;
  roofHigh.scale.z = 0.82;
  roofHigh.position.y = 1.1;
  for (const m of [base, hall, roofLow, roofHigh]) { m.castShadow = m.receiveShadow = true; }
  g.add(base, hall, door, roofLow, roofHigh);
  return g;
}

function stoneLantern() {
  const g = new THREE.Group();
  const pieces = [
    [new THREE.CylinderGeometry(0.055, 0.07, 0.3, 6), 0.15, COLORS.stone],  // post
    [new THREE.CylinderGeometry(0.1, 0.08, 0.12, 6), 0.36, COLORS.stone],   // firebox
    [new THREE.ConeGeometry(0.14, 0.1, 6), 0.48, COLORS.stone],             // cap
  ];
  for (const [geo, y, c] of pieces) {
    const m = new THREE.Mesh(geo, mat(c));
    m.position.y = y;
    m.castShadow = true;
    g.add(m);
  }
  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.07, 0.09),
    mat(COLORS.flameCore, { emissive: COLORS.flameCore, emissiveIntensity: 0 })
  );
  glow.position.y = 0.36;
  const light = new THREE.PointLight(0xffc37a, 0, 3.2, 1.9);
  light.position.y = 0.42;
  g.add(glow, light);
  g.userData = { glow, light };
  return g;
}

function zenGarden() {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.07, 1.15), mat(SAND_LIGHT));
  slab.position.y = 0.035;
  slab.receiveShadow = true;
  g.add(slab);
  for (let i = 0; i < 6; i++) { // raked grooves: thin ridges along the long axis
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.015, 0.02), mat(0xe2d5b8));
    ridge.position.set(0, 0.075, -0.42 + i * 0.17);
    g.add(ridge);
  }
  const placements = [[-0.45, 0.12, 0.14], [0.35, -0.25, 0.1], [0.55, 0.3, 0.07]];
  for (const [x, z, s] of placements) {
    const r = rock(s);
    r.position.set(x, 0.09, z);
    g.add(r);
  }
  return g;
}

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

function bridge() {
  const g = new THREE.Group();
  // gently arched deck: 5 planks fanning over the water, road-flush
  for (let i = 0; i < 5; i++) {
    const k = i / 4 - 0.5; // -0.5..0.5 across the span
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.045, 0.95), mat(COLORS.trunk));
    plank.position.set(k * 1.35, 0.1 + Math.cos(k * Math.PI) * 0.09, 0);
    plank.rotation.z = -Math.sin(k * Math.PI) * 0.16;
    plank.castShadow = plank.receiveShadow = true;
    g.add(plank);
  }
  for (const side of [-0.42, 0.42]) { // low rails
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.5, 5), mat(COLORS.trunk));
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, 0.34, side);
    g.add(rail);
    for (const x of [-0.6, 0, 0.6]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.26, 5), mat(COLORS.trunk));
      post.position.set(x, 0.2, side);
      g.add(post);
    }
  }
  return g;
}

export function buildLandmarks(island) {
  const group = new THREE.Group();
  island.add(group);

  const t = temple();
  t.position.set(4.4, 0, -3.7);
  t.rotation.y = Math.PI * 0.78;
  group.add(t);

  const lantern = stoneLantern();
  lantern.position.set(3.4, 0, -3.1);
  group.add(lantern);

  const garden = zenGarden();
  garden.position.set(2.7, 0, -2.6);
  garden.rotation.y = 0.5;
  group.add(garden);

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

  const br = bridge();
  br.position.set(-4.2, 0, 2.6);
  // deck runs along the road; river flows under across it
  br.rotation.y = Math.atan2(2.6 - (-0.9), -4.2 - (-5.2)) + Math.PI / 2;
  group.add(br);

  // mini-cascade: a stone step the river drops over, into a small pool (misogi spot)
  const step = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.42, 0.24), mat(COLORS.stone));
  step.position.set(-3.9, 0.21, 3.55);
  step.castShadow = true;
  const cascade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.44, 0.08), mat(FOAM, { transparent: true, opacity: 0.85 }));
  cascade.position.set(-3.9, 0.22, 3.7);
  const pool = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.5, 0.06, 9), mat(WATER, { roughness: 0.5 }));
  pool.position.set(-3.9, 0.03, 4.05);
  group.add(step, cascade, pool);

  // the waterfall: pours off the cliff edge, down past the island's foot.
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
  const fallOrigin = new THREE.Vector3(-3.85, -2.2, 4.75);
  const fallDelta = CAM_FORWARD.clone().multiplyScalar(-FALL_SHIFT);
  const fallPos = fallOrigin.clone().add(fallDelta);

  const fall = new THREE.Mesh(new THREE.BoxGeometry(0.55, 4.6, 0.14), mat(FOAM, { transparent: true, opacity: 0.8 }));
  fall.position.copy(fallPos);
  group.add(fall);
  // falling water chunks (instanced) + mist puffs at the base — offsets are
  // relative to fallOrigin, then shifted by the same fallDelta so they stay
  // visually locked to the fall column.
  const chunkGeo = new THREE.BoxGeometry(0.1, 0.22, 0.08);
  const chunks = new THREE.InstancedMesh(chunkGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }), 14);
  group.add(chunks);
  const CHUNK_TOP = 0.1 + fallDelta.y;
  const CHUNK_BOTTOM = -4.5 + fallDelta.y;
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
      -4.3 + fallDelta.y,
      fallOrigin.z + fallDelta.z + (i % 2) * 0.2
    );
    mists.push(m);
    group.add(m);
  }

  const dummy = new THREE.Object3D();
  const waterMats = [river.material, pool.material];
  const riverC = new THREE.Color(WATER), iceC = new THREE.Color(ICE);

  const spots = {
    garden: { position: new THREE.Vector3(1.8, 0, -1.9), facing: -0.9 },   // at the garden's near edge, rake in hand
    temple: { position: new THREE.Vector3(3.35, 0, -2.55), facing: Math.PI * 0.78 }, // kneeling before the steps, clear of the roof overhang
    misogi: { position: new THREE.Vector3(-3.9, 0, 3.95), facing: Math.PI },       // standing in the pool, facing the cascade
    bridge: { position: new THREE.Vector3(-4.05, 0.16, 2.15), facing: 2.5 },       // on the deck, gazing downstream
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
      m.position.y = -4.3 + fallDelta.y + Math.sin(t2 * 0.9 + i * 2.1) * 0.12;
      m.material.opacity = 0.16 + Math.sin(t2 * 1.3 + i) * 0.05;
    });
    const l = lantern.userData;
    l.light.intensity = ws.night * 1.6;
    l.glow.material.emissiveIntensity = ws.night * 1.1;
  }

  return { spots, update };
}
