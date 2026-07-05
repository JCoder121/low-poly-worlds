// The diorama: a floating faceted island with a clearing, a cherry tree,
// a fire pit, a dirt path, and falling petals. Flat-shaded, no textures.
import * as THREE from "three";

export const COLORS = {
  paper: 0xf5f0e4,
  ink: 0x1c2333,
  mossLight: 0xa9bc8b,
  moss: 0x8ca873,
  mossDark: 0x6e8b5e,
  cliff: 0xd5c49a,
  cliffDark: 0xb8a57f,
  sand: 0xe6dabe,
  stone: 0xb9b4a6,
  sakura: 0xf2b8c6,
  sakuraLight: 0xfbdce4,
  vermillion: 0xc93e33,
  trunk: 0x5a4634,
  ember: 0xe8853d,
  flameCore: 0xf6c15b,
  skin: 0xe8c39e,
};

export function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 1,
    metalness: 0,
    flatShading: true,
    ...opts,
  });
}

export function jitterGeometry(geo, amount) {
  const pos = geo.attributes.position;
  const seen = new Map(); // weld-aware jitter so faces stay attached
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!seen.has(key)) {
      seen.set(key, [
        (Math.random() - 0.5) * amount,
        (Math.random() - 0.5) * amount,
        (Math.random() - 0.5) * amount,
      ]);
    }
    const [dx, dy, dz] = seen.get(key);
    pos.setXYZ(i, pos.getX(i) + dx, pos.getY(i) + dy, pos.getZ(i) + dz);
  }
  geo.computeVertexNormals();
  return geo;
}

function blobShape(radius, variance, points = 11) {
  const shape = new THREE.Shape();
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const r = radius * (1 + (Math.random() - 0.5) * variance);
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function islandLayer(radius, variance, height, topColor, sideColor) {
  const geo = new THREE.ExtrudeGeometry(blobShape(radius, variance), {
    depth: height,
    bevelEnabled: false,
  });
  geo.rotateX(-Math.PI / 2); // lid faces +y, top sits at y = height
  const mesh = new THREE.Mesh(geo.toNonIndexed(), [mat(topColor), mat(sideColor)]);
  mesh.geometry.computeVertexNormals();
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function domeHill(radius, color) {
  const geo = new THREE.SphereGeometry(radius, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  geo.scale(1, 0.55, 1);
  jitterGeometry(geo.toNonIndexed(), radius * 0.09);
  const mesh = new THREE.Mesh(geo, mat(color));
  mesh.geometry.computeVertexNormals();
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function pineTree(height, color) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.06, height * 0.3, 5),
    mat(COLORS.trunk)
  );
  trunk.position.y = height * 0.15;
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(height * 0.28, height * 0.8, 6),
    mat(color)
  );
  cone.position.y = height * 0.65;
  trunk.castShadow = cone.castShadow = true;
  g.add(trunk, cone);
  return g;
}

export function rock(size) {
  const geo = jitterGeometry(
    new THREE.DodecahedronGeometry(size, 0).toNonIndexed(),
    size * 0.25
  );
  const m = new THREE.Mesh(geo, mat(COLORS.stone));
  m.castShadow = m.receiveShadow = true;
  m.scale.y = 0.7;
  m.rotation.y = Math.random() * Math.PI;
  return m;
}

function torii() {
  const g = new THREE.Group();
  const red = mat(COLORS.vermillion);
  const postGeo = new THREE.CylinderGeometry(0.055, 0.065, 1.15, 6);
  for (const x of [-0.42, 0.42]) {
    const post = new THREE.Mesh(postGeo, red);
    post.position.set(x, 0.575, 0);
    post.castShadow = true;
    g.add(post);
  }
  const kasagi = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.09, 0.13), red);
  kasagi.position.y = 1.16;
  kasagi.castShadow = true;
  const nuki = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.07, 0.09), red);
  nuki.position.y = 0.88;
  nuki.castShadow = true;
  g.add(kasagi, nuki);
  return g;
}

// ---------- cherry tree ----------

function cherryTree() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.22, 1.5, 6),
    mat(COLORS.trunk)
  );
  trunk.position.y = 0.75;
  trunk.rotation.z = 0.09;
  trunk.castShadow = true;
  g.add(trunk);

  const branch = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.09, 0.9, 5),
    mat(COLORS.trunk)
  );
  branch.position.set(0.42, 1.45, 0.1);
  branch.rotation.z = -0.85;
  branch.castShadow = true;
  g.add(branch);

  const blobs = [
    [0, 2.0, 0, 0.85],
    [-0.65, 1.85, 0.15, 0.6],
    [0.72, 1.95, -0.1, 0.62],
    [0.25, 2.3, 0.35, 0.55],
    [-0.3, 2.25, -0.4, 0.5],
    [0.95, 1.6, 0.3, 0.42],
    [-0.75, 2.1, -0.15, 0.4],
  ];
  const blobMeshes = [];
  blobs.forEach(([x, y, z, r], i) => {
    const geo = jitterGeometry(
      new THREE.IcosahedronGeometry(r, 0).toNonIndexed(),
      r * 0.16
    );
    const blob = new THREE.Mesh(
      geo,
      mat(i % 3 === 0 ? COLORS.sakuraLight : COLORS.sakura)
    );
    blob.position.set(x * 1.25, y, z * 1.25); // canopy spread wider than tall
    blob.castShadow = true;
    g.add(blob);
    blobMeshes.push(blob);
  });
  g.userData.blobs = blobMeshes;

  // winter snow caps on trunk/branch tips — hidden (scale 0) until winter
  const capSpecs = [
    [0, 1.55, 0, 0.22],
    [0.62, 1.78, 0.12, 0.16],
    [-0.1, 1.2, -0.05, 0.12],
  ];
  g.userData.snowCaps = capSpecs.map(([x, y, z, r]) => {
    const geo = jitterGeometry(
      new THREE.IcosahedronGeometry(r, 0).toNonIndexed(),
      r * 0.22
    );
    const cap = new THREE.Mesh(geo, mat(0xf4f2ec));
    cap.position.set(x, y, z);
    cap.scale.setScalar(0.001);
    cap.castShadow = true;
    g.add(cap);
    return cap;
  });
  return g;
}

// ---------- season palettes ----------

// Per-season target colors for lerp. Keys map onto tint targets registered in
// buildWorld: top (island top face), hl/hd (hill light/dark),
// pine (pine cones), blossom (cherry blobs; null → blobs hide for winter).
const SEASON_TINTS = {
  spring: { top: 0x8ca873, hl: 0xa9bc8b, hd: 0x6e8b5e, pine: 0x6e8b5e, blossom: 0xf2b8c6 },
  summer: { top: 0x7da065, hl: 0x9cb47e, hd: 0x5f7d52, pine: 0x5f7d52, blossom: 0x8fb277 },
  autumn: { top: 0xa89a5e, hl: 0xbcae76, hd: 0x8a7d4d, pine: 0x6e8b5e, blossom: 0xd98e4a },
  winter: { top: 0xe9e7dd, hl: 0xdfe3da, hd: 0xc2c8bb, pine: 0x5c7355, blossom: null },
};

// Resolve a target color for a tint entry, applying the light-blob lighten offset.
function tintColor(out, hex, lighten) {
  out.setHex(hex);
  if (lighten) {
    out.r = Math.min(1, out.r + 0.04);
    out.g = Math.min(1, out.g + 0.04);
    out.b = Math.min(1, out.b + 0.04);
  }
  return out;
}

// ---------- fire ----------

export class Fire {
  constructor(parent, position) {
    this.group = new THREE.Group();
    this.group.position.copy(position);

    const logMat = mat(COLORS.trunk);
    for (let i = 0; i < 3; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 5), logMat);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = (i / 3) * Math.PI;
      log.position.y = 0.05;
      log.castShadow = true;
      this.group.add(log);
    }
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const s = rock(0.055 + Math.random() * 0.03);
      s.position.set(Math.cos(a) * 0.33, 0.03, Math.sin(a) * 0.33);
      this.group.add(s);
    }

    this.flameOuter = new THREE.Mesh(
      new THREE.ConeGeometry(0.13, 0.4, 6),
      mat(COLORS.ember, { emissive: COLORS.ember, emissiveIntensity: 0.7 })
    );
    this.flameOuter.position.y = 0.28;
    this.flameInner = new THREE.Mesh(
      new THREE.ConeGeometry(0.07, 0.24, 5),
      mat(COLORS.flameCore, { emissive: COLORS.flameCore, emissiveIntensity: 0.9 })
    );
    this.flameInner.position.y = 0.24;
    this.group.add(this.flameOuter, this.flameInner);

    this.light = new THREE.PointLight(0xff9a4d, 4, 5.5, 1.8);
    this.light.position.y = 0.5;
    this.group.add(this.light);

    parent.add(this.group);
  }

  update(t, night = 0) {
    const flicker = Math.sin(t * 11) * 0.5 + Math.sin(t * 23 + 1.7) * 0.3 + Math.sin(t * 5.3) * 0.2;
    this.flameOuter.scale.set(1 + flicker * 0.12, 1 + flicker * 0.22, 1 + flicker * 0.12);
    this.flameInner.scale.set(1 - flicker * 0.1, 1 + flicker * 0.28, 1 - flicker * 0.1);
    this.flameOuter.rotation.y = t * 0.8;
    this.flameInner.rotation.y = -t * 1.1;
    this.light.intensity = (3.4 + flicker * 1.2) * (1.0 + night * 0.6);
  }
}

// ---------- path ----------

export function makePathCurve(mode = "island") {
  const points = [
    new THREE.Vector3(-7.6, 0, 1.6),
    new THREE.Vector3(-4.2, 0, 2.6),
    new THREE.Vector3(-0.8, 0, 3.0),
    new THREE.Vector3(2.8, 0, 2.7),
    new THREE.Vector3(5.4, 0, 1.9),
    new THREE.Vector3(7.6, 0, 1.0),
  ];
  if (mode === "expanse") {
    points.unshift(new THREE.Vector3(-16, 0, 2.2));
    points.push(new THREE.Vector3(16, 0, 0.4));
  }
  return new THREE.CatmullRomCurve3(points);
}

function pathRibbon(curve) {
  const samples = 60;
  const width = 0.72;
  const positions = [];
  const pt = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const edge = [];
  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    curve.getPoint(u, pt);
    curve.getTangent(u, tangent);
    normal.crossVectors(up, tangent).normalize();
    const wobble = width / 2 + Math.sin(u * 21) * 0.05;
    edge.push([
      pt.x + normal.x * wobble, pt.z + normal.z * wobble,
      pt.x - normal.x * wobble, pt.z - normal.z * wobble,
    ]);
  }
  for (let i = 0; i < samples; i++) {
    const [ax, az, bx, bz] = edge[i];
    const [cx, cz, dx, dz] = edge[i + 1];
    positions.push(ax, 0, az, bx, 0, bz, cx, 0, cz, bx, 0, bz, dx, 0, dz, cx, 0, cz);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat(COLORS.sand));
  mesh.position.y = 0.02;
  mesh.receiveShadow = true;
  return mesh;
}

// ---------- assembly ----------

export function buildWorld(scene, mode = "island") {
  const island = new THREE.Group();

  let topMaterial; // ground/top-face material registered under tint key "top"

  if (mode === "island") {
    const top = islandLayer(7.6, 0.10, 1.6, COLORS.moss, COLORS.cliff);
    top.position.y = -1.6; // top face stays at world y=0
    island.add(top);
    topMaterial = top.material[0];

    // soft contact shadow on the paper, far below the floating island
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = shadowCanvas.height = 256;
    const ctx = shadowCanvas.getContext("2d");
    const grad = ctx.createRadialGradient(128, 128, 20, 128, 128, 126);
    grad.addColorStop(0, "rgba(28,35,51,0.16)");
    grad.addColorStop(1, "rgba(28,35,51,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(17, 13.5),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(shadowCanvas),
        transparent: true,
        depthWrite: false,
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -3.2;
    island.add(shadow);
  } else {
    // expanse: one big rolling ground plane instead of the floating island tiers
    const groundGeo = new THREE.PlaneGeometry(64, 48, 26, 20);
    groundGeo.rotateX(-Math.PI / 2);
    // gentle rolling facets, flat near the clearing
    const pos = groundGeo.attributes.position;
    // the koi pond sits AT grade (water.js embeds its disc just above y=0,
    // like the road), so the ground near the clearing stays flat — no carve.
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const d = Math.hypot(x, z);
      const roll = d > 8 ? (d - 8) * 0.04 : 0;
      const y = Math.sin(x * 0.45) * Math.cos(z * 0.38) * roll + (Math.random() - 0.5) * Math.min(0.18, roll);
      pos.setY(i, y);
    }
    groundGeo.computeVertexNormals();
    const ground = new THREE.Mesh(groundGeo.toNonIndexed(), mat(COLORS.moss));
    ground.receiveShadow = true;
    island.add(ground);
    topMaterial = ground.material;
  }

  // back hills, like the atlas ridge
  const h1 = domeHill(2.6, COLORS.mossLight);
  h1.position.set(-3.6, 0, -4.4);
  const h2 = domeHill(1.9, COLORS.mossDark);
  h2.position.set(1.4, 0, -5.2);
  island.add(h1, h2);

  const extraHillTargets = [];
  if (mode === "expanse") {
    // extra dome hills scattered at radius 9-15 so the distance isn't empty
    const extraHillSpots = [
      [-14, -3, 2.2, COLORS.mossLight, "hl"],
      [13, -6, 2.0, COLORS.mossDark, "hd"],
    ];
    for (const [x, z, r, color, key] of extraHillSpots) {
      const h = domeHill(r, color);
      h.position.set(x, 0, z);
      island.add(h);
      extraHillTargets.push({ material: h.material, key, base: color, lighten: false });
    }
  }

  // pines scattered on and behind the hills
  const pinePlacements = [
    [-5.6, -2.6, 1.1], [-2.2, -5.4, 1.35], [-0.6, -4.6, 0.9],
    [3.2, -5.0, 1.2], [6.3, -2.3, 0.95], [6.2, -1.4, 0.8],
    [-6.4, -0.6, 0.9],
  ];
  if (mode === "expanse") {
    // 6 extra pines scattered at radius 9-15 so the expanse isn't empty
    pinePlacements.push(
      [-11, -7, 1.1], [9, -8, 1.2], [12, 3, 1.0],
      [-12, 4, 1.15], [8, 7, 0.95], [-9, 8, 1.05]
    );
  }
  const pineTargets = [];
  for (const [x, z, h] of pinePlacements) {
    const coneColor = Math.random() < 0.5 ? COLORS.mossDark : COLORS.moss;
    const p = pineTree(h, coneColor);
    p.position.set(x, 0, z);
    p.rotation.y = Math.random() * Math.PI;
    island.add(p);
    // pineTree adds [trunk, cone]; register the cone material with its own base
    pineTargets.push({ material: p.children[1].material, key: "pine", base: coneColor, lighten: false });
  }

  // rocks near the clearing
  const r1 = rock(0.28); r1.position.set(2.9, 0.08, -1.6);
  const r2 = rock(0.16); r2.position.set(3.3, 0.05, -1.2);
  const r3 = rock(0.2); r3.position.set(-4.3, 0.06, 0.4);
  island.add(r1, r2, r3);

  const tree = cherryTree();
  tree.position.set(-2.3, 0, -1.2);
  tree.scale.setScalar(1.18);
  island.add(tree);

  const curve = makePathCurve(mode);
  island.add(pathRibbon(curve));

  const gate = torii();
  gate.position.set(-6.9, 0, 1.85);
  gate.rotation.y = Math.PI / 2 - 0.25; // straddles the path near its west end
  island.add(gate);

  scene.add(island);

  const fire = new Fire(island, new THREE.Vector3(0.9, 0, 0.2));

  // ---- season tint registry ----
  // Each entry stores its OWN base color (never read from material.color, which
  // drifts as it is lerped every frame). Hills map h1->hl, h2->hd.
  const cherryBlobs = tree.userData.blobs;
  const snowCaps = tree.userData.snowCaps;
  const tintTargets = [
    { material: topMaterial, key: "top", base: COLORS.moss, lighten: false },
    { material: h1.material, key: "hl", base: COLORS.mossLight, lighten: false },
    { material: h2.material, key: "hd", base: COLORS.mossDark, lighten: false },
    ...extraHillTargets,
    ...pineTargets,
  ];
  cherryBlobs.forEach((blob, i) => {
    tintTargets.push({
      material: blob.material,
      key: "blossom",
      base: i % 3 === 0 ? COLORS.sakuraLight : COLORS.sakura,
      lighten: i % 3 === 0, // keep the sakuraLight blobs a shade brighter
    });
  });

  const _a = new THREE.Color();
  const _c = new THREE.Color();
  const seasons = {
    update(ws) {
      const b = ws.seasonBlend;
      for (const tt of tintTargets) {
        const cur = SEASON_TINTS[ws.season];
        const nxt = SEASON_TINTS[ws.nextSeason];
        const curHex = cur[tt.key] ?? tt.base;
        const nxtHex = nxt[tt.key] ?? cur[tt.key] ?? tt.base;
        tintColor(_a, curHex, tt.lighten);
        tintColor(_c, nxtHex, tt.lighten);
        tt.material.color.lerpColors(_a, _c, b);
      }
      // sakura: blobs shrink to nothing in winter, snow caps grow in their place
      const winterAmt = ws.season === "winter" ? 1 - b : ws.nextSeason === "winter" ? b : 0;
      for (const blob of cherryBlobs) blob.scale.setScalar(Math.max(0.001, 1 - winterAmt));
      for (const cap of snowCaps) cap.scale.setScalar(Math.max(0.001, winterAmt));
    },
  };

  return { island, fire, curve, treePosition: tree.position.clone(), seasons };
}
