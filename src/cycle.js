// Day/night state. Two discrete modes with a 3s eased crossfade; every other
// module reads the precomputed `ws` (world state) each frame.
import * as THREE from "three";
import { COLORS } from "./palette.js";

const params = new URLSearchParams(location.search);
const easeInOut = (u) => u * u * (3 - 2 * u);

const DAY = {
  bg: new THREE.Color(COLORS.parchment),
  sun: new THREE.Color(0xffe8c0),
  sunIntensity: 1.8,
  hemiSky: new THREE.Color(0xfff2d9),
  hemiGround: new THREE.Color(0xbfd0ce),
  hemiIntensity: 0.85,
  fillIntensity: 0.4,
  trough: new THREE.Color(COLORS.troughDay),
  mid: new THREE.Color(COLORS.midDay),
  crest: new THREE.Color(COLORS.crestDay),
  starAlpha: 0,
  lampIntensity: 0,
};

const NIGHT = {
  bg: new THREE.Color(COLORS.nightBg),
  sun: new THREE.Color(0xbfd4ec),
  sunIntensity: 1.1,
  hemiSky: new THREE.Color(0x35436a),
  hemiGround: new THREE.Color(0x1a2233),
  hemiIntensity: 0.65,
  fillIntensity: 0.18,
  trough: new THREE.Color(COLORS.troughNight),
  mid: new THREE.Color(COLORS.midNight),
  crest: new THREE.Color(COLORS.crestNight),
  starAlpha: 1,
  lampIntensity: 1,
};

export class Cycle {
  constructor() {
    this.live = localStorage.getItem("sw-live") === "1" || params.get("real") === "1";
    let mode = params.get("mode");
    if (!mode && this.live) {
      const h = new Date().getHours();
      mode = h >= 7 && h < 19 ? "day" : "night";
    }
    if (mode !== "day" && mode !== "night") mode = Math.random() < 0.5 ? "day" : "night";
    this.mode = mode;
    this.blend = mode === "night" ? 1 : 0; // 0 = day, 1 = night
    this.target = this.blend;
    this.speed = params.has("speed") ? parseFloat(params.get("speed")) : 1;
    this.time = 0; // world clock (drives waves + all animation)

    // Precomputed per-frame lighting state — read, don't mutate.
    this.ws = {
      mode: this.mode,
      blend: this.blend,
      time: 0,
      reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      lighting: {
        bg: new THREE.Color(),
        sun: new THREE.Color(),
        sunIntensity: 0,
        hemiSky: new THREE.Color(),
        hemiGround: new THREE.Color(),
        hemiIntensity: 0,
        fillIntensity: 0,
        trough: new THREE.Color(),
        mid: new THREE.Color(),
        crest: new THREE.Color(),
        starAlpha: 0,
        lampIntensity: 0,
      },
    };
    this._apply();
  }

  toggle() {
    this.mode = this.mode === "day" ? "night" : "day";
    this.target = this.mode === "night" ? 1 : 0;
  }

  update(dt) {
    this.time += dt * this.speed;
    const step = dt / 3; // 3s crossfade (real time, not scrubbed)
    if (this.blend < this.target) this.blend = Math.min(this.target, this.blend + step);
    else if (this.blend > this.target) this.blend = Math.max(this.target, this.blend - step);
    this._apply();
  }

  _apply() {
    const u = easeInOut(this.blend);
    const L = this.ws.lighting;
    this.ws.mode = this.mode;
    this.ws.blend = this.blend;
    this.ws.time = this.time;
    L.bg.copy(DAY.bg).lerp(NIGHT.bg, u);
    L.sun.copy(DAY.sun).lerp(NIGHT.sun, u);
    L.hemiSky.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, u);
    L.hemiGround.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, u);
    L.trough.copy(DAY.trough).lerp(NIGHT.trough, u);
    L.mid.copy(DAY.mid).lerp(NIGHT.mid, u);
    L.crest.copy(DAY.crest).lerp(NIGHT.crest, u);
    L.sunIntensity = THREE.MathUtils.lerp(DAY.sunIntensity, NIGHT.sunIntensity, u);
    L.hemiIntensity = THREE.MathUtils.lerp(DAY.hemiIntensity, NIGHT.hemiIntensity, u);
    L.fillIntensity = THREE.MathUtils.lerp(DAY.fillIntensity, NIGHT.fillIntensity, u);
    L.starAlpha = u;
    L.lampIntensity = u;
  }
}
