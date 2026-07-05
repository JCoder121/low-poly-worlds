// The three bandana'd hands. Each runs its own small task loop — swabbing,
// hauling rope, coiling, a climb to the crow's nest, polishing the cannon, a
// night doze — staggered so the deck never pulses in sync. Keep-out-aware
// arc-length walks inside ship.deckBounds; all children of ship.group so they
// ride the swell for free. plank.js borrows one via requestEscort().
import * as THREE from "three";
import { COLORS, mat } from "./palette.js";
import { makeFigure, breathe, walkPose, restPose } from "./figures.js";

// module-scope scratch — no per-frame allocations in the loops below
const _p = new THREE.Vector3();
const _tan = new THREE.Vector3();

const TASKS = ["swab", "ropeHaul", "coil", "crowsNest", "cannonPolish", "doze"];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

// a swab mop: pole + cone of strands, parented to the right hand
function makeMop() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5), mat(COLORS.mast));
  pole.castShadow = true;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.15, 6), mat(COLORS.sail));
  head.position.y = -0.28;
  head.castShadow = true;
  g.add(pole, head);
  return g;
}

export class Crew {
  constructor(ship, events) {
    this.ship = ship;
    this.events = events;
    this.escortBusy = false;
    this._escort = null;
    this.ws = null;

    const deckY = ship && ship.deckY != null ? ship.deckY : 1.05;
    this.deckY = deckY;
    this.keepouts = (ship && ship.keepouts) || [];
    this.bounds = (ship && ship.deckBounds) || { minX: -2.4, maxX: 2.4, minZ: -1.0, maxZ: 1.0 };
    this._fallback = { position: new THREE.Vector3(0, deckY, 0), facing: 0 };

    // four hands, task homes spread fore / mid / aft so the bigger deck never
    // clusters (swabA fore, swabC mid, swabB aft; rope + cannon at their props)
    const CFG = [
      { shirt: COLORS.crewShirt, bandana: COLORS.crimson, pants: COLORS.crewPants, swab: "swabA", init: "swab" },
      { shirt: COLORS.crewStripe, bandana: COLORS.brass, pants: COLORS.boots, swab: "swabC", init: "ropeHaul" },
      { shirt: COLORS.crewShirt, bandana: COLORS.crewStripe, pants: COLORS.crewPants, swab: "swabA", init: "cannonPolish" },
      { shirt: COLORS.crewStripe, bandana: COLORS.rope, pants: COLORS.crewPants, swab: "swabB", init: "swab" },
    ];

    this.hands = [];
    for (let i = 0; i < CFG.length; i++) {
      const c = CFG[i];
      const fig = makeFigure({ hat: "bandana", bandanaColor: c.bandana, shirt: c.shirt, pants: c.pants, scale: 0.96 });
      const mop = makeMop();
      mop.visible = false;
      mop.position.set(0, -0.3, 0.02);
      mop.rotation.x = 0.4;
      fig.armR.add(mop);
      ship.group.add(fig.group);

      const h = {
        fig, mop,
        task: c.init, swabSpot: c.swab, baseY: deckY,
        phase: "settled", walk: null,
        taskTime: 0, taskDuration: 40 + Math.random() * 20,
        phaseOffset: i * 1.7,
        escorting: false, escortPhase: null, escortFacing: 0,
        climbT: 0, topY: deckY, scanFacing: 0,
      };
      this.hands.push(h);
      this.applyTask(h, c.init);
      h.taskTime = Math.random() * 25; // re-stagger (applyTask zeroed it)
    }
  }

  _getSpot(name) {
    const sp = this.ship && this.ship.spots && this.ship.spots[name];
    return sp && sp.position ? sp : this._fallback;
  }

  spotName(h, task) {
    switch (task) {
      case "swab": return h.swabSpot;
      case "ropeHaul":
      case "coil": return "ropeSpot";
      case "crowsNest": return "crowsNest";
      case "cannonPolish": return "cannon";
      case "doze": return "hatch";
    }
    return "ropeSpot";
  }

  pickTask(ws, h) {
    const night = ws && ws.blend > 0.5;
    const pool = [];
    for (const task of TASKS) {
      if (task === h.task) continue;
      let w = 1;
      if (task === "doze") w = night ? 4 : 0.35;
      if (task === "crowsNest") w = 0.7;
      const n = Math.max(1, Math.round(w * 4));
      for (let k = 0; k < n; k++) pool.push(task);
    }
    return pool[Math.floor(Math.random() * pool.length)] || "swab";
  }

  // hard-set a hand into a task's base pose at its spot (no walk)
  applyTask(h, task) {
    const s = this._getSpot(this.spotName(h, task));
    h.fig.group.position.set(s.position.x, h.baseY, s.position.z);
    h.fig.group.rotation.set(0, s.facing ?? 0, 0);
    restPose(h.fig);
    h.mop.visible = task === "swab";
    h.task = task;
    h.taskTime = 0;
    h.taskDuration = 40 + Math.random() * 20;
  }

  // keep-out-aware planar curve between two deck points (arc-length walked)
  buildCurve(fx, fz, tx, tz) {
    const from = new THREE.Vector3(fx, 0, fz);
    const to = new THREE.Vector3(tx, 0, tz);
    const delta = to.clone().sub(from);
    const side = delta.lengthSq() > 1e-6
      ? new THREE.Vector3(-delta.z, 0, delta.x).normalize()
      : new THREE.Vector3(1, 0, 0);
    const pts = [from];
    for (const k of [0.4, 0.72]) {
      const p = from.clone().lerp(to, k).add(side.clone().multiplyScalar((Math.random() - 0.5) * 0.8));
      this._pushKeepouts(p);
      this._clampBounds(p);
      pts.push(p);
    }
    pts.push(to);
    const curve = new THREE.CatmullRomCurve3(pts);
    return { curve, length: curve.getLength(), dist: 0, target: null };
  }

  _pushKeepouts(p) {
    for (const o of this.keepouts) {
      const dx = p.x - o.x, dz = p.z - o.z;
      const d = Math.hypot(dx, dz);
      if (d < o.r) {
        const s = o.r / (d || 1e-6);
        p.x = o.x + dx * s;
        p.z = o.z + dz * s;
      }
    }
  }

  _clampBounds(p) {
    const b = this.bounds;
    p.x = clamp(p.x, b.minX + 0.25, b.maxX - 0.25);
    p.z = clamp(p.z, b.minZ + 0.25, b.maxZ - 0.25);
  }

  startWalk(h, task) {
    const s = this._getSpot(this.spotName(h, task));
    const cx = h.fig.group.position.x, cz = h.fig.group.position.z;
    const tx = s.position.x, tz = s.position.z;
    h.mop.visible = false;
    if (Math.hypot(tx - cx, tz - cz) < 0.35) {
      // nowhere to visibly walk — settle (or climb) in place
      if (task === "crowsNest") {
        h.fig.group.position.set(tx, h.baseY, tz);
        h.topY = s.position.y ?? h.baseY;
        h.scanFacing = s.facing ?? 0;
        h.phase = "climbing";
        h.climbT = 0;
      } else {
        this.applyTask(h, task);
        h.phase = "settled";
      }
      h.walk = null;
      return;
    }
    h.walk = this.buildCurve(cx, cz, tx, tz);
    h.walk.target = task;
    h.phase = "walking";
  }

  // advance a walk one frame; returns true on arrival
  stepWalk(h, dt, t) {
    const w = h.walk;
    w.dist = Math.min(w.length, w.dist + dt * 0.75); // bigger deck, same stroll feel
    const u = w.length > 1e-4 ? w.dist / w.length : 1;
    w.curve.getPointAt(Math.min(1, u), _p);
    w.curve.getTangentAt(Math.min(1, u), _tan);
    h.fig.group.position.set(_p.x, h.baseY + Math.abs(Math.sin(t * 6)) * 0.02, _p.z);
    h.fig.group.rotation.set(0, Math.atan2(_tan.x, _tan.z), Math.sin(t * 6) * 0.03);
    walkPose(h.fig, w.dist * 5, 0.6);
    return u >= 1;
  }

  arrive(h) {
    const task = h.walk.target;
    h.walk = null;
    if (task === "crowsNest") {
      const s = this._getSpot("crowsNest");
      h.fig.group.position.set(s.position.x, h.baseY, s.position.z);
      h.topY = s.position.y ?? h.baseY;
      h.scanFacing = s.facing ?? 0;
      h.phase = "climbing";
      h.climbT = 0;
    } else {
      this.applyTask(h, task);
      h.phase = "settled";
    }
  }

  // plank.js calls this at muster; nearest free deck hand peels off to escort
  requestEscort() {
    if (this.escortBusy) return;
    const base = this._getSpot("plankBase");
    const tip = this._getSpot("plankTip");
    let best = null, bd = Infinity;
    for (const h of this.hands) {
      if (h.escorting) continue;
      if (h.phase === "climbing" || h.phase === "descending" || h.task === "crowsNest") continue;
      const dx = h.fig.group.position.x - base.position.x;
      const dz = h.fig.group.position.z - base.position.z;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = h; }
    }
    if (!best) {
      for (const h of this.hands) if (!h.escorting) { best = h; break; }
    }
    if (!best) return;

    this.escortBusy = true;
    this._escort = best;
    best.escorting = true;
    best.escortPhase = "toBase";
    best.mop.visible = false;
    best.fig.group.position.y = best.baseY; // in case it was climbing

    const b = this.bounds;
    const tx = clamp(base.position.x - 0.3, b.minX + 0.25, b.maxX - 0.25);
    const tz = clamp(base.position.z - 0.55, b.minZ + 0.25, b.maxZ - 0.25);
    best.walk = this.buildCurve(best.fig.group.position.x, best.fig.group.position.z, tx, tz);
    best.escortFacing = Math.atan2(tip.position.x - tx, tip.position.z - tz);
  }

  updateEscort(h, dt, t) {
    // event's over (or ended early) — rejoin the routine
    if (this.events.plank.phase === "idle") {
      h.escorting = false;
      this.escortBusy = false;
      this._escort = null;
      this.startWalk(h, this.pickTask(this.ws, h));
      return;
    }
    if (h.escortPhase === "toBase") {
      if (this.stepWalk(h, dt, t)) h.escortPhase = "wait";
    } else {
      // stand behind the plank, watching — arms half-raised, a grim witness
      h.fig.group.rotation.set(0, h.escortFacing, 0);
      h.fig.group.position.y = h.baseY;
      restPose(h.fig);
      h.fig.armL.rotation.x = 0.18;
      h.fig.armR.rotation.x = 0.18;
    }
    breathe(h.fig, t, h.phaseOffset);
  }

  idle(h, t, amp) {
    const f = h.fig;
    switch (h.task) {
      case "swab":
        f.armR.rotation.x = 0.8 + Math.sin(t * 3) * 0.4 * amp;
        f.armR.rotation.z = Math.cos(t * 3) * 0.3 * amp;
        f.armL.rotation.x = 0.5 + Math.sin(t * 3 + 1) * 0.2 * amp;
        f.group.rotation.z = Math.sin(t * 1.5) * 0.05 * amp;
        f.group.position.y = h.baseY;
        break;
      case "ropeHaul": {
        const pull = Math.sin(t * 2);
        f.armL.rotation.x = 0.5 - pull * 0.8 * amp;
        f.armR.rotation.x = 0.5 - pull * 0.8 * amp;
        f.legL.rotation.x = 0.3;
        f.legR.rotation.x = -0.2;
        f.group.position.y = h.baseY + Math.max(0, pull) * 0.02 * amp;
        break;
      }
      case "coil":
        f.group.position.y = h.baseY - 0.14 + Math.sin(t * 2) * 0.03 * amp;
        f.legL.rotation.x = 0.5;
        f.legR.rotation.x = 0.5;
        f.armL.rotation.x = 1.1 + Math.sin(t * 2) * 0.2 * amp;
        f.armR.rotation.x = 1.1 + Math.sin(t * 2 + 0.6) * 0.2 * amp;
        break;
      case "crowsNest":
        f.group.rotation.y = h.scanFacing + Math.sin(t * 0.5) * 0.6 * amp;
        f.group.position.y = h.topY + Math.sin(t * 1.2) * 0.02 * amp;
        f.armL.rotation.x = 0.4;
        f.armR.rotation.x = 0.4;
        break;
      case "cannonPolish":
        f.group.position.y = h.baseY - 0.1;
        f.legL.rotation.x = 0.45;
        f.legR.rotation.x = 0.45;
        f.armR.rotation.x = 0.9 + Math.sin(t * 3) * 0.2 * amp;
        f.armR.rotation.z = Math.cos(t * 3) * 0.25 * amp;
        f.armL.rotation.x = 0.6;
        break;
      case "doze":
        f.group.position.y = h.baseY - 0.22;
        f.legL.rotation.x = 1.3;
        f.legR.rotation.x = 1.3;
        f.armL.rotation.x = 0.25;
        f.armR.rotation.x = 0.25;
        f.group.rotation.z = 0.12; // slumped against the hatch coaming
        break;
    }
  }

  update(ws, dt) {
    this.ws = ws;
    const t = ws.time;
    const amp = ws.reduced ? 0.35 : 1;

    for (const h of this.hands) {
      if (h.escorting) {
        this.updateEscort(h, dt, t);
        continue;
      }

      switch (h.phase) {
        case "walking":
          if (this.stepWalk(h, dt, t)) this.arrive(h);
          break;

        case "climbing": {
          h.climbT += dt;
          const fr = Math.min(1, h.climbT / 3.2); // taller mainmast → longer glide up
          h.fig.group.position.y = h.baseY + (h.topY - h.baseY) * easeInOut(fr);
          h.fig.armL.rotation.x = 1.4;
          h.fig.armR.rotation.x = 1.4;
          h.fig.legL.rotation.x = 0.1;
          h.fig.legR.rotation.x = 0.1;
          if (fr >= 1) {
            h.phase = "settled";
            h.task = "crowsNest";
            h.taskTime = 0;
            h.taskDuration = 40 + Math.random() * 20;
          }
          break;
        }

        case "descending": {
          h.climbT += dt;
          const fr = Math.min(1, h.climbT / 2.8);
          h.fig.group.position.y = h.topY + (h.baseY - h.topY) * easeInOut(fr);
          h.fig.group.rotation.y = h.scanFacing;
          h.fig.armL.rotation.x = 1.4;
          h.fig.armR.rotation.x = 1.4;
          if (fr >= 1) this.startWalk(h, this.pickTask(ws, h));
          break;
        }

        case "settled":
        default:
          h.taskTime += dt;
          this.idle(h, t, amp);
          if (h.taskTime > h.taskDuration) {
            if (h.task === "crowsNest") {
              h.phase = "descending";
              h.climbT = 0;
            } else {
              this.startWalk(h, this.pickTask(ws, h));
            }
          }
          break;
      }

      breathe(h.fig, t, h.phaseOffset);
    }
  }
}
