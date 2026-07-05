// Musashi: a small flat-shaded figure who cycles through his day —
// zazen by the fire, reading, painting, sword kata.
import * as THREE from "three";
import { COLORS, mat } from "./world.js";

const KIMONO = 0x3a4a73; // lifted ink navy — dark enough to read as ink, light enough to keep its shape in shadow
const KIMONO_DARK = 0x1c2333;

// static keep-outs (world x, z, radius). Endpoints are exempt (several spots
// legitimately sit at an obstacle's edge: fire-side zazen, raking, praying,
// misogi at the pond rim).
const OBSTACLES = [
  { x: 0.9,  z: 0.2,  r: 1.0  }, // fire pit
  { x: -2.2, z: 5.9,  r: 1.45 }, // koi pond
  { x: 1.6,  z: -3.0, r: 1.15 }, // zen garden (a sibling moves it here)
  { x: 4.4,  z: -3.7, r: 1.15 }, // temple
  { x: -2.3, z: -1.2, r: 0.5  }, // sakura trunk
];
// the river's course (mirrors water.js's curve control points); walks must not
// wade across it — the corridor is a polyline keep-out of half-width RIVER_HALF.
const RIVER = [[-6.6, -3.4], [-5.2, -0.9], [-4.2, 2.6], [-3.3, 4.3], [-2.55, 5.5]];
const RIVER_HALF = 0.55;

// nearest point on the river polyline to (x, z), plus the local segment
// direction there — used to keep his walks out of the water.
function riverNearest(x, z) {
  let best = null, bestD2 = Infinity;
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [ax, az] = RIVER[i], [bx, bz] = RIVER[i + 1];
    const dx = bx - ax, dz = bz - az;
    const len2 = dx * dx + dz * dz || 1e-9;
    let s = ((x - ax) * dx + (z - az) * dz) / len2;
    s = Math.max(0, Math.min(1, s));
    const px = ax + s * dx, pz = az + s * dz;
    const d2 = (x - px) ** 2 + (z - pz) ** 2;
    if (d2 < bestD2) { bestD2 = d2; best = { px, pz, dx, dz }; }
  }
  best.dist = Math.sqrt(bestD2);
  return best;
}

function limb(radius, length, color) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.85, length, 5), mat(color));
  m.position.y = -length / 2;
  m.castShadow = true;
  const hand = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 1.15, 0), mat(COLORS.skin));
  hand.position.y = -length;
  hand.castShadow = true;
  g.add(m, hand);
  return g;
}

function katana() {
  const g = new THREE.Group();

  // grip centred on the group origin (the hand grips here); a thin darker ring
  // wraps it for a two-tone tsuka-ito look.
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.18, 5), mat(0x4a3b2c));
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.0245, 0.0245, 0.028, 5), mat(0x241a12));
  wrap.position.y = -0.03;

  // hexagonal tsuba (flat cylinder) seated at the top of the grip
  const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.014, 6), mat(KIMONO_DARK));
  tsuba.position.y = 0.1;

  // curved blade: three thin box segments stacked with a small relative z-tilt
  // so the edge sweeps like a real katana; tip segment narrower. length ~0.66.
  const segLen = 0.22, tilt = 0.065; // ~3.7° per joint
  const widths = [0.045, 0.041, 0.033];
  let joint = new THREE.Group();
  joint.position.y = 0.107; // sit just above the tsuba
  g.add(joint);
  for (let i = 0; i < widths.length; i++) {
    const seg = new THREE.Group();
    if (i > 0) seg.position.y = segLen;
    seg.rotation.z = tilt;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, segLen, widths[i]), mat(0xcfd2d6));
    blade.position.y = segLen / 2;
    blade.castShadow = true;
    seg.add(blade);
    joint.add(seg);
    joint = seg;
  }

  g.add(grip, wrap, tsuba);
  return g;
}

function scabbard(length) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.024, length, 5), mat(KIMONO_DARK));
  m.castShadow = true;
  return m;
}

export class Musashi {
  constructor(parent, spots) {
    this.spots = spots; // { fire, tree, easel, kata } — each { position, facing }
    this.root = new THREE.Group();

    // body: kimono skirt + chest + head, all pivoting around this.body
    this.body = new THREE.Group();

    this.skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.31, 0.6, 6), mat(KIMONO));
    this.skirt.position.y = 0.3;
    this.skirt.castShadow = true;

    this.chest = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.34, 6), mat(KIMONO));
    this.chest.position.y = 0.72;
    this.chest.castShadow = true;

    this.sash = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.19, 0.08, 6), mat(COLORS.vermillion));
    this.sash.position.y = 0.57;

    this.headGroup = new THREE.Group();
    this.headGroup.position.y = 0.94;
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.145, 1), mat(COLORS.skin));
    head.castShadow = true;
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2.6),
      mat(KIMONO_DARK)
    );
    hair.position.y = 0.02;
    const topknot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.1, 5), mat(KIMONO_DARK));
    topknot.position.set(0, 0.17, -0.04);
    topknot.rotation.x = -0.5;
    this.headGroup.add(head, hair, topknot);

    this.armL = limb(0.045, 0.36, KIMONO);
    this.armL.position.set(-0.17, 0.86, 0);
    this.armR = limb(0.045, 0.36, KIMONO);
    this.armR.position.set(0.17, 0.86, 0);

    // the two swords worn at the left hip
    this.wornKatana = scabbard(0.52);
    this.wornKatana.position.set(-0.12, 0.5, -0.04);
    this.wornKatana.rotation.z = 1.3;
    this.wornKatana.rotation.y = -0.7; // tucked, running hip to back
    this.wornWakizashi = scabbard(0.34);
    this.wornWakizashi.position.set(-0.11, 0.58, 0.03);
    this.wornWakizashi.rotation.z = 1.35;
    this.wornWakizashi.rotation.y = -0.6;

    // the drawn katana, parented to the right hand; hidden unless doing kata
    this.heldKatana = katana();
    this.heldKatana.position.y = -0.36;
    this.heldKatana.visible = false;
    this.armR.add(this.heldKatana);

    this.body.add(
      this.skirt, this.chest, this.sash, this.headGroup,
      this.armL, this.armR, this.wornKatana, this.wornWakizashi
    );
    this.root.add(this.body);

    // ---- props (each lives at its spot; visibility toggled by activity) ----

    this.scroll = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.015, 0.14), mat(0xfdfaf2));
    this.scroll.visible = false;
    this.root.add(this.scroll);

    this.easel = new THREE.Group();
    const table = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.38), mat(COLORS.trunk));
    table.position.y = 0.16;
    table.castShadow = true;
    for (const [lx, lz] of [[-0.24, -0.15], [0.24, -0.15], [-0.24, 0.15], [0.24, 0.15]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.05), mat(COLORS.trunk));
      leg.position.set(lx, 0.08, lz);
      this.easel.add(leg);
    }
    const canvas = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.01, 0.28), mat(0xfdfaf2));
    canvas.position.y = 0.2;
    this.easel.add(table, canvas);
    // ink strokes appear one by one during a painting session
    this.strokes = [];
    const strokeMat = () =>
      new THREE.MeshBasicMaterial({ color: KIMONO_DARK, transparent: true, opacity: 0 });
    const strokeShapes = [
      [0.16, 0.02, -0.06, -0.02, 0.4],   // w, h, x, z, rot
      [0.1, 0.018, 0.08, 0.03, -0.3],
      [0.05, 0.05, -0.1, 0.06, 0],
      [0.14, 0.016, 0.02, 0.08, 0.15],
      [0.03, 0.03, 0.12, -0.05, 0],
    ];
    for (const [w, h, x, z, rot] of strokeShapes) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), strokeMat());
      s.rotation.x = -Math.PI / 2;
      s.rotation.z = rot;
      s.position.set(x, 0.212, z);
      this.strokes.push(s);
      this.easel.add(s);
    }
    this.easel.visible = false;
    this.root.add(this.easel);

    // tea set: kettle by the fire spot, cup held
    this.tea = new THREE.Group();
    const kettle = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), mat(0x4a4038));
    kettle.position.y = 0.07;
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.1, 5), mat(0x4a4038));
    spout.position.set(0.09, 0.09, 0);
    spout.rotation.z = -0.9;
    this.tea.add(kettle, spout);
    this.tea.visible = false;
    this.root.add(this.tea);
    this.cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.05, 6), mat(0xfdfaf2));
    this.cup.visible = false;
    this.armR.add(this.cup);
    this.cup.position.y = -0.38;

    // rake: pole + toothed head, held in both hands while raking
    this.rake = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.95, 5), mat(COLORS.trunk));
    const rakeHead = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.05), mat(COLORS.trunk));
    rakeHead.position.y = -0.475;
    this.rake.add(pole, rakeHead);
    this.rake.visible = false;
    this.rake.position.y = -0.3;
    this.rake.rotation.x = 0.5;
    this.armR.add(this.rake);

    // bokken blank + carving knife
    this.bokken = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), mat(0xb59a5e));
    this.bokken.visible = false;
    this.bokken.position.y = -0.38;
    this.bokken.rotation.x = 1.2;
    this.armL.add(this.bokken);
    this.knife = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.12, 0.03), mat(0xcfd2d6));
    this.knife.visible = false;
    this.knife.position.y = -0.38;
    this.armR.add(this.knife);

    // shinobue: a thin bamboo tube with a couple of darker binding rings, held
    // to the lips during flute. parented to the right hand like the cup/knife.
    this.flute = new THREE.Group();
    const bamboo = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 6), mat(0x8a9a5b));
    for (const ry of [0.09, -0.06]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 6), mat(0x5c6838));
      ring.position.y = ry;
      this.flute.add(ring);
    }
    this.flute.add(bamboo);
    this.flute.visible = false;
    // laid horizontal across the mouth; local pose eyeballed off the tea-cup
    // arm numbers so the tube reads as touching the lips when the arms are up.
    this.flute.position.set(-0.02, -0.33, 0);
    this.flute.rotation.set(0, 0, 1.5);
    this.armR.add(this.flute);

    this.hideProps = () => {
      this.tea.visible = this.cup.visible = this.rake.visible =
        this.bokken.visible = this.knife.visible = this.flute.visible = false;
    };

    parent.add(this.root);

    this.activities = ["zazen", "kata", "reading", "painting", "tea", "raking", "temple", "misogi", "carving", "bridge", "flute"];
    this.SPOT_FOR = {
      zazen: "fire", tea: "fire", kata: "kata", reading: "tree", carving: "tree",
      painting: "easel", raking: "garden", temple: "temple", misogi: "misogi", bridge: "bridge",
      flute: "flute",
    };
    const q = new URLSearchParams(location.search);
    this.current = this.activities.includes(q.get("activity")) ? q.get("activity") : "zazen";
    this.activityTime = 0;
    const dq = Number(q.get("duration"));
    this.activityDuration = q.has("duration") && !isNaN(dq) && dq > 0 ? dq : 75;
    this.phase = "settled"; // settled | walking | settling
    this.walk = null; // { curve, length, dist, target }
    this._dodge = 0; // eased sidestep offset (m) around a passing traveler
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.applyActivity(this.current);
  }

  get activity() {
    return this.current;
  }

  // hard-set the figure into an activity's base pose and location
  applyActivity(name) {
    const spot = this.spots[this.SPOT_FOR[name]];
    this.root.position.copy(spot.position);
    this.root.rotation.y = spot.facing;

    this.scroll.visible = name === "reading";
    this.easel.visible = name === "painting";
    this.heldKatana.visible = name === "kata";
    this.hideProps();

    const seated = !["kata", "misogi", "bridge", "raking"].includes(name);
    this.body.position.y = seated ? -0.24 : 0;
    this.skirt.scale.set(seated ? 1.25 : 1, seated ? 0.75 : 1, seated ? 1.25 : 1);

    // neutral joints; per-frame animation layers on top of these
    this.armL.rotation.set(0, 0, 0.12);
    this.armR.rotation.set(0, 0, -0.12);
    this.headGroup.rotation.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);

    if (name === "zazen") {
      this.armL.rotation.set(0.55, 0, 0.5);
      this.armR.rotation.set(0.55, 0, -0.5);
      this.headGroup.rotation.x = 0.14;
    } else if (name === "reading") {
      this.armL.rotation.set(0.9, 0, 0.25);
      this.armR.rotation.set(0.9, 0, -0.25);
      this.headGroup.rotation.x = 0.42;
      // scroll and easel are children of root, so they take local coordinates
      this.scroll.position.set(0, 0.52, 0.32);
      this.scroll.rotation.set(0, 0, 0);
    } else if (name === "painting") {
      this.armL.rotation.set(0.35, 0, 0.2);
      this.armR.rotation.set(1.15, 0, -0.15);
      this.headGroup.rotation.x = 0.38;
      for (const s of this.strokes) s.material.opacity = 0;
      this.easel.position.set(0, 0, 0.55);
      this.easel.rotation.set(0, 0, 0);
    } else if (name === "kata") {
      this.armL.rotation.set(1.15, 0, 0.35);
      this.armR.rotation.set(1.15, 0, -0.35);
    } else if (name === "tea") {
      this.tea.visible = true;
      this.tea.position.set(0.28, 0, 0.1);
      this.cup.visible = true;
      this.armL.rotation.set(0.5, 0, 0.4);
      this.armR.rotation.set(0.85, 0, -0.3);
      this.headGroup.rotation.x = 0.1;
    } else if (name === "raking") {
      this.rake.visible = true;
      this.armL.rotation.set(0.75, 0, 0.3);
      this.armR.rotation.set(0.75, 0, -0.3);
      this.headGroup.rotation.x = 0.3;
    } else if (name === "temple") {
      this.headGroup.rotation.x = 0.2; // kneeling; bow handled per-frame
      this.armL.rotation.set(0.4, 0, 0.35);
      this.armR.rotation.set(0.4, 0, -0.35);
    } else if (name === "misogi") {
      // standing beneath the cascade, hands together in gassho
      this.body.position.y = 0;
      this.skirt.scale.set(1, 1, 1);
      this.armL.rotation.set(1.05, 0, 0.55);
      this.armR.rotation.set(1.05, 0, -0.55);
      this.headGroup.rotation.x = 0.12;
    } else if (name === "carving") {
      this.bokken.visible = this.knife.visible = true;
      this.armL.rotation.set(0.8, 0, 0.3);
      this.armR.rotation.set(0.95, 0, -0.25);
      this.headGroup.rotation.x = 0.4;
    } else if (name === "bridge") {
      this.body.position.y = 0;
      this.skirt.scale.set(1, 1, 1);
      this.armL.rotation.set(0.15, 0, 0.18);
      this.armR.rotation.set(0.15, 0, -0.18);
      this.headGroup.rotation.x = 0.35; // watching the water below
    } else if (name === "flute") {
      // seated on the rock, flute held across to the lips: right arm raised
      // high, left arm up to meet it, head tilted a touch into the tube
      this.flute.visible = true;
      this.armR.rotation.set(1.5, 0, -0.5);
      this.armL.rotation.set(1.35, 0, 0.55);
      this.headGroup.rotation.set(0.05, 0, 0.06);
    }
  }

  pickNext(ws) {
    const NIGHT_SET = ["zazen", "tea", "reading", "flute"];
    let pool = ws && ws.night > 0.5 ? NIGHT_SET : this.activities;
    pool = pool.filter((a) => a !== this.current);
    // several activities share a spot (zazen/tea @ fire, reading/carving @ tree) —
    // exclude those too, since a same-spot "walk" degenerates to a zero-length
    // path (NaN side vector) and there's nowhere to visibly walk to anyway.
    pool = pool.filter((a) => this.SPOT_FOR[a] !== this.SPOT_FOR[this.current]);
    if (ws && ws.season === "winter") pool = pool.filter((a) => a !== "misogi");
    return pool[Math.floor(Math.random() * pool.length)];
  }

  startWalk(target) {
    const from = this.root.position.clone();
    const to = this.spots[this.SPOT_FOR[target]].position.clone();
    const delta = to.clone().sub(from);
    // guard against a degenerate (near-zero) delta producing a NaN side vector
    const side = delta.lengthSq() > 1e-6
      ? new THREE.Vector3(-delta.z, 0, delta.x).normalize()
      : new THREE.Vector3(1, 0, 0);
    const pts = [from];
    for (const k of [0.35, 0.68]) { // two gently jittered waypoints
      pts.push(from.clone().lerp(to, k).add(side.clone().multiplyScalar((Math.random() - 0.5) * 1.3)));
    }
    pts.push(to);

    // walk AROUND the keep-outs: shove any intermediate waypoint that falls
    // inside a circle radially out to its rim, and any that falls in the river
    // corridor out perpendicular to the water. endpoints are left alone — the
    // fire-side / pond-rim spots legitimately stand at an obstacle's edge.
    const pushCircle = (p, o, radius) => {
      const off = new THREE.Vector2(p.x - o.x, p.z - o.z);
      if (off.lengthSq() < 1e-8) off.set(1, 0);
      off.setLength(radius);
      p.x = o.x + off.x;
      p.z = o.z + off.y;
    };
    // push out of the river to `half`, perpendicular to the nearest segment, on
    // the side the point already sits; if it's ~on the line use the eastward
    // (positive-x) perpendicular — every spot lies east of the water, so this
    // resolves consistently.
    const pushRiver = (p, half) => {
      const n = riverNearest(p.x, p.z);
      let ox = p.x - n.px, oz = p.z - n.pz;
      if (ox * ox + oz * oz < 1e-8) {
        ox = -n.dz; oz = n.dx; // perpendicular to the segment
        if (ox < 0) { ox = -ox; oz = -oz; } // choose the eastward normal
      }
      const len = Math.hypot(ox, oz) || 1e-9;
      p.x = n.px + (ox / len) * half;
      p.z = n.pz + (oz / len) * half;
    };
    for (let i = 1; i < pts.length - 1; i++) {
      for (const o of OBSTACLES) {
        if (Math.hypot(pts[i].x - o.x, pts[i].z - o.z) < o.r) pushCircle(pts[i], o, o.r);
      }
      if (riverNearest(pts[i].x, pts[i].z).dist < RIVER_HALF) pushRiver(pts[i], RIVER_HALF);
    }
    let curve = new THREE.CatmullRomCurve3(pts);
    // CatmullRom overshoots its waypoints, so verify by sampling: if the swept
    // path still bites into a circle (< r·0.6) or the river corridor (< 0.35),
    // ignoring the endpoint tails, nudge the nearest intermediate waypoint
    // further clear of the worst offender and rebuild. a few iterations suffice.
    for (let iter = 0; iter < 4; iter++) {
      let worst = null; // { q, sev, river, o }
      for (let s = 0; s <= 24; s++) {
        const u = s / 24;
        if (u < 0.1 || u > 0.9) continue;
        const q = curve.getPoint(u);
        for (const o of OBSTACLES) {
          const sev = o.r * 0.6 - Math.hypot(q.x - o.x, q.z - o.z);
          if (sev > 0 && (!worst || sev > worst.sev)) worst = { q, sev, river: false, o };
        }
        const sev = 0.35 - riverNearest(q.x, q.z).dist;
        if (sev > 0 && (!worst || sev > worst.sev)) worst = { q, sev, river: true };
      }
      if (!worst) break;
      let wi = 1, wd = Infinity;
      for (let i = 1; i < pts.length - 1; i++) {
        const d = Math.hypot(pts[i].x - worst.q.x, pts[i].z - worst.q.z);
        if (d < wd) { wd = d; wi = i; }
      }
      if (worst.river) {
        const cur = riverNearest(pts[wi].x, pts[wi].z).dist;
        pushRiver(pts[wi], Math.max(RIVER_HALF, cur) + 0.3);
      } else {
        const o = worst.o;
        const cur = Math.hypot(pts[wi].x - o.x, pts[wi].z - o.z);
        pushCircle(pts[wi], o, Math.max(o.r, cur) + 0.3);
      }
      curve = new THREE.CatmullRomCurve3(pts);
    }
    this.walk = { curve, length: curve.getLength(), dist: 0, target };
    this._dodge = 0; // no leftover sidestep from a previous walk
    this.phase = "walking";
    this.scroll.visible = this.easel.visible = this.heldKatana.visible = false;
    this.hideProps();
    // stand up for the road
    this.body.position.y = 0;
    this.skirt.scale.set(1, 1, 1);
    this.armL.rotation.set(0, 0, 0.12);
    this.armR.rotation.set(0, 0, -0.12);
    this.headGroup.rotation.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
    if (this.onWalkStart) this.onWalkStart(this.SPOT_FOR[target]);
  }

  updateWalk(dt, t, avoid = null) {
    const w = this.walk;
    w.dist = Math.min(w.length, w.dist + dt * 0.85); // graceful pace, ~m/s
    const u = w.dist / w.length;
    const p = w.curve.getPointAt(Math.min(1, u));
    const tangent = w.curve.getTangentAt(Math.min(1, u));
    // soft sidestep around a passing traveler: shift perpendicular to the walk
    // by up to ~0.54m, on the side that moves him away. eased so it doesn't pop
    // when the traveler appears/vanishes; applied to the rendered position only
    // (the curve is untouched) so he flows around and rejoins his path.
    let target = 0;
    if (avoid) {
      const d = Math.hypot(p.x - avoid.x, p.z - avoid.z);
      if (d < 0.9) {
        const px = -tangent.z, pz = tangent.x; // unit perpendicular to the walk
        const side = Math.sign((p.x - avoid.x) * px + (p.z - avoid.z) * pz) || 1;
        target = side * (0.9 - d) * 0.6;
      }
    }
    this._dodge += (target - this._dodge) * Math.min(1, dt * 4);
    const ox = -tangent.z * this._dodge, oz = tangent.x * this._dodge;
    this.root.position.set(p.x + ox, Math.abs(Math.sin(t * 6)) * 0.025, p.z + oz);
    this.root.rotation.y = Math.atan2(tangent.x, tangent.z);
    this.body.rotation.z = Math.sin(t * 6) * 0.03;
    this.armL.rotation.x = Math.sin(t * 6) * 0.35;
    this.armR.rotation.x = -Math.sin(t * 6) * 0.35;
    if (u >= 1) {
      this.current = w.target;
      this.walk = null;
      this.applyActivity(this.current);
      this.activityTime = 0;
      this.phase = "settling";
      if (this.onActivityChange) this.onActivityChange(this.current);
    }
  }

  update(dt, t, ws, avoid = null) {
    this.activityTime += dt;

    if (this.phase === "settled" && this.activityTime > this.activityDuration) {
      const next = this.pickNext(ws);
      if (this.reducedMotion) { // old fade behavior for reduced motion
        this.current = next;
        this.applyActivity(next);
        this.activityTime = 0;
        if (this.onActivityChange) this.onActivityChange(next);
      } else {
        this.startWalk(next);
      }
    }
    if (this.phase === "walking") { this.updateWalk(dt, t, avoid); return; }
    if (this.phase === "settling") { this.phase = "settled"; }

    // ---- per-activity idle motion ----
    const breathe = Math.sin(t * 1.4) * 0.015;
    this.chest.scale.setScalar(1 + breathe);

    const a = this.activity;
    if (a === "zazen") {
      this.body.rotation.x = 0.02 + Math.sin(t * 0.7) * 0.012; // slow sway
    } else if (a === "reading") {
      this.headGroup.rotation.y = Math.sin(t * 0.25) * 0.12; // eyes track the scroll
    } else if (a === "painting") {
      // the brush hand works in small circles; strokes appear over the session
      this.armR.rotation.x = 1.15 + Math.sin(t * 2.1) * 0.1;
      this.armR.rotation.z = -0.15 + Math.cos(t * 2.1) * 0.08;
      const progress = this.activityTime / this.activityDuration;
      this.strokes.forEach((s, i) => {
        const appearAt = (i + 1) / (this.strokes.length + 1);
        if (progress > appearAt) {
          s.material.opacity = Math.min(0.85, s.material.opacity + dt * 0.5);
        }
      });
    } else if (a === "kata") {
      // a deliberate 8s form: chudan hold → rise to jodan → poise → cut →
      // follow-through → return. arm angles run chudan(1.10)→jodan(-0.95)→low(1.62).
      const CHUDAN = 2.2, RISE = 1.4, POISE = 0.7, CUT = 0.3, FOLLOW = 1.2;
      const RETURN = 8.0 - (CHUDAN + RISE + POISE + CUT + FOLLOW);
      const A_CHUDAN = 1.10, A_JODAN = -0.95, A_LOW = 1.62;
      const k = this.activityTime % 8.0;
      let armX, tip = 0, pitch = 0, hipY = 0, headX = 0;
      if (k < CHUDAN) { // level, near-still, breathing through the tip
        armX = A_CHUDAN;
        tip = Math.sin(t * 1.2) * 0.03;
      } else if (k < CHUDAN + RISE) { // lift overhead, head up, body straightens
        const e = easeInOut((k - CHUDAN) / RISE);
        armX = A_CHUDAN + (A_JODAN - A_CHUDAN) * e;
        headX = -0.12 * e;
        pitch = -0.05 * e;
      } else if (k < CHUDAN + RISE + POISE) { // poised — total stillness
        armX = A_JODAN; headX = -0.12; pitch = -0.05;
      } else if (k < CHUDAN + RISE + POISE + CUT) { // the cut
        const e = easeIn((k - CHUDAN - RISE - POISE) / CUT);
        armX = A_JODAN + (A_LOW - A_JODAN) * e;
        headX = -0.12 + 0.30 * e;
        pitch = -0.05 + 0.17 * e; // pitches ~0.12 forward net
        hipY = Math.sin(e * Math.PI) * 0.15; // a slight hip pivot, out and back
      } else if (k < CHUDAN + RISE + POISE + CUT + FOLLOW) { // exhale, settle upright
        const e = (k - CHUDAN - RISE - POISE - CUT) / FOLLOW;
        armX = A_LOW;
        pitch = 0.12 * (1 - easeInOut(e));
        headX = 0.18 * (1 - e);
      } else { // return to chudan
        const e = easeInOut((k - CHUDAN - RISE - POISE - CUT - FOLLOW) / RETURN);
        armX = A_LOW + (A_CHUDAN - A_LOW) * e;
      }
      this.armL.rotation.x = armX + tip;
      this.armR.rotation.x = armX + tip;
      // bias both hands inward so they read as gripping the hilt together
      this.armL.rotation.z = 0.42;
      this.armR.rotation.z = -0.18;
      this.body.rotation.x = pitch;
      this.body.rotation.y = hipY; // derived from phase, returns to 0 — no drift
      this.headGroup.rotation.x = headX;
    } else if (a === "tea") {
      const sip = Math.max(0, Math.sin(t * 0.45)); // slow raise-and-sip
      this.armR.rotation.x = 0.85 + sip * 0.5;
      this.headGroup.rotation.x = 0.1 - sip * 0.12;
    } else if (a === "raking") {
      const push = Math.sin(t * 0.9);
      this.body.rotation.x = 0.06 + push * 0.05;
      this.armL.rotation.x = 0.75 + push * 0.2;
      this.armR.rotation.x = 0.75 + push * 0.2;
    } else if (a === "temple") {
      // a deep bow every ~12s: down 2s, hold 3s, up 2s
      const c = (this.activityTime % 12) / 12;
      let bow = 0;
      if (c < 0.17) bow = easeInOut(c / 0.17);
      else if (c < 0.42) bow = 1;
      else if (c < 0.58) bow = 1 - easeInOut((c - 0.42) / 0.16);
      this.body.rotation.x = bow * 0.7;
      this.headGroup.rotation.x = 0.2 + bow * 0.35;
    } else if (a === "misogi") {
      this.body.rotation.x = Math.sin(t * 0.5) * 0.008; // near-stillness under the falls
    } else if (a === "carving") {
      const stroke = Math.sin(t * 3.2);
      this.armR.rotation.x = 0.95 + Math.max(0, stroke) * 0.22; // whittling pushes
    } else if (a === "bridge") {
      this.headGroup.rotation.y = Math.sin(t * 0.2) * 0.15; // following the current
    } else if (a === "flute") {
      this.body.rotation.z = Math.sin(t * 0.4) * 0.01; // a slow, quiet sway
      this.armL.rotation.x = 1.35 + Math.sin(t * 12.5) * 0.02; // implied fingering, ~2 Hz
    }
  }
}

function easeInOut(x) {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}
function easeIn(x) {
  return x * x;
}
