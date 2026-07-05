// A small paper-white cat with an ember-orange patch that naps around the
// diorama — breathing, flicking an ear, occasionally lifting its head toward
// the road, and now and then padding off to a new sunny spot.
import * as THREE from "three";
import { mat, jitterGeometry } from "./world.js";

const WHITE = 0xfdfaf2;
const PATCH = 0xd96f38; // ember orange, palette-matched to the koi

// four napping spots (world coords), each near a landmark but clear of
// Musashi's activity spots, the road line, the river, and the fire.
const SPOTS = [
  new THREE.Vector3(3.75, 0, -3.05), // temple steps
  new THREE.Vector3(-2.9, 0, -1.8),  // beneath the sakura
  new THREE.Vector3(2.0, 0, -3.2),   // zen-garden edge
  new THREE.Vector3(-5.0, 0, 3.1),   // river bank near the bridge
];

// stretches of the road the cat glances toward when a traveler might pass
const ROAD_PTS = [
  new THREE.Vector3(-4.2, 0, 2.6),
  new THREE.Vector3(-0.8, 0, 3.0),
  new THREE.Vector3(2.8, 0, 2.7),
  new THREE.Vector3(5.4, 0, 1.9),
];

// mirrors the Fire's world position (x, z); relocation paths detour around it
const FIRE = new THREE.Vector2(0.9, 0.2);
const FIRE_KEEP = 1.0;
const FIRE_DETOUR = 1.2;

const HEAD_REST = 0.25; // head tilt while curled (chin toward the body)
const HEAD_ALERT = -0.12; // head lifted, watching the road

const rand = (a, b) => a + Math.random() * (b - a);
const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

// if the straight line from->to grazes the fire, return one detour waypoint
// shoved radially out to FIRE_DETOUR; otherwise null. (same trick as musashi.js)
function fireDetour(from, to) {
  const dx = to.x - from.x, dz = to.z - from.z;
  const l2 = dx * dx + dz * dz;
  let u = l2 > 1e-8 ? ((FIRE.x - from.x) * dx + (FIRE.y - from.z) * dz) / l2 : 0;
  u = Math.max(0, Math.min(1, u));
  const cx = from.x + dx * u, cz = from.z + dz * u;
  if (Math.hypot(cx - FIRE.x, cz - FIRE.y) >= FIRE_KEEP) return null;
  let ox = cx - FIRE.x, oz = cz - FIRE.y;
  const ol = Math.hypot(ox, oz) || 1;
  return new THREE.Vector3(FIRE.x + (ox / ol) * FIRE_DETOUR, 0, FIRE.y + (oz / ol) * FIRE_DETOUR);
}

export class Cat {
  constructor(parent) {
    this.root = new THREE.Group();
    const spot = SPOTS[Math.floor(Math.random() * SPOTS.length)];
    this.root.position.copy(spot);
    this.root.rotation.y = Math.random() * Math.PI * 2;
    this.currentSpot = spot.clone();

    // body: a flattened, curled round mass (breathing scales this group)
    this.body = new THREE.Group();
    this.body.position.y = 0.085;
    const bodyGeo = jitterGeometry(new THREE.IcosahedronGeometry(0.13, 0).toNonIndexed(), 0.018);
    bodyGeo.scale(1.25, 0.6, 1.0);
    const bodyMesh = new THREE.Mesh(bodyGeo, mat(WHITE));
    bodyMesh.castShadow = true;
    this.body.add(bodyMesh);
    // the ember patch, riding on the upper flank
    const patchGeo = jitterGeometry(new THREE.IcosahedronGeometry(0.09, 0).toNonIndexed(), 0.014);
    patchGeo.scale(1.2, 0.55, 1.0);
    const patch = new THREE.Mesh(patchGeo, mat(PATCH));
    patch.position.set(0.045, 0.05, -0.02);
    patch.castShadow = true;
    this.body.add(patch);
    this.root.add(this.body);

    // head: rests at the front of the curl; a separate group so it can lift/turn
    this.head = new THREE.Group();
    this.head.position.set(0, 0.10, 0.12);
    this.head.rotation.x = HEAD_REST;
    const headMesh = new THREE.Mesh(
      jitterGeometry(new THREE.IcosahedronGeometry(0.075, 0).toNonIndexed(), 0.01),
      mat(WHITE)
    );
    headMesh.castShadow = true;
    this.head.add(headMesh);
    this.ears = [];
    for (const ex of [-0.042, 0.042]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.055, 4), mat(WHITE));
      ear.position.set(ex, 0.07, -0.005);
      ear.rotation.y = Math.PI / 4;
      ear.castShadow = true;
      this.head.add(ear);
      this.ears.push(ear);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.03, 4), mat(PATCH));
      inner.position.set(ex, 0.075, 0.008);
      inner.rotation.y = Math.PI / 4;
      this.head.add(inner);
    }
    this.earL = this.ears[0];
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.02, 4), mat(PATCH));
    nose.position.set(0, 0.0, 0.072);
    nose.rotation.x = Math.PI / 2;
    this.head.add(nose);
    this.root.add(this.head);

    // tail: two tapered segments curling forward alongside the body; the tip is
    // its own group so it can curl independently
    this.tail = new THREE.Group();
    this.tail.position.set(0.05, 0.05, -0.05);
    const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.02, 0.15, 5), mat(WHITE));
    seg1.rotation.z = -Math.PI / 2;
    seg1.position.set(0.075, 0, 0);
    seg1.castShadow = true;
    this.tail.add(seg1);
    this.tailTip = new THREE.Group();
    this.tailTip.position.set(0.15, 0, 0);
    const seg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.012, 0.14, 5), mat(WHITE));
    seg2.rotation.z = -Math.PI / 2;
    seg2.rotation.y = -0.9; // curl toward the front
    seg2.position.set(0.05, 0, 0.05);
    seg2.castShadow = true;
    this.tailTip.add(seg2);
    this.tail.add(this.tailTip);
    this.root.add(this.tail);

    parent.add(this.root);

    // ---- state machine ----
    this.state = "napping"; // napping | alert | relocate
    this.stateT = 0;
    this.tAlert = 0;
    this.tReloc = 0;
    this.alertEvery = rand(45, 90);
    this.relocEvery = rand(150, 240);
    this.alertDur = 0;
    this.alertYaw = 0;
    this.headLift = HEAD_REST; // eased head tilt carried across nap frames
    this.headYaw = 0;
    // idle fidgets
    this.flick = 0; this.flickT = 0; this.nextFlick = rand(8, 20);
    this.tailCurl = 0; this.tailT = 0; this.nextTailCurl = rand(25, 45);
    this.path = null;
  }

  update(dt, t, ws) {
    const night = !!(ws && ws.night > 0.5);

    // breathing continues even while asleep (~0.24 Hz, ~1.5%)
    this.body.scale.setScalar(1 + Math.sin(t * 1.5) * 0.015);

    if (this.state === "relocate") { this._walk(dt, t); return; }

    this._fidget(dt, t);

    if (this.state === "alert") { this._alert(dt); return; }

    // napping: ease the head back to rest
    this.stateT += dt;
    const k = Math.min(1, dt * 3);
    this.headLift += (HEAD_REST - this.headLift) * k;
    this.headYaw += (0 - this.headYaw) * k;
    this.head.rotation.x = this.headLift;
    this.head.rotation.y = this.headYaw;

    if (night) return; // asleep at night: no alerts or relocations

    this.tAlert += dt;
    this.tReloc += dt;
    if (this.tReloc > this.relocEvery) { this._startWalk(); return; }
    if (this.tAlert > this.alertEvery) { this._startAlert(); }
  }

  _fidget(dt, t) {
    // quick ear flick every 8–20s
    this.flickT += dt;
    if (this.flick <= 0 && this.flickT > this.nextFlick) {
      this.flick = 0.4; this.flickT = 0; this.nextFlick = rand(8, 20);
    }
    if (this.flick > 0) {
      this.flick -= dt;
      this.earL.rotation.z = Math.sin((1 - Math.max(0, this.flick) / 0.4) * Math.PI) * 0.6;
    } else {
      this.earL.rotation.z = 0;
    }
    // rare, slow tail-tip curl
    this.tailT += dt;
    if (this.tailCurl <= 0 && this.tailT > this.nextTailCurl) {
      this.tailCurl = 3.0; this.tailT = 0; this.nextTailCurl = rand(25, 45);
    }
    if (this.tailCurl > 0) {
      this.tailCurl -= dt;
      this.tailTip.rotation.y = -Math.sin((1 - Math.max(0, this.tailCurl) / 3.0) * Math.PI) * 0.8;
    }
    this.tail.rotation.y = Math.sin(t * 0.5) * 0.05; // gentle constant sway
  }

  _startAlert() {
    this.state = "alert";
    this.stateT = 0;
    this.alertDur = rand(6, 10);
    // aim the head at the nearest stretch of road
    let best = ROAD_PTS[0], bd = Infinity;
    for (const p of ROAD_PTS) {
      const d = (p.x - this.root.position.x) ** 2 + (p.z - this.root.position.z) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    let y = Math.atan2(best.x - this.root.position.x, best.z - this.root.position.z) - this.root.rotation.y;
    y = Math.atan2(Math.sin(y), Math.cos(y)); // wrap to [-PI, PI]
    this.alertYaw = THREE.MathUtils.clamp(y, -1.3, 1.3);
  }

  _alert(dt) {
    this.stateT += dt;
    // ease attention in over 1.2s, hold, ease out over the last 1.2s
    const inA = Math.min(1, this.stateT / 1.2);
    const outA = Math.min(1, Math.max(0, (this.alertDur - this.stateT) / 1.2));
    const e = easeInOut(Math.min(inA, outA));
    this.head.rotation.x = HEAD_REST + (HEAD_ALERT - HEAD_REST) * e;
    this.head.rotation.y = this.alertYaw * e;
    this.headLift = this.head.rotation.x; // continuity for the nap ease-back
    this.headYaw = this.head.rotation.y;
    if (this.stateT >= this.alertDur) {
      this.state = "napping";
      this.stateT = 0;
      this.tAlert = 0;
      this.alertEvery = rand(45, 90);
    }
  }

  _startWalk() {
    const pool = SPOTS.filter((s) => s.distanceToSquared(this.currentSpot) > 0.01);
    const target = pool[Math.floor(Math.random() * pool.length)];
    const from = this.root.position.clone();
    const pts = [from];
    const det = fireDetour(from, target);
    if (det) pts.push(det);
    pts.push(target.clone());
    const segs = [];
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const len = pts[i].distanceTo(pts[i + 1]);
      segs.push(len); total += len;
    }
    this.path = { pts, segs, total, dist: 0, target };
    this.state = "relocate";
    this.stateT = 0;
    // drop fidget poses; head faces forward for the walk
    this.earL.rotation.z = 0;
    this.tailTip.rotation.y = 0;
    this.head.rotation.set(0.05, 0, 0);
  }

  _walk(dt, t) {
    const w = this.path;
    w.dist = Math.min(w.total, w.dist + dt * 0.3); // ~0.3 world-units/s
    let d = w.dist, i = 0;
    while (i < w.segs.length - 1 && d > w.segs[i]) { d -= w.segs[i]; i++; }
    const a = w.pts[i], b = w.pts[i + 1];
    const f = w.segs[i] > 1e-6 ? d / w.segs[i] : 1;
    // subtle walk bob + body sway, derived from time so nothing accumulates
    this.root.position.set(a.x + (b.x - a.x) * f, Math.abs(Math.sin(t * 8)) * 0.02, a.z + (b.z - a.z) * f);
    this.root.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    this.body.rotation.z = Math.sin(t * 8) * 0.05;
    this.head.rotation.x = 0.05 + Math.sin(t * 8) * 0.03;
    if (w.dist >= w.total) {
      // arrived: settle, curl back into a nap
      this.root.position.set(w.target.x, 0, w.target.z);
      this.currentSpot.copy(w.target);
      this.body.rotation.z = 0;
      this.head.rotation.set(HEAD_REST, 0, 0);
      this.headLift = HEAD_REST; this.headYaw = 0;
      this.path = null;
      this.state = "napping";
      this.stateT = 0;
      this.tReloc = 0; this.tAlert = 0;
      this.relocEvery = rand(150, 240);
    }
  }
}
