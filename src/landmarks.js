// The quiet places: a small temple with its lantern, a raked sand garden,
// and the bridge that carries the road over the river.
import * as THREE from "three";
import { COLORS, mat, rock, jitterGeometry } from "./world.js";

const SAND_LIGHT = 0xefe6cf;
const ROOF = 0x2a3247;
const PLASTER = 0xfdfaf2;

function temple() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 1.2), mat(COLORS.stone));
  base.position.y = 0.07;
  const hall = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.72, 0.85), mat(COLORS.vermillion));
  hall.position.y = 0.50;
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.48, 0.02), mat(COLORS.ink));
  door.position.set(0, 0.42, 0.435);
  // four vermillion pillars at the corners
  for (const [x, z] of [[-0.5, 0.38], [0.5, 0.38], [-0.5, -0.38], [0.5, -0.38]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.74, 6), mat(COLORS.vermillion));
    p.position.set(x, 0.51, z);
    p.castShadow = true;
    g.add(p);
  }
  // three stacked pyramid roof tiers with overhang (4-sided cones read as hips)
  const roofLow = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.3, 4), mat(ROOF));
  roofLow.rotation.y = Math.PI / 4;
  roofLow.scale.z = 0.82;
  roofLow.position.y = 0.98;
  const roofMid = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.26, 4), mat(ROOF));
  roofMid.rotation.y = Math.PI / 4;
  roofMid.scale.z = 0.82;
  roofMid.position.y = 1.22;
  const roofHigh = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.22, 4), mat(ROOF));
  roofHigh.rotation.y = Math.PI / 4;
  roofHigh.scale.z = 0.82;
  roofHigh.position.y = 1.46;
  for (const m of [base, hall, roofLow, roofMid, roofHigh]) { m.castShadow = m.receiveShadow = true; }
  g.add(base, hall, door, roofLow, roofMid, roofHigh);
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
  const slab = new THREE.Mesh(
    jitterGeometry(new THREE.BoxGeometry(1.7, 0.07, 1.15, 12, 1, 8).toNonIndexed(), 0.01),
    mat(SAND_LIGHT)
  );
  slab.position.y = 0.035;
  slab.receiveShadow = true;
  g.add(slab);
  for (let i = 0; i < 10; i++) { // raked grooves: thin ridges along the long axis
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.012, 0.014), mat(0xe2d5b8));
    ridge.position.set(0, 0.075, -0.4725 + i * 0.105);
    g.add(ridge);
  }
  // concentric raked arcs around the biggest rock
  for (const radius of [0.2, 0.3]) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.006, 4, 12, Math.PI * 1.5), mat(0xe2d5b8));
    arc.rotation.x = -Math.PI / 2;
    arc.position.set(-0.45, 0.075, 0.12);
    g.add(arc);
  }
  const placements = [[-0.45, 0.12, 0.14], [0.35, -0.25, 0.1], [0.55, 0.3, 0.07]];
  for (const [x, z, s] of placements) {
    const r = rock(s);
    r.position.set(x, 0.09, z);
    g.add(r);
  }
  return g;
}

function bridge() {
  const g = new THREE.Group();
  // gently arched deck: 5 planks fanning over the water, road-flush
  for (let i = 0; i < 5; i++) {
    const k = i / 4 - 0.5; // -0.5..0.5 across the span
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.045, 1.35), mat(COLORS.trunk));
    plank.position.set(k * 1.35, 0.1 + Math.cos(k * Math.PI) * 0.09, 0);
    plank.rotation.z = -Math.sin(k * Math.PI) * 0.16;
    plank.castShadow = plank.receiveShadow = true;
    g.add(plank);
  }
  for (const side of [-0.62, 0.62]) { // low rails
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

export function buildLandmarks(island, mode = "island") {
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

  const br = bridge();
  br.position.set(-4.2, 0, 2.6);
  // deck runs along the road; river flows under across it
  br.rotation.y = Math.atan2(2.6 - (-0.9), -4.2 - (-5.2)) + Math.PI / 2;
  group.add(br);

  const spots = {
    garden: { position: new THREE.Vector3(1.8, 0, -1.9), facing: -0.9 },   // at the garden's near edge, rake in hand
    temple: { position: new THREE.Vector3(3.35, 0, -2.55), facing: Math.PI * 0.78 }, // kneeling before the steps, clear of the roof overhang
    bridge: { position: new THREE.Vector3(-4.1, 0.16, 2.0), facing: 2.5 },         // on the deck, ~0.6 off the road center line, gazing downstream
  };

  function update(dt, t2, ws) {
    const l = lantern.userData;
    l.light.intensity = ws.night * 1.6;
    l.glow.material.emissiveIntensity = ws.night * 1.1;
  }

  return { spots, update };
}
