// TRAFFIC — the sea's passing life. Musashi's travelers, seaborne: a single
// drifter crosses the starboard lane at a time, bobs on the shared swell, and
// near center pauses to offer a speech-bubble link before drifting on.
import * as THREE from "three";
import { COLORS, mat, unlit, jitterGeometry } from "./palette.js";
import { waveHeight } from "./waves.js";
import { makeLinkDeck } from "./links.js";

const rand = (a, b) => a + Math.random() * (b - a);

// Lane geometry (world). Near lane rides starboard, camera-side.
const LANE_Z = 8.4; // clear of the 3x hull + plank
const LANE_JITTER = 1.3;
// island page: the sea is a disc — drifters enter/leave at its rim rather
// than the fog edge, so nothing ever floats over the bare parchment
const ISLAND_PAGE = document.body.dataset.mode === "island";
const SPAWN_X = ISLAND_PAGE ? 8.0 : 26;
const GHOST_Z = -17;

// ---------------------------------------------------------------------------
// Builders — primitives + palette only. Each returns a Group facing +x, with
// any animatable sub-parts stashed on group.userData for the idle loop.
// ---------------------------------------------------------------------------

// bottle-with-rolled-map: green glass on its side, cork, a curl of chart inside
function buildBottle() {
  const g = new THREE.Group();
  const glass = mat(COLORS.bottleGlass, { transparent: true, opacity: 0.85 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 9), glass);
  body.rotation.z = Math.PI / 2; // lie along x
  body.castShadow = true;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.16, 8), glass);
  neck.rotation.z = Math.PI / 2;
  neck.position.x = 0.32;
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.07, 6), mat(COLORS.driftwood));
  cork.rotation.z = Math.PI / 2;
  cork.position.x = 0.42;
  // rolled map, just visible through the glass
  const map = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.34, 7), mat(COLORS.paper));
  map.rotation.z = Math.PI / 2;
  map.position.x = -0.03;
  g.add(body, neck, cork, map);
  return g;
}

// a small seated figure for the canoe
function seatedFigure(shirt) {
  const p = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.26, 7), mat(shirt));
  torso.position.y = 0.2;
  torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), mat(COLORS.skinTan));
  head.position.y = 0.4;
  head.castShadow = true;
  p.add(torso, head);
  return p;
}

// canoe + paddler: paddle dips alternate sides, paddler counter-leans
function buildCanoe() {
  const g = new THREE.Group();
  const hullMat = mat(COLORS.canoe);
  const hull = new THREE.Mesh(jitterGeometry(new THREE.BoxGeometry(1.1, 0.2, 0.36), 0.03), hullMat);
  hull.castShadow = true;
  hull.receiveShadow = true;
  const bow = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.42, 4), hullMat);
  bow.rotation.z = -Math.PI / 2;
  bow.position.set(0.73, 0.02, 0);
  bow.castShadow = true;
  const stern = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.42, 4), hullMat);
  stern.rotation.z = Math.PI / 2;
  stern.position.set(-0.73, 0.02, 0);
  stern.castShadow = true;
  // hollow trough hint
  const trough = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.1, 0.22), mat(COLORS.hullDark));
  trough.position.y = 0.09;
  g.add(hull, bow, stern, trough);

  const paddler = seatedFigure(COLORS.crewShirt);
  paddler.position.set(-0.05, 0.12, 0);
  g.add(paddler);

  const paddle = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 5), mat(COLORS.driftwood));
  shaft.position.y = -0.2;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.11), mat(COLORS.driftwood));
  blade.position.y = -0.5;
  paddle.add(shaft, blade);
  paddle.position.set(0.02, 0.52, 0.14);
  g.add(paddle);

  g.userData.paddle = paddle;
  g.userData.paddler = paddler;
  return g;
}

// sea turtle: domed shell, four flippers, front pair sways like slow oars
function buildTurtle() {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), mat(COLORS.turtleShell, { flatShading: true }));
  shell.scale.set(1.15, 0.5, 0.9);
  shell.position.y = 0.08;
  shell.castShadow = true;
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 5), mat(COLORS.turtle));
  belly.scale.set(1.1, 0.35, 0.85);
  belly.position.y = -0.02;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), mat(COLORS.turtle));
  head.position.set(0.36, 0.05, 0);
  head.castShadow = true;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), mat(COLORS.turtle));
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-0.34, 0.02, 0);
  g.add(shell, belly, head, tail);

  const flips = [];
  for (const [fx, fz] of [[0.14, 0.24], [0.14, -0.24], [-0.16, 0.22], [-0.16, -0.22]]) {
    const flipGeo = new THREE.BoxGeometry(0.26, 0.05, 0.13);
    // pivot at the shoulder so the sway rotates the blade outward
    flipGeo.translate(0.13, 0, 0.06 * Math.sign(fz));
    const f = new THREE.Mesh(flipGeo, mat(COLORS.turtle));
    f.position.set(fx, 0.03, fz);
    f.castShadow = true;
    g.add(f);
    flips.push(f);
  }
  g.userData.flips = flips; // [frontL, frontR, backL, backR]
  return g;
}

// driftwood log with a gull perched on it (gull gives an idle head-bob + flutter)
function buildDriftwood() {
  const g = new THREE.Group();
  const log = new THREE.Mesh(jitterGeometry(new THREE.CylinderGeometry(0.12, 0.13, 1.0, 7), 0.05), mat(COLORS.driftwood));
  log.rotation.z = Math.PI / 2;
  log.rotation.x = 0.15;
  log.castShadow = true;
  log.receiveShadow = true;
  g.add(log);
  for (const [bx, bz, br] of [[0.25, 0.06, 0.4], [-0.3, -0.05, -0.5]]) {
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.28, 5), mat(COLORS.driftwood));
    branch.position.set(bx, 0.12, bz);
    branch.rotation.z = br;
    g.add(branch);
  }

  const gull = new THREE.Group();
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), mat(COLORS.gull));
  body.scale.set(1.4, 0.9, 0.9);
  body.castShadow = true;
  const gHead = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), mat(COLORS.gull));
  gHead.position.set(0.13, 0.1, 0);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.09, 4), mat(COLORS.brass));
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.22, 0.09, 0);
  gull.add(body, gHead, beak);
  const wings = [];
  for (const wz of [0.09, -0.09]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.1), mat(COLORS.gullWing));
    w.geometry.translate(-0.02, 0, 0.05 * Math.sign(wz)); // pivot at the shoulder
    w.position.set(-0.02, 0.02, wz);
    gull.add(w);
    wings.push(w);
  }
  gull.position.set(0.02, 0.2, 0);
  g.add(gull);
  g.userData.gullHead = gHead;
  g.userData.wings = wings;
  return g;
}

// a floating barrel — slow spin + bob
function buildBarrel() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(jitterGeometry(new THREE.CylinderGeometry(0.28, 0.24, 0.52, 12), 0.015), mat(COLORS.barrel));
  body.position.y = 0.05;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  for (const hy of [0.22, 0.05, -0.12]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.02, 5, 14), mat(COLORS.hullDark));
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = hy;
    g.add(hoop);
  }
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 12), mat(COLORS.barrel));
  lid.position.y = 0.31;
  g.add(lid);
  return g;
}

// shark fin: a lone slicing fin (no rider, no bubble)
function buildFin() {
  const g = new THREE.Group();
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.46, 3), mat(COLORS.sharkFin));
  fin.scale.set(1, 1, 0.22);
  fin.rotation.z = -0.18; // rake back
  fin.position.y = 0.2;
  fin.castShadow = true;
  g.add(fin);
  return g;
}

// whale: a broad back that arcs up, spouts foam shards, and submerges again
function buildWhale() {
  const g = new THREE.Group();
  const back = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 7), mat(COLORS.whale));
  back.scale.set(1.5, 0.55, 0.75);
  back.castShadow = true;
  const hump = new THREE.Mesh(new THREE.SphereGeometry(0.14, 7, 5), mat(COLORS.whale));
  hump.position.set(-0.1, 0.28, 0);
  const fluke = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.62), mat(COLORS.whale));
  fluke.position.set(-0.82, 0.16, 0);
  fluke.rotation.z = 0.5;
  fluke.castShadow = true;
  g.add(back, hump, fluke);

  const shards = [];
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(new THREE.TetrahedronGeometry(0.07), unlit(COLORS.foam, { transparent: true }));
    s.visible = false;
    g.add(s);
    shards.push(s);
  }
  g.userData.shards = shards;
  return g;
}

// ghost ship — a flat unlit silhouette far out on the far lane, night only
function buildGhostShip() {
  const g = new THREE.Group();
  const sil = unlit(COLORS.ghostShip, { transparent: true, opacity: 0.55 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.16), sil);
  hull.position.y = 0.35;
  const prow = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 4), sil);
  prow.rotation.z = -Math.PI / 2;
  prow.position.set(1.4, 0.4, 0);
  g.add(hull, prow);
  for (const mx of [0.5, -0.5]) {
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.7, 0.06), sil);
    mast.position.set(mx, 1.2, 0);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9), sil);
    sail.position.set(mx, 1.25, 0);
    g.add(mast, sail);
  }
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.22), sil);
  flag.position.set(0.5, 2.15, 0);
  g.add(flag);
  return g;
}


// passing island — a distant landmass drifting the far lane over ~90s; the
// fog hazes it into a mirage. Day or night, expanse only, never bobs.
function buildIsle() {
  const g = new THREE.Group();
  for (const [mx, mr, mh] of [[0, 4.6, 1.5], [2.6, 2.6, 1.0], [-2.8, 3.0, 1.2]]) {
    const mound = new THREE.Mesh(
      jitterGeometry(new THREE.ConeGeometry(mr, mh, 8), 0.18),
      mat(COLORS.turtleShell)
    );
    mound.position.set(mx, mh / 2 - 0.25, 0);
    g.add(mound);
  }
  const sand = new THREE.Mesh(
    jitterGeometry(new THREE.CylinderGeometry(5.6, 5.9, 0.5, 12), 0.1),
    mat(COLORS.paper)
  );
  sand.position.y = -0.1;
  g.add(sand);
  for (const [px, ph] of [[1.4, 2.2], [-1.1, 1.8]]) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, ph, 5), mat(COLORS.driftwood));
    trunk.position.set(px, ph / 2 + 0.6, 0.4);
    trunk.rotation.z = px > 0 ? -0.12 : 0.16;
    g.add(trunk);
    for (let f = 0; f < 5; f++) {
      const frond = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.22), mat(COLORS.turtle));
      frond.geometry.translate(0.45, 0, 0);
      frond.position.set(px + (px > 0 ? -0.14 : 0.2), ph + 0.55, 0.4);
      frond.rotation.y = (f / 5) * Math.PI * 2;
      frond.rotation.z = -0.35;
      g.add(frond);
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// Cast — weighted. Ghost is night-only (rerolled by day).
// ---------------------------------------------------------------------------
const CAST = {
  bottle: { w: 22, build: buildBottle, scale: 0.45, yoff: 0.03, bubble: true },
  canoe: { w: 20, build: buildCanoe, scale: 0.8, yoff: 0.05, bubble: true },
  turtle: { w: 18, build: buildTurtle, scale: 0.65, yoff: 0.06, bubble: true },
  driftwood: { w: 16, build: buildDriftwood, scale: 0.75, yoff: 0.04, bubble: true },
  barrel: { w: 14, build: buildBarrel, scale: 0.6, yoff: 0.0, bubble: true },
  fin: { w: 4, build: buildFin, scale: 0.7, yoff: 0.0, bubble: false },
  whale: { w: 2, build: buildWhale, scale: 1.1, yoff: 0.0, bubble: false },
  ghost: { w: 1, build: buildGhostShip, scale: 1.0, yoff: 0.2, bubble: false },
  isle: { w: 2, build: buildIsle, scale: 1.0, yoff: 0.1, bubble: false, far: true, noBob: true },
};
const CAST_ORDER = Object.keys(CAST);
const CAST_TOTAL = CAST_ORDER.reduce((s, k) => s + CAST[k].w, 0);

function pickKind(isNight) {
  for (let tries = 0; tries < 24; tries++) {
    let r = Math.random() * CAST_TOTAL;
    for (const k of CAST_ORDER) {
      if ((r -= CAST[k].w) < 0) {
        if (k === "ghost" && !isNight) break; // reroll ghost by day
        return k;
      }
    }
  }
  return "bottle";
}

// ---------------------------------------------------------------------------
export class Traffic {
  constructor(scene, camera, events) {
    this.scene = scene;
    this.camera = camera;
    this.events = events;
    this.bubbleLayer = document.getElementById("bubbles");
    this.draw = makeLinkDeck();

    this.active = null; // one drifter at a time
    this.timer = 0;
    this.nextGap = rand(10, 20); // first visitor arrives a touch early
    this._v = new THREE.Vector3(); // scratch for projection — no per-frame alloc
  }

  spawn(isNight) {
    let kind = pickKind(isNight);
    // far-lane cast (ghost, passing isle) doesn't fit the island disc
    while (ISLAND_PAGE && (kind === "ghost" || kind === "isle")) kind = pickKind(isNight);
    const spec = CAST[kind];
    const group = spec.build();
    const scale = spec.scale * rand(0.9, 1.08);
    group.scale.setScalar(scale);

    const dir = Math.random() < 0.5 ? 1 : -1; // -x→+x or +x→-x
    const isGhost = kind === "ghost";
    const isFar = isGhost || kind === "isle";
    const z = isFar ? GHOST_Z + rand(-1, 1) : LANE_Z + rand(-LANE_JITTER, LANE_JITTER);
    group.position.set(-dir * SPAWN_X, 0, z);
    group.rotation.y = dir > 0 ? 0 : Math.PI; // built facing +x

    this.scene.add(group);
    this.active = {
      kind,
      spec,
      group,
      dir,
      z,
      x: -dir * SPAWN_X,
      startX: -dir * SPAWN_X,
      y: 0,
      speed: kind === "isle" ? rand(0.11, 0.15) : isGhost ? rand(0.18, 0.26) : rand(0.35, 0.5),
      ph: Math.random() * Math.PI * 2,
      rollF: rand(0.5, 0.9),
      canBubble: spec.bubble,
      spoke: false,
      pauseTimer: 0, // >0 while paused at center to speak
      hovered: false,
      bubble: null,
      bubbleTimer: 0,
    };
  }

  makeBubble(a) {
    if (!this.bubbleLayer) return;
    const link = this.draw();
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    const anchor = document.createElement("a");
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noopener";
    anchor.textContent = `${link.label} →`;
    bubble.appendChild(anchor);
    bubble.addEventListener("mouseenter", () => (a.hovered = true));
    bubble.addEventListener("mouseleave", () => {
      a.hovered = false;
      a.bubbleTimer = Math.max(a.bubbleTimer, 4); // brief linger after release
    });
    anchor.addEventListener("focus", () => (a.hovered = true));
    anchor.addEventListener("blur", () => (a.hovered = false));
    this.bubbleLayer.appendChild(bubble);
    a.bubble = bubble;
    a.bubbleTimer = 14;
  }

  positionBubble(a) {
    if (!a.bubble) return;
    this._v.set(a.x, a.y + 1.2, a.z);
    this._v.project(this.camera);
    a.bubble.style.left = `${(this._v.x * 0.5 + 0.5) * window.innerWidth}px`;
    a.bubble.style.top = `${(-this._v.y * 0.5 + 0.5) * window.innerHeight}px`;
  }

  dismissBubble(a, immediate) {
    const b = a.bubble;
    if (!b) return;
    a.bubble = null;
    if (immediate) {
      b.remove();
    } else {
      b.classList.add("out");
      setTimeout(() => b.remove(), 320);
    }
  }

  remove(a) {
    this.dismissBubble(a, true);
    this.scene.remove(a.group);
    a.group.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      }
    });
    this.active = null;
    this.nextGap = rand(40, 80); // spaced out — visitors are occasions, not parades
    this.timer = 0;
  }

  update(ws, dt) {
    const t = ws.time;
    const isNight = ws.mode === "night";
    const m = ws.reduced ? 0.35 : 1; // idle-motion scale

    // Spawn cadence. Don't spawn while the plank swimmer owns the lane.
    if (!this.active) {
      this.timer += dt;
      if (this.timer >= this.nextGap && this.events.plank.phase !== "swim") {
        this.spawn(isNight);
      }
      if (!this.active) return;
    }

    const a = this.active;

    // Enter the speaking pause once, near center.
    if (a.canBubble && !a.spoke && Math.abs(a.x) < 1.8) {
      a.spoke = true;
      a.pauseTimer = 2;
    }
    if (a.pauseTimer > 0) {
      a.pauseTimer -= dt;
      if (a.pauseTimer <= 0 && !a.bubble) this.makeBubble(a);
    }

    // Drift (halted while pausing to speak or while the bubble is hovered).
    if (a.pauseTimer <= 0 && !a.hovered) a.x += a.dir * a.speed * dt;

    // Buoyancy + gentle roll on the shared swell.
    let zr = a.z;
    let yoff = a.spec.yoff;

    if (a.kind === "whale") {
      // one slow breach centered mid-lane, then submerge
      const u = (a.x - a.startX) / (-2 * a.startX);
      const s = Math.max(0, Math.exp(-Math.pow((u - 0.5) / 0.16, 2)));
      yoff = -0.2 + s * 0.42;
      const shards = a.group.userData.shards;
      const active = s > 0.45;
      for (let i = 0; i < shards.length; i++) {
        const sh = shards[i];
        if (!active) { sh.visible = false; continue; }
        sh.visible = true;
        const rise = (t * 0.9 + i * 0.14) % 1;
        sh.position.set(0.34 + (i - 3) * 0.03, 0.45 + rise * 0.9 * s, i % 2 ? 0.05 : -0.05);
        sh.scale.setScalar((1 - rise) * 0.8 * s + 0.08);
        sh.material.opacity = (1 - rise) * s;
      }
    } else if (a.kind === "fin") {
      zr = a.z + 0.16 * m * Math.sin(t * 1.1 + a.ph); // lateral slither
    }

    a.y = (a.spec.noBob ? 0 : waveHeight(a.x, zr, t)) + yoff;
    a.group.position.set(a.x, a.y, zr);
    a.group.rotation.z = a.spec.noBob ? 0 : 0.05 * m * Math.sin(t * a.rollF + a.ph);
    a.group.rotation.y = (a.dir > 0 ? 0 : Math.PI) + (a.kind === "fin" ? 0.28 * m * Math.sin(t * 1.4 + a.ph) : 0);

    this.animateIdle(a, t, m);

    // Bubble follow + linger.
    if (a.bubble) {
      this.positionBubble(a);
      if (!a.hovered) {
        a.bubbleTimer -= dt;
        if (a.bubbleTimer <= 0) this.dismissBubble(a, false);
      }
    }

    // Off the far edge → dispose, schedule the next.
    if (Math.abs(a.x) > SPAWN_X + 1) this.remove(a);
  }

  animateIdle(a, t, m) {
    const u = a.group.userData;
    switch (a.kind) {
      case "bottle":
        a.group.rotation.x = 0.4 * m * Math.sin(t * 0.7 + a.ph); // roll on its long axis
        break;
      case "canoe": {
        const swing = Math.sin(t * 2.0);
        u.paddle.rotation.z = swing * 0.6 * m; // blade crosses side to side
        u.paddle.rotation.x = 0.25 + Math.abs(Math.cos(t * 2.0)) * 0.5 * m; // dip
        u.paddler.rotation.z = -swing * 0.12 * m; // counter-lean
        break;
      }
      case "turtle": {
        const f = u.flips;
        f[0].rotation.x = 0.5 * m * Math.sin(t * 2.0);
        f[1].rotation.x = -0.5 * m * Math.sin(t * 2.0);
        f[2].rotation.x = 0.3 * m * Math.sin(t * 2.0 + 1.0);
        f[3].rotation.x = -0.3 * m * Math.sin(t * 2.0 + 1.0);
        break;
      }
      case "driftwood": {
        u.gullHead.rotation.y = 0.4 * m * Math.sin(t * 0.9 + a.ph);
        u.gullHead.position.y = 0.1 + 0.015 * m * Math.sin(t * 3.0);
        const flutter = Math.max(0, Math.sin(t * 1.3 + a.ph) - 0.9) * 6; // rare beat
        u.wings[0].rotation.x = flutter * m;
        u.wings[1].rotation.x = -flutter * m;
        break;
      }
      case "barrel":
        a.group.rotation.y = (a.dir > 0 ? 0 : Math.PI) + t * 0.35; // slow drift-spin
        break;
      default:
        break;
    }
  }
}
