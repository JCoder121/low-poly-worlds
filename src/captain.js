// Captain — a Jack-shaped figure (tricorn, faded navy coat) who drifts through
// nine deck routines aboard the brig. He is a child of ship.group, so he lives
// in LOCAL deck coordinates: the ship's bob/pitch/roll are inherited for free
// and he never samples the waves himself. State machine mirrors musashi.js —
// settle → walk (arc-length, keep-out detours) → settle — with a plank-watch
// interrupt layered on top.
import * as THREE from "three";
import { COLORS, mat, unlit } from "./palette.js";
import { makeFigure, breathe, walkPose, restPose } from "./figures.js";

const WALK_SPEED = 0.75;   // deck units / second (scrubbed time) — bigger deck, same stroll feel
const STEP_FREQ = 10;      // walk-pose radians per unit travelled (arc-length gait)
const SWING = 0.85;        // walkPose amplitude — the swagger

// module-scope scratch (zero per-frame allocation in update)
const _p = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _wp = new THREE.Vector3();

const easeInOut = (u) => u * u * (3 - 2 * u);

export class Captain {
  constructor(ship, events) {
    this.ship = ship;
    this.events = events;
    this.deckY = (ship && typeof ship.deckY === "number") ? ship.deckY : 0;
    this.keepouts = (ship && ship.keepouts) || [];
    this.bounds = (ship && ship.deckBounds) || { minX: -2.6, maxX: 2.8, minZ: -1.0, maxZ: 1.0 };
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ---- the figure (Jack: tricorn, navy coat, off-white shirt, dark boots) ----
    this.fig = makeFigure({
      hat: "tricorn",
      hatColor: COLORS.captainHat,
      coat: COLORS.captainCoat,
      shirt: COLORS.crewShirt,
      pants: COLORS.boots,
      scale: 1.0,
    });
    // a crimson sash at the waist reads as the sea-rover accent
    const sash = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.22), mat(COLORS.crimson));
    sash.position.y = 0.36;
    sash.castShadow = true;
    this.fig.group.add(sash);
    if (ship && ship.group) ship.group.add(this.fig.group);

    // ---- hand props (toggled per activity, parented at the right/left hand) ----
    const f = this.fig;

    // spyglass: brass-ringed tube extending down the raised right forearm
    this.spyglass = new THREE.Group();
    const glassTube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.3, 6), mat(COLORS.hullDark));
    const glassRingA = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 6), mat(COLORS.brass));
    glassRingA.position.y = 0.14;
    const glassRingB = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.03, 6), mat(COLORS.brass));
    glassRingB.position.y = -0.14;
    this.spyglass.add(glassTube, glassRingA, glassRingB);
    this.spyglass.position.y = -0.46; // continues past the hand
    this.spyglass.visible = false;
    this.spyglass.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    f.armR.add(this.spyglass);

    // cutlass: pale blade + brass guard, gripped at the right hand, blade down-arm
    this.sword = new THREE.Group();
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 6), mat(COLORS.hullDark));
    const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 6), mat(COLORS.brass));
    guard.position.y = -0.06;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.012), mat(0xcfd2d6));
    blade.position.y = -0.32;
    this.sword.add(grip, guard, blade);
    this.sword.position.y = -0.3;
    this.sword.visible = false;
    this.sword.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    f.armR.add(this.sword);

    // compass: flat brass disc with a crimson needle, held out in the left hand
    this.compass = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 8), mat(COLORS.brass));
    this.compassNeedle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.13), mat(COLORS.crimson));
    this.compassNeedle.position.y = 0.02;
    this.compass.add(disc, this.compassNeedle);
    this.compass.rotation.x = Math.PI / 2; // lie flat, face up
    this.compass.position.y = -0.34;
    this.compass.visible = false;
    disc.castShadow = true;
    f.armL.add(this.compass);

    // rum mug: stout cylinder with a handle, right hand
    this.mug = new THREE.Group();
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.09, 7), mat(COLORS.barrel));
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.01, 5, 8), mat(COLORS.barrel));
    handle.position.set(0.05, 0, 0);
    handle.rotation.y = Math.PI / 2;
    this.mug.add(cup, handle);
    this.mug.position.y = -0.32;
    this.mug.visible = false;
    cup.castShadow = true;
    f.armR.add(this.mug);

    // crumb: a fleck flicked to the gull; appears only on the toss beat
    this.crumb = new THREE.Mesh(new THREE.SphereGeometry(0.02, 4, 3), unlit(COLORS.paper));
    this.crumb.visible = false;
    f.armR.add(this.crumb);

    // fishing rod: a thin tapered pole down the right arm, tilted outboard, with
    // a line dropping from the tip toward the water. `rodStick` twitches on bites.
    this.rod = new THREE.Group();
    this.rodStick = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.028, 1.5, 5), mat(COLORS.mast));
    this.rodStick.position.y = -0.75; // tip lands at rod-space y = -1.5
    this.rodStick.castShadow = true;
    const rodLine = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 3.6, 4), mat(COLORS.rope));
    rodLine.position.y = -3.3; // top meets the rod tip (-1.5), hangs on down toward the sea
    this.rod.add(this.rodStick, rodLine);
    this.rod.rotation.x = -0.2; // slight droop past the arm (the arm does the reaching-out)
    this.rod.position.y = -0.28;
    this.rod.visible = false;
    f.armR.add(this.rod);

    // gull prop: perches at gullRail while he feeds it (sibling on the ship)
    this.gull = new THREE.Group();
    const gullBody = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), mat(COLORS.gull));
    gullBody.scale.set(1, 0.8, 1.3);
    const gullHead = new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 4), mat(COLORS.gull));
    gullHead.position.set(0, 0.06, 0.09);
    const gullBeak = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 4), mat(COLORS.brass));
    gullBeak.position.set(0, 0.05, 0.15);
    gullBeak.rotation.x = Math.PI / 2;
    const gullWingL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.12), mat(COLORS.gullWing));
    gullWingL.position.set(-0.07, 0.01, -0.01);
    const gullWingR = gullWingL.clone();
    gullWingR.position.x = 0.07;
    this.gull.add(gullBody, gullHead, gullBeak, gullWingL, gullWingR);
    this.gull.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    const gullSpot = this.spotFor("gullRail");
    this.gull.position.copy(gullSpot.position);
    this._gullBaseY = this.gull.position.y + 0.06;
    this.gull.position.y = this._gullBaseY;
    this.gull.rotation.y = gullSpot.facing + Math.PI; // faces inboard toward the captain
    this.gull.visible = false;
    if (ship && ship.group) ship.group.add(this.gull);

    this.hideProps = () => {
      this.spyglass.visible = this.sword.visible = this.compass.visible =
        this.mug.visible = this.crumb.visible = this.gull.visible = this.rod.visible = false;
    };

    // ---- activity plan (the accepted ?activity= list is this.activities) ----
    this.activities = ["helm", "spyglass", "compass", "map", "rum", "flourish", "rail", "gull", "nap", "fishing", "pace", "bell"];
    this.SPOT_FOR = {
      helm: "helm", spyglass: "bow", compass: "compass", map: "mapBarrel",
      rum: "steps", flourish: "hatch", rail: "rail", gull: "gullRail", nap: "mastNap",
      fishing: "fishing", pace: "pace1", bell: "bell",
    };
    // pacing endpoints, resolved once (walked between while the activity runs)
    this._pace1 = this.spotFor("pace1").position;
    this._pace2 = this.spotFor("pace2").position;

    const q = new URLSearchParams(location.search);
    const aq = q.get("activity");
    this.current = this.activities.includes(aq) ? aq : this.activities[Math.floor(Math.random() * this.activities.length)];
    const dq = Number(q.get("duration"));
    this.activityDuration = q.has("duration") && !isNaN(dq) && dq > 0 ? dq : 75;

    this.phase = "settled";      // settled | walking | watching
    this.walk = null;            // { curve, length, dist, arrive, facing }
    this.activityTime = 0;
    this.plankMode = false;
    this._stepPhase = 0;
    this._faceY = 0;             // base heading for the current pose (idle scans add to this)
    this._lastTime = null;       // previous ws.time, for scrub-safe deltas

    this.applyActivity(this.current);
  }

  get activity() { return this.current; }

  // { position: Vector3 (local), facing: radians }; never mutate the ship's own
  // vector, and fall back to deck-centre if a spot is missing. `name` may be an
  // activity name (mapped through SPOT_FOR) or a raw spot name (passes through).
  spotFor(name) {
    const key = (this.SPOT_FOR && this.SPOT_FOR[name]) || name;
    const s = this.ship && this.ship.spots && this.ship.spots[key];
    if (s && s.position) return { position: s.position, facing: s.facing || 0 };
    return { position: new THREE.Vector3(0, this.deckY, 0), facing: 0 };
  }

  // hard-set the figure into an activity's base pose, location and props
  applyActivity(name) {
    const f = this.fig;
    const spot = this.spotFor(name);
    const faceY = name === "flourish" ? 0 : (name === "nap" ? 0 : spot.facing);
    this._faceY = faceY;

    f.group.position.copy(spot.position);
    f.group.position.y = (typeof spot.position.y === "number") ? spot.position.y : this.deckY;
    f.group.rotation.set(0, faceY, 0);

    // neutral base — per-frame idle layers on top
    restPose(f);
    f.body.rotation.set(0, 0, 0);
    f.head.rotation.set(0, 0, 0);
    f.armL.rotation.set(0, 0, 0.1);
    f.armR.rotation.set(0, 0, -0.1);

    this.hideProps();

    if (name === "helm") {
      // both hands on the wheel
      f.armL.rotation.set(-1.15, 0, 0.28);
      f.armR.rotation.set(-1.15, 0, -0.28);
      f.head.rotation.x = 0.1;
    } else if (name === "spyglass") {
      // right arm up, glass to the eye, scanning the horizon
      f.armR.rotation.set(-1.5, 0, -0.12);
      f.armL.rotation.set(-0.15, 0, 0.2);
      f.head.rotation.x = -0.1;
      this.spyglass.visible = true;
    } else if (name === "compass") {
      // holds the compass flat, upper body wandering after the needle
      f.armL.rotation.set(-1.0, 0, 0.35);
      f.armR.rotation.set(-1.0, 0, -0.35);
      f.head.rotation.x = 0.45;
      this.compass.visible = true;
    } else if (name === "map") {
      // leans the whole body forward over the chart barrel
      f.group.rotation.x = 0.42;
      f.armL.rotation.set(-0.5, 0, 0.22);
      f.armR.rotation.set(-0.5, 0, -0.22);
      f.head.rotation.x = 0.45;
    } else if (name === "rum") {
      // sits on the steps, mug in hand
      f.group.position.y -= 0.2;
      f.legL.rotation.x = 1.5;
      f.legR.rotation.x = 1.5;
      f.armL.rotation.set(-0.2, 0, 0.22);
      f.armR.rotation.set(-0.35, 0, -0.25);
      this.mug.visible = true;
    } else if (name === "flourish") {
      // planted centre-deck facing the camera, cutlass out
      f.legL.rotation.x = 0.12;
      f.legR.rotation.x = -0.14;
      this.sword.visible = true;
    } else if (name === "rail") {
      // leans on the rail watching the traffic drift by
      f.group.rotation.x = 0.22;
      f.armL.rotation.set(-0.35, 0, 0.32);
      f.armR.rotation.set(-0.35, 0, -0.32);
      f.head.rotation.x = 0.05;
    } else if (name === "gull") {
      // crouched at the rail, coaxing the gull
      f.group.position.y -= 0.12;
      f.group.rotation.x = 0.28;
      f.legL.rotation.x = 0.9;
      f.legR.rotation.x = 0.9;
      f.armL.rotation.set(-0.3, 0, 0.28);
      f.armR.rotation.set(-0.4, 0, -0.26);
      f.head.rotation.x = 0.3;
      this.gull.visible = true;
    } else if (name === "nap") {
      // flat on his back beneath the mast, head toward the camera, hat over eyes
      f.group.rotation.set(Math.PI / 2, 0, 0);
      f.group.position.y = ((typeof spot.position.y === "number") ? spot.position.y : this.deckY) + 0.12;
      f.legL.rotation.x = -0.2;
      f.legR.rotation.x = 0.16;
      f.armL.rotation.set(-0.3, 0, 0.5);
      f.armR.rotation.set(-0.25, 0, -0.5);
      f.head.rotation.x = 0.2;
    } else if (name === "fishing") {
      // stands at the stern quarter rail, rod arm reaching out over the water
      f.group.rotation.x = 0.05;
      f.armR.rotation.set(-1.0, 0, -0.15); // right arm forward/out over the rail
      f.armL.rotation.set(-0.3, 0, 0.22);
      f.head.rotation.x = 0.15;
      this.rod.visible = true;
    } else if (name === "pace") {
      // pacing base pose: hands clasped behind the back (both pivots back ~0.5)
      f.armL.rotation.set(-0.5, 0, 0.12);
      f.armR.rotation.set(-0.5, 0, -0.12);
    } else if (name === "bell") {
      // stands by the bell; the ring gesture is layered on per frame
      f.armR.rotation.set(-0.2, 0, -0.1);
      f.armL.rotation.set(-0.1, 0, 0.15);
      f.head.rotation.x = 0.05;
    }
  }

  // arms-crossed supervisory stand near the plank
  applyWatchPose(facing) {
    const f = this.fig;
    this.hideProps();
    f.group.rotation.set(0, facing, 0);
    f.group.position.y = this.deckY;
    restPose(f);
    f.body.rotation.set(0, 0, 0);
    f.head.rotation.set(0, 0, 0);
    f.armL.rotation.set(0.9, 0, -0.7); // both pivots up ~0.9, hands crossed at chest
    f.armR.rotation.set(0.9, 0, 0.7);
    this._faceY = facing;
  }

  // weighted next activity; after dark, nap/rum/rail are 3× as likely
  pickNext(ws) {
    const night = ws && ws.blend > 0.5;
    let total = 0;
    const pool = [];
    for (const a of this.activities) {
      if (a === this.current) continue;
      let w = 1;
      if (night && (a === "nap" || a === "rum" || a === "rail" || a === "fishing")) w = 3;
      pool.push([a, w]);
      total += w;
    }
    if (!pool.length) return this.current;
    let r = Math.random() * total;
    for (const [a, w] of pool) { r -= w; if (r <= 0) return a; }
    return pool[pool.length - 1][0];
  }

  // Build a straight-ish deck path that detours around keep-out circles and
  // stays inside deckBounds, then start walking it. `arrive` describes what to
  // do at the end: { activity } or { plank }. `dest`/`facing` are cloned/kept
  // by value here so passing scratch vectors is safe.
  startWalkTo(dest, facing, arrive) {
    const from = this.fig.group.position.clone();
    from.y = this.deckY;
    const to = new THREE.Vector3(dest.x, this.deckY, dest.z);

    const delta = to.clone().sub(from);
    const side = delta.lengthSq() > 1e-6
      ? new THREE.Vector3(-delta.z, 0, delta.x).normalize()
      : new THREE.Vector3(1, 0, 0);

    const pts = [from];
    for (const k of [0.34, 0.67]) {
      pts.push(from.clone().lerp(to, k).add(side.clone().multiplyScalar((Math.random() - 0.5) * 0.7)));
    }
    pts.push(to);

    const pushCircle = (pt, o, radius) => {
      const dx = pt.x - o.x, dz = pt.z - o.z;
      let d = Math.hypot(dx, dz);
      if (d < 1e-6) { pt.x = o.x + radius; return; }
      pt.x = o.x + (dx / d) * radius;
      pt.z = o.z + (dz / d) * radius;
    };
    const clamp = (pt) => {
      pt.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, pt.x));
      pt.z = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, pt.z));
    };
    for (let i = 1; i < pts.length - 1; i++) {
      for (const o of this.keepouts) {
        if (Math.hypot(pts[i].x - o.x, pts[i].z - o.z) < o.r) pushCircle(pts[i], o, o.r);
      }
      clamp(pts[i]);
    }

    let curve = new THREE.CatmullRomCurve3(pts);
    // CatmullRom overshoots waypoints — verify by sampling and nudge the nearest
    // intermediate point clear of the worst intrusion, a few iterations.
    for (let iter = 0; iter < 4; iter++) {
      let worst = null;
      for (let s = 0; s <= 20; s++) {
        const u = s / 20;
        if (u < 0.12 || u > 0.88) continue;
        curve.getPoint(u, _p);
        for (const o of this.keepouts) {
          const sev = o.r * 0.7 - Math.hypot(_p.x - o.x, _p.z - o.z);
          if (sev > 0 && (!worst || sev > worst.sev)) worst = { x: _p.x, z: _p.z, sev, o };
        }
      }
      if (!worst) break;
      let wi = 1, wd = Infinity;
      for (let i = 1; i < pts.length - 1; i++) {
        const d = Math.hypot(pts[i].x - worst.x, pts[i].z - worst.z);
        if (d < wd) { wd = d; wi = i; }
      }
      const cur = Math.hypot(pts[wi].x - worst.o.x, pts[wi].z - worst.o.z);
      pushCircle(pts[wi], worst.o, Math.max(worst.o.r, cur) + 0.3);
      clamp(pts[wi]);
      curve = new THREE.CatmullRomCurve3(pts);
    }

    this.walk = { curve, length: curve.getLength(), dist: 0, arrive, facing };
    this.phase = "walking";
    this._stepPhase = 0;

    // stand up for the road, drop all props and lean
    const f = this.fig;
    this.hideProps();
    f.group.rotation.set(0, 0, 0);
    restPose(f);
    f.body.rotation.set(0, 0, 0);
    f.head.rotation.set(0, 0, 0);
    f.armL.rotation.set(0, 0, 0.1);
    f.armR.rotation.set(0, 0, -0.1);
  }

  beginActivityWalk(name) {
    const spot = this.spotFor(name);
    const facing = name === "flourish" ? 0 : (name === "nap" ? 0 : spot.facing);
    this.startWalkTo(spot.position, facing, { activity: name });
  }

  // walk to a supervisory spot just inboard of the plank base, facing the tip
  beginPlankWalk() {
    const base = this.spotFor("plankBase");
    const tip = this.spotFor("plankTip");
    let ix = -base.position.x, iz = -base.position.z;
    const il = Math.hypot(ix, iz) || 1;
    ix /= il; iz /= il;
    _wp.set(base.position.x + ix * 0.55, this.deckY, base.position.z + iz * 0.55);
    _wp.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, _wp.x));
    _wp.z = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, _wp.z));
    const facing = Math.atan2(tip.position.x - _wp.x, tip.position.z - _wp.z);
    if (this.reduced) {
      this.fig.group.position.set(_wp.x, this.deckY, _wp.z);
      this.applyWatchPose(facing);
      this.phase = "watching";
      this.walk = null;
    } else {
      this.startWalkTo(_wp, facing, { plank: true });
    }
  }

  updateWalk(dScaled, ws) {
    const w = this.walk;
    w.dist = Math.min(w.length, w.dist + WALK_SPEED * dScaled);
    const u = w.length > 1e-6 ? w.dist / w.length : 1;
    const uc = Math.min(1, u);

    w.curve.getPointAt(uc, _p);
    w.curve.getPointAt(Math.min(1, uc + 0.001), _a);
    w.curve.getPointAt(Math.max(0, uc - 0.001), _b);
    let tx = _a.x - _b.x, tz = _a.z - _b.z;
    const tl = Math.hypot(tx, tz) || 1e-6;
    tx /= tl; tz /= tl;

    this._stepPhase += WALK_SPEED * dScaled * STEP_FREQ;
    const f = this.fig;
    f.group.position.set(_p.x, this.deckY + Math.abs(Math.sin(this._stepPhase * 0.5)) * 0.03, _p.z);
    f.group.rotation.set(0, Math.atan2(tx, tz), Math.sin(this._stepPhase) * 0.05); // swagger roll
    walkPose(f, this._stepPhase, SWING);

    if (u >= 1) {
      if (w.arrive && w.arrive.plank) {
        this.fig.group.position.set(_p.x, this.deckY, _p.z);
        this.applyWatchPose(w.facing);
        this.phase = "watching";
      } else {
        this.current = w.arrive.activity;
        this.applyActivity(this.current);
        this.activityTime = 0;
        this.phase = "settled";
      }
      this.walk = null;
    }
  }

  update(ws, dt) {
    // scrub-safe delta: everything advances on ws.time so ?speed=0 truly freezes
    if (this._lastTime === null) this._lastTime = ws.time;
    const dScaled = Math.max(0, ws.time - this._lastTime);
    this._lastTime = ws.time;
    const t = ws.time;
    const f = this.fig;

    // ---- plank interrupt (takes priority over the routine) ----
    const p = this.events && this.events.plank;
    const plankBusy = !!(p && p.active && p.phase !== "idle");
    if (plankBusy && !this.plankMode) {
      this.plankMode = true;
      this.beginPlankWalk();
    } else if (!plankBusy && this.plankMode) {
      this.plankMode = false;
      if (this.reduced) {
        this.current = this.pickNext(ws);
        this.applyActivity(this.current);
        this.activityTime = 0;
        this.phase = "settled";
      } else {
        this.beginActivityWalk(this.pickNext(ws));
      }
    }

    if (this.phase === "walking") { this.updateWalk(dScaled, ws); return; }

    if (this.phase === "watching") {
      // hold the arms-crossed stand; small weight shift + subtle track of the tip
      f.body.rotation.z = Math.sin(t * 0.3) * 0.02;
      f.head.rotation.y = Math.sin(t * 0.4) * 0.12;
      breathe(f, t);
      return;
    }

    // ---- routine progression ----
    this.activityTime += dScaled;
    if (!this.plankMode && this.activityTime > this.activityDuration) {
      const next = this.pickNext(ws);
      if (this.reduced) {
        this.current = next;
        this.applyActivity(next);
        this.activityTime = 0;
      } else {
        this.beginActivityWalk(next);
        return;
      }
    }

    // ---- per-activity idle motion (all driven by ws.time) ----
    const a = this.current;
    if (a === "helm") {
      f.group.rotation.set(0, this._faceY, Math.sin(t * 0.4) * 0.03);
      f.armL.rotation.x = -1.15 + Math.sin(t * 0.6) * 0.08;
      f.armR.rotation.x = -1.15 - Math.sin(t * 0.6) * 0.08;
    } else if (a === "spyglass") {
      f.group.rotation.set(0, this._faceY + Math.sin(t * 0.25) * 0.35, 0);
      f.head.rotation.x = -0.1 + Math.sin(t * 0.5) * 0.03;
    } else if (a === "compass") {
      const wander = Math.sin(t * 0.35) * 0.25 + Math.sin(t * 0.21 + 1.3) * 0.15;
      f.group.rotation.set(0, this._faceY + wander, 0);
      f.body.rotation.z = Math.sin(t * 0.5) * 0.05;
      this.compassNeedle.rotation.z = -wander * 2 + Math.sin(t * 0.9) * 0.1;
    } else if (a === "map") {
      f.group.rotation.set(0.42 + Math.sin(t * 0.5) * 0.02, this._faceY, 0);
      f.head.rotation.y = Math.sin(t * 0.28) * 0.25;
    } else if (a === "rum") {
      const sip = Math.max(0, Math.sin(t * 0.32));
      f.armR.rotation.x = -0.35 - sip * 1.0;
      f.head.rotation.x = 0.1 - sip * 0.32;
    } else if (a === "flourish") {
      // a slow sword figure-8 traced by the right arm (~8s per loop)
      const ph = (t % 8) / 8 * Math.PI * 2;
      f.armR.rotation.x = -0.9 + Math.sin(ph) * 0.8;
      f.armR.rotation.z = -0.1 + Math.sin(2 * ph) * 0.7;
      f.armL.rotation.x = -0.2 + Math.sin(ph) * 0.2;
      f.legL.rotation.x = Math.sin(ph) * 0.15;
      f.legR.rotation.x = -Math.sin(ph) * 0.15;
      f.group.rotation.set(0, this._faceY + Math.sin(ph) * 0.12, 0);
    } else if (a === "rail") {
      f.group.rotation.set(0.22, this._faceY, Math.sin(t * 0.3) * 0.04);
      f.head.rotation.y = Math.sin(t * 0.16) * 0.3;
    } else if (a === "gull") {
      // periodic crumb toss; the gull bobs and hops on the beat
      const k = t % 4;
      const toss = k < 0.35 ? Math.sin((k / 0.35) * Math.PI) : 0;
      f.armR.rotation.x = -0.4 - toss * 0.9;
      this.crumb.visible = toss > 0.1;
      this.crumb.position.set(0, -0.32 - toss * 0.15, toss * 0.12);
      this.gull.position.y = this._gullBaseY + Math.abs(Math.sin(t * 2)) * 0.03 + toss * 0.05;
      f.head.rotation.x = 0.3 + Math.sin(t * 0.6) * 0.05;
    } else if (a === "nap") {
      f.head.rotation.x = 0.2 + Math.sin(t * 0.5) * 0.05; // slow doze bob
    } else if (a === "fishing") {
      // patient watch of the line, with the odd rod-tip twitch on a nibble
      const k = t % 6;
      const twitch = k < 0.35 ? Math.sin((k / 0.35) * Math.PI) * 0.35 : 0;
      this.rodStick.rotation.x = twitch;
      f.armR.rotation.x = -1.0 - twitch * 0.2;
      f.group.rotation.set(0.05, this._faceY, Math.sin(t * 0.22) * 0.02);
      f.head.rotation.y = Math.sin(t * 0.18) * 0.14;
    } else if (a === "pace") {
      // slow there-and-back walk along the quarterdeck, hands clasped behind
      const period = 9;
      const ph = (t % period) / period;
      const tri = ph < 0.5 ? ph * 2 : (1 - ph) * 2; // 0→1→0 sweep
      const u = easeInOut(tri);
      const ax = this._pace1.x, az = this._pace1.z;
      const bx = this._pace2.x, bz = this._pace2.z;
      const px = ax + (bx - ax) * u, pz = az + (bz - az) * u;
      const dir = ph < 0.5 ? 1 : -1; // heading flips at each end
      const heading = Math.atan2((bx - ax) * dir, (bz - az) * dir);
      this._stepPhase += WALK_SPEED * 0.6 * STEP_FREQ * dScaled;
      const bob = Math.abs(Math.sin(this._stepPhase * 0.5)) * 0.03;
      f.group.position.set(px, this.deckY + bob, pz);
      f.group.rotation.set(0, heading, Math.sin(this._stepPhase) * 0.04);
      // legs stride; arms stay clasped behind (override walkPose's arm swing)
      f.legL.rotation.x = Math.sin(this._stepPhase) * 0.45;
      f.legR.rotation.x = -Math.sin(this._stepPhase) * 0.45;
      f.armL.rotation.set(-0.5, 0, 0.12);
      f.armR.rotation.set(-0.5, 0, -0.12);
    } else if (a === "bell") {
      // one slow reach-and-ring cycle every few seconds, then stands easy
      const k = t % 7;
      const ring = k < 1.4 ? Math.sin((k / 1.4) * Math.PI) : 0;
      f.armR.rotation.x = -0.2 - ring * 1.15; // reach up to the bell rope and pull
      f.body.rotation.z = ring * 0.05;
      f.head.rotation.x = 0.05 + ring * 0.1;
    }

    breathe(f, t);
  }
}
