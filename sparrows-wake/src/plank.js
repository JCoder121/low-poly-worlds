// Walk the plank — the scene's one comedic set-piece. A drab prisoner pops
// from the hatch, gets marched out over the water, dithers at the tip through
// two springy bounces, cannonballs off in a ballistic arc, then surfaces to a
// relieved backstroke toward the horizon. Whole run ~20s, every 3-5 min.
//
// This module only sets events.plank.{active,phase} and drives the prisoner.
// The captain and crew watch of their own accord by reading events.plank;
// crew.requestEscort() peels one hand off to march behind him.
import * as THREE from "three";
import { COLORS } from "./palette.js";
import { makeFigure } from "./figures.js";
import { waveHeight } from "./waves.js";

const params = new URLSearchParams(location.search);

// module-scope scratch — no per-frame allocations
const _p = new THREE.Vector3();
const _tan = new THREE.Vector3();

const pick = (arr) => arr[(Math.random() * arr.length) | 0];
// the recurring prisoner knows the drill — lowercase, ≤24 chars, weary. The
// escort mutters as it marches him out.
const PRISONER_MUSTER = ["not again…", "third time this week", "must we?", "again? really"];
const PRISONER_WALK = ["the plank, lovely", "mind the splinters", "i can't swim… ish", "grand view up here"];
const PRISONER_SWIM = ["the water's fine actually", "see you next week", "freedom, briefly", "told you i'd float"];
const ESCORT_LINE = ["this way, mate", "step lively", "no dawdlin'", "over ye go"];

const easeOutBack = (x) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

// two springy dips at the tip: a shallow test-dip, a deeper committed one,
// with a little overshoot up between — read as reluctant knee-bends.
function dip(b) {
  let d = 0;
  d += -0.16 * Math.exp(-((b - 0.6) ** 2) / 0.05);
  d += -0.26 * Math.exp(-((b - 1.6) ** 2) / 0.07);
  d += 0.07 * Math.exp(-((b - 1.05) ** 2) / 0.035);
  return d;
}

// phase durations (seconds); walk is distance-driven, splash sub-timed below
const MUSTER = 3.0;
const BOUNCE = 3.0;
const SPLASH_T = 0.9; // ballistic flight time to water entry — longer fall from the raised deck
const UNDERWATER = 0.4;

export class Plank {
  constructor(ship, captain, crew, water, events) {
    this.ship = ship;
    this.captain = captain;
    this.crew = crew;
    this.water = water;
    this.events = events;

    this.deckY = ship && ship.deckY != null ? ship.deckY : 1.05;
    this._fallback = { position: new THREE.Vector3(0, this.deckY, 0), facing: 0 };

    this.prisoner = null;     // the SAME drab figure every event — persisted, not rebuilt
    this.priRec = null;       // his registry record (for routine barks)
    this.eventCount = 0;
    this.phase = "idle";
    this.phaseTime = 0;
    this.timer = 0;
    this.plankWalk = null;
    this.tipX = 0; this.tipY = this.deckY; this.tipZ = 0; this.tipHeading = 0;
    this.splashEntered = false;
    this.underwaterT = 0;
    this.launch = null;
    this._scene = null;
    this.swimX = 0; this.swimZ = 0;

    events.plank.active = false;
    events.plank.phase = "idle";

    this.once = params.get("event") === "plank";
    // ?event=plank fires one 3s after load; otherwise nothing in the first 45s,
    // then a fresh 3-5 min interval each time.
    this.nextAt = this.once ? 3 : 180 + Math.random() * 120;
  }

  _getSpot(name) {
    const sp = this.ship && this.ship.spots && this.ship.spots[name];
    return sp && sp.position ? sp : this._fallback;
  }

  _setPinned() {
    // arms bound: pivoted slightly back and held there
    this.prisoner.armL.rotation.set(-0.4, 0, 0);
    this.prisoner.armR.rotation.set(-0.4, 0, 0);
  }

  // build the prisoner exactly once; every later event reuses this same figure
  _ensurePrisoner() {
    if (this.prisoner) return;
    this.prisoner = makeFigure({
      hat: "none",
      shirt: COLORS.prisoner,
      pants: COLORS.hullDark,
      skin: COLORS.skinTan,
      scale: 0.98,
    });
  }

  // undo the swim's fade + the airborne somersault so he re-emerges clean
  _resetPrisoner() {
    const g = this.prisoner.group;
    g.visible = true;
    g.rotation.set(0, 0, 0);
    g.traverse((m) => {
      if (m.material) {
        m.material.opacity = 1;
        m.material.transparent = false;
        m.material.depthWrite = true;
      }
    });
  }

  start() {
    this._ensurePrisoner();
    this._resetPrisoner();
    this.eventCount++;
    this.ship.group.add(this.prisoner.group); // back aboard (absent between events)

    const hs = this._getSpot("hatch");
    this.prisoner.group.position.set(hs.position.x, this.deckY - 0.45, hs.position.z);
    this.prisoner.group.scale.setScalar(0.001);
    this._setPinned();

    // register him with the shared deck brain for his weary barks (lines null →
    // never joins the ambient rotation; he only speaks on cue).
    const reg = this.events && this.events.registry;
    if (reg) {
      this.priRec = reg.register("prisoner", 0, this.prisoner, null, null);
      // he escalates a touch the more often this happens to him
      const line = this.eventCount >= 3 ? PRISONER_MUSTER[Math.min(this.eventCount, PRISONER_MUSTER.length) - 1] : pick(PRISONER_MUSTER);
      reg.bark(this.priRec, line, true);
    }

    this.phase = "muster";
    this.phaseTime = 0;
    this.splashEntered = false;
    this.underwaterT = 0;
    this.events.plank.active = true;
    this.events.plank.phase = "muster";

    if (this.crew && this.crew.requestEscort) this.crew.requestEscort();
    if (this.crew && this.crew.escortBark) this.crew.escortBark(pick(ESCORT_LINE));
  }

  muster(t) {
    const p = Math.min(1, this.phaseTime / 0.9);
    this.prisoner.group.scale.setScalar(Math.max(0.001, easeOutBack(p)));
    const hs = this._getSpot("hatch");
    const pb = this._getSpot("plankBase");
    this.prisoner.group.position.set(hs.position.x, this.deckY - 0.45 * (1 - p), hs.position.z);
    // face the plank he's about to walk
    const yaw = Math.atan2(pb.position.x - hs.position.x, pb.position.z - hs.position.z);
    this.prisoner.group.rotation.set(0, yaw, p >= 1 ? Math.sin(t * 10) * 0.02 : 0); // a nervous shiver once up
    this._setPinned();

    if (this.phaseTime >= MUSTER) this._beginWalk();
  }

  _beginWalk() {
    const hs = this._getSpot("hatch");
    const pb = this._getSpot("plankBase");
    const pt = this._getSpot("plankTip");
    const pts = [
      new THREE.Vector3(hs.position.x, this.deckY, hs.position.z),
      new THREE.Vector3((hs.position.x + pb.position.x) / 2, this.deckY, (hs.position.z + pb.position.z) / 2),
      new THREE.Vector3(pb.position.x, this.deckY, pb.position.z),
      new THREE.Vector3(pt.position.x, pt.position.y ?? this.deckY, pt.position.z),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    this.plankWalk = { curve, length: curve.getLength(), dist: 0 };
    this.phase = "walk";
    this.phaseTime = 0;
    const reg = this.events && this.events.registry;
    if (reg && this.priRec) reg.bark(this.priRec, pick(PRISONER_WALK), true);
  }

  walk(t, dt) {
    const w = this.plankWalk;
    const u0 = w.length > 1e-4 ? w.dist / w.length : 1;
    const spd = u0 > 0.82 ? 0.16 : 0.4; // reluctant shuffle out over the water
    w.dist = Math.min(w.length, w.dist + dt * spd);
    const u = w.length > 1e-4 ? w.dist / w.length : 1;
    w.curve.getPointAt(Math.min(1, u), _p);
    w.curve.getTangentAt(Math.min(1, u), _tan);
    const yaw = Math.atan2(_tan.x, _tan.z);
    this.prisoner.group.position.set(_p.x, _p.y + Math.abs(Math.sin(t * 7)) * 0.02, _p.z);
    this.prisoner.group.rotation.set(0, yaw, Math.sin(t * 7) * 0.03);
    // short shuffling steps; arms stay pinned
    const su = w.dist * 7;
    this.prisoner.legL.rotation.x = Math.sin(su) * 0.3;
    this.prisoner.legR.rotation.x = -Math.sin(su) * 0.3;
    this._setPinned();

    if (u >= 1) {
      this.tipX = _p.x; this.tipY = _p.y; this.tipZ = _p.z; this.tipHeading = yaw;
      this.phase = "bounce";
      this.phaseTime = 0;
    }
  }

  bounce(t) {
    const b = this.phaseTime;
    this.prisoner.group.position.set(this.tipX, this.tipY + dip(b), this.tipZ);
    // teeters forward at the edge in the last beat before the plunge
    const lean = b > 2.1 ? Math.min(1, (b - 2.1) / 0.9) * 0.55 : 0;
    this.prisoner.group.rotation.set(lean, this.tipHeading, Math.sin(t * 9) * 0.05);
    // arms tug against the bindings
    this.prisoner.armL.rotation.set(-0.4 + Math.sin(t * 9) * 0.15, 0, 0);
    this.prisoner.armR.rotation.set(-0.4 - Math.sin(t * 9) * 0.15, 0, 0);

    if (this.phaseTime >= BOUNCE) this._beginSplash();
  }

  _beginSplash() {
    const scene = this.ship.group.parent;
    this._scene = scene;
    // world position of the prisoner right now, then reparent keeping it
    this.prisoner.group.updateWorldMatrix(true, false);
    _p.setFromMatrixPosition(this.prisoner.group.matrixWorld);
    if (scene) scene.attach(this.prisoner.group); // preserves the world transform

    const T = SPLASH_T;
    const x0 = _p.x, y0 = _p.y, z0 = _p.z;
    const xt = x0 + 2.5, zt = z0 + 0.5; // arc forward (+x) and a touch outboard (+z), lands ~z 6.5
    const vy = 3.0; // a hopeful little pop before gravity wins
    const g = (2 * (y0 + vy * T)) / (T * T); // solved so he meets the water (y=0) at T
    this.launch = { x0, y0, z0, xt, zt, vx: (xt - x0) / T, vy, vz: (zt - z0) / T, g, T };

    this.phase = "splash";
    this.phaseTime = 0;
    this.splashEntered = false;
    this.underwaterT = 0;
  }

  splash(t, dt) {
    const L = this.launch;
    if (!this.splashEntered) {
      const tau = this.phaseTime;
      this.prisoner.group.position.set(
        L.x0 + L.vx * tau,
        L.y0 + L.vy * tau - 0.5 * L.g * tau * tau,
        L.z0 + L.vz * tau
      );
      this.prisoner.group.rotation.x += dt * 6; // flailing somersault
      this.prisoner.armL.rotation.x = Math.sin(t * 20) * 1.2;
      this.prisoner.armR.rotation.x = -Math.sin(t * 20) * 1.2;

      if (tau >= L.T) {
        this.splashEntered = true;
        this.prisoner.group.position.set(L.xt, 0, L.zt);
        if (this.water && this.water.splash) this.water.splash(L.xt, L.zt, 1.8);
        this.prisoner.group.visible = false; // gone under
      }
    } else {
      this.underwaterT += dt;
      if (this.underwaterT >= UNDERWATER) this._beginSwim();
    }
  }

  _beginSwim() {
    this.prisoner.group.visible = true;
    this.swimX = this.launch.xt;
    this.swimZ = this.launch.zt;
    this.prisoner.group.position.set(this.swimX, 0.16, this.swimZ);
    this.prisoner.group.rotation.set(-Math.PI / 2, 0, 0); // flat on his back, belly up
    this.phase = "swim";
    this.phaseTime = 0;
    const reg = this.events && this.events.registry;
    if (reg && this.priRec) reg.bark(this.priRec, pick(PRISONER_SWIM), true);
  }

  swim(t, dt, ws) {
    // on the fishbowl page the world ends at the glass — fade at the rim
    const exitX = document.body.dataset.mode === "island" ? 11 : 20;
    const st = this.phaseTime;
    this.swimX += 0.5 * dt; // rides the traffic lane out, +x world
    const wy = waveHeight(this.swimX, this.swimZ, ws.time);
    this.prisoner.group.position.set(this.swimX, wy + 0.16, this.swimZ);
    this.prisoner.group.rotation.set(-Math.PI / 2, Math.sin(t * 0.6) * 0.12, Math.sin(t * 0.9) * 0.1);
    // lazy alternating backstroke; feet gently flutter
    this.prisoner.armL.rotation.x = Math.sin(t * 1.6) * 1.3;
    this.prisoner.armR.rotation.x = Math.sin(t * 1.6 + Math.PI) * 1.3;
    this.prisoner.legL.rotation.x = Math.sin(t * 1.6 + 0.4) * 0.18;
    this.prisoner.legR.rotation.x = Math.sin(t * 1.6 + Math.PI + 0.4) * 0.18;

    // dissolve into the fog toward the edge
    if (st > 4.5 || this.swimX > exitX) {
      const o = Math.max(0, 1 - (st - 4.5) / 2.5);
      this._setOpacity(o);
      if (o <= 0.02 || this.swimX > exitX + 2) this._finish();
    }
  }

  _setOpacity(o) {
    this.prisoner.group.traverse((m) => {
      if (m.material) {
        m.material.transparent = true;
        m.material.opacity = o;
        m.material.depthWrite = o > 0.5;
      }
    });
  }

  _finish() {
    // he's the SAME fellow next time — detach and hide him, but keep the figure
    // (and its geometry/materials) alive for the next event.
    const scene = this._scene || this.ship.group.parent;
    if (this.prisoner && this.prisoner.group.parent) this.prisoner.group.parent.remove(this.prisoner.group);
    else if (scene && this.prisoner) scene.remove(this.prisoner.group);
    if (this.prisoner) this.prisoner.group.visible = false;
    const reg = this.events && this.events.registry;
    if (reg) reg.unregister("prisoner");
    this.priRec = null;
    this.phase = "idle";
    this.phaseTime = 0;
    this.timer = 0;
    this.events.plank.active = false;
    this.events.plank.phase = "idle";
    this.nextAt = this.once ? Infinity : 180 + Math.random() * 120;
  }

  update(ws, dt) {
    const t = ws.time;

    if (this.phase === "idle") {
      this.events.plank.active = false;
      this.events.plank.phase = "idle";
      this.timer += dt;
      if (this.timer >= this.nextAt) this.start();
      return;
    }

    this.events.plank.active = true;
    this.events.plank.phase = this.phase;
    this.phaseTime += dt;

    switch (this.phase) {
      case "muster": this.muster(t); break;
      case "walk": this.walk(t, dt); break;
      case "bounce": this.bounce(t); break;
      case "splash": this.splash(t, dt); break;
      case "swim": this.swim(t, dt, ws); break;
    }
  }
}
