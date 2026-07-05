// Weather: a slow state machine over clear / rain / storm that writes its
// numbers into ws.weather and owns the rain streaks and storm flash spikes.
// Cycle publishes ws.weather (and applies the light dimming from these numbers);
// this module only drives the numbers + its own meshes. (Fog was removed in v3:
// scene distance-fog stays, but there is no fog KIND or mist plane — rain just
// thickens the air a touch, which is atmosphere, not an event.)
//
// Ordering (main.js): cycle.update(dt) runs first (dims light from LAST frame's
// weather numbers), THEN weather.update(ws, dt) advances the machine + visuals.
import * as THREE from "three";
import { COLORS, unlit } from "./palette.js";

const smooth = (x) => x * x * (3 - 2 * x);
const rand = (a, b) => a + Math.random() * (b - a);
const lerp = THREE.MathUtils.lerp;

// Target numbers per kind. fogFactor: main.js multiplies fog distances (rain
// thickens the air a little — atmosphere, not a fog event). dim: light
// multiplier applied by cycle. rain: 0..1 streak density + sound.
const PROFILES = {
  clear: { fogFactor: 1.0, dim: 1.0, rain: 0.0 },
  rain: { fogFactor: 0.8, dim: 0.82, rain: 0.8 },
  storm: { fogFactor: 0.7, dim: 0.75, rain: 1.0 },
};

// dwell seconds per kind — clear lingers longest (fog's old weight folded in),
// storm passes quickly
const DWELL = { clear: [60, 150], rain: [30, 70], storm: [18, 45] };

// Markov step. clear ↔ rain, and storm reachable ONLY from rain. Fog's old
// probability is folded into clear: clear mostly re-dwells (a self-transition
// just resets its timer, no visual change), keeping ~85% clear occupancy.
function nextKind(cur) {
  const r = Math.random();
  switch (cur) {
    case "clear": return r < 0.80 ? "clear" : "rain";
    case "rain": return r < 0.52 ? "clear" : r < 0.84 ? "rain" : "storm";
    case "storm": return r < 0.55 ? "rain" : "clear";
  }
  return "clear";
}

export class Weather {
  constructor(scene) {
    const q = new URLSearchParams(location.search);
    const w = q.get("weather");
    this.pin = ["clear", "rain", "storm"].includes(w) ? w : null;
    this.island = typeof document !== "undefined" && document.body
      && document.body.dataset.mode === "island";
    this.reduced = typeof window !== "undefined" && window.matchMedia
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // machine state
    this.kind = this.pin || "clear";
    this.blend = 1; // 0..1 eased progress into the current kind
    this.trans = 0; // seconds left in the current transition (0 = settled)
    this.transDur = 1;
    this.dwell = rand(...DWELL[this.kind]);
    this.flash = 0;
    this.flashT = rand(6, 16);

    // fixed scratch number-bags (no per-frame allocation)
    this._cur = { fogFactor: 0, dim: 1, rain: 0 };
    this._from = { fogFactor: 0, dim: 1, rain: 0 };
    this._to = { fogFactor: 0, dim: 1, rain: 0 };
    copyProfile(this._cur, PROFILES[this.kind]);

    this.dummy = new THREE.Object3D();

    // ---- rain: one instanced field of thin streaks in a near-camera volume ----
    this.max = this.reduced ? 40 : 140;
    const rgeo = new THREE.BoxGeometry(0.012, 0.9, 0.012);
    const rmat = unlit(COLORS.foam, { transparent: true, opacity: 0.5, fog: false });
    this.rain = new THREE.InstancedMesh(rgeo, rmat, this.max);
    this.rain.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.drops = [];
    for (let i = 0; i < this.max; i++) {
      const d = { x: 0, y: 0, z: 0, speed: 0, len: 1 };
      this._respawn(d);
      d.y = rand(0.2, 15); // scatter through the column on the first frame
      this.drops.push(d);
    }
    scene.add(this.rain);
  }

  // respawn a drop at the top of the volume; on the island page, inside the bowl
  _respawn(d) {
    if (this.island) {
      const r = Math.sqrt(Math.random()) * 12.5, a = Math.random() * Math.PI * 2;
      d.x = Math.cos(a) * r; d.z = Math.sin(a) * r;
    } else {
      d.x = (Math.random() - 0.5) * 36;
      d.z = (Math.random() - 0.5) * 36;
    }
    d.y = rand(12, 15);
    d.speed = rand(13, 18);
    d.len = rand(0.7, 1.2);
  }

  update(ws, dt) {
    this._advance(dt);

    const wx = ws.weather;
    wx.kind = this.kind;
    wx.blend = this.blend;
    wx.fogFactor = this._cur.fogFactor;
    wx.dim = this._cur.dim;
    wx.rainAmount = this._cur.rain;
    wx.flash = this.flash;

    this._updateRain(dt, this._cur.rain);
  }

  _advance(dt) {
    if (this.pin) {
      copyProfile(this._cur, PROFILES[this.kind]); // pinned: sit fully in the kind
      this.blend = 1;
    } else if (this.trans > 0) {
      this.trans -= dt;
      const e = smooth(THREE.MathUtils.clamp(1 - this.trans / this.transDur, 0, 1));
      lerpProfiles(this._cur, this._from, this._to, e);
      this.blend = e;
      if (this.trans <= 0) {
        this.trans = 0;
        this.blend = 1;
        copyProfile(this._cur, this._to);
        this.dwell = rand(...DWELL[this.kind]);
      }
    } else {
      this.dwell -= dt;
      if (this.dwell <= 0) this._startTransition();
    }

    // storm flash: a spike to 1 every 6–16s, exponential decay (~0.25s)
    if (this.kind === "storm") {
      this.flashT -= dt;
      if (this.flashT <= 0) { this.flash = 1; this.flashT = rand(6, 16); }
    }
    this.flash *= Math.exp(-dt * 11);
    if (this.flash < 0.003) this.flash = 0;
  }

  _startTransition() {
    const nk = nextKind(this.kind);
    copyProfile(this._from, this._cur); // ease from wherever we are now
    copyProfile(this._to, PROFILES[nk]);
    this.kind = nk;
    this.transDur = rand(10, 18);
    this.trans = this.transDur;
    this.blend = 0;
  }

  _updateRain(dt, amount) {
    const activeN = Math.round(this.max * amount);
    for (let i = 0; i < this.max; i++) {
      if (i >= activeN) {
        this.dummy.scale.setScalar(0);
        this.dummy.updateMatrix();
        this.rain.setMatrixAt(i, this.dummy.matrix);
        continue;
      }
      const d = this.drops[i];
      d.y -= d.speed * dt;
      d.x += d.speed * 0.06 * dt; // slight wind-driven slant
      if (d.y < 0) this._respawn(d);
      this.dummy.position.set(d.x, d.y, d.z);
      this.dummy.rotation.set(0, 0, 0.12);
      this.dummy.scale.set(1, d.len, 1);
      this.dummy.updateMatrix();
      this.rain.setMatrixAt(i, this.dummy.matrix);
    }
    this.rain.instanceMatrix.needsUpdate = true;
    this.rain.visible = activeN > 0;
  }
}

function copyProfile(dst, src) {
  dst.fogFactor = src.fogFactor;
  dst.dim = src.dim;
  dst.rain = src.rain;
}

function lerpProfiles(dst, a, b, e) {
  dst.fogFactor = lerp(a.fogFactor, b.fogFactor, e);
  dst.dim = lerp(a.dim, b.dim, e);
  dst.rain = lerp(a.rain, b.rain, e);
}
