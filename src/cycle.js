// The world clock: one slow day, four seasons. Everything that changes
// with time reads this module's state; nothing else keeps its own clock.
import * as THREE from "three";

export const DAY_LENGTH = 360; // seconds per full day
export const DAYS_PER_SEASON = 2;
export const SEASONS = ["spring", "summer", "autumn", "winter"];
const SEASON_FADE = 20; // seconds of cross-fade at each season boundary
const DUSK = 0.55; // dayT where v1's golden hour lives; page opens here

// keyframes around the day: [dayT, {bg, hemiSky, hemiGround, hemiIntensity, sunColor, sunIntensity, fillIntensity, starOpacity}]
const KEYS = [
  [0.0,  { bg: 0xf6e8e6, hemiSky: 0xffe8e0, hemiGround: 0xcfc2b8, hemiIntensity: 0.75, sunColor: 0xffd8c2, sunIntensity: 1.2, fillIntensity: 0.4,  starOpacity: 0 }],   // dawn
  [0.25, { bg: 0xf5f0e4, hemiSky: 0xfff8ea, hemiGround: 0xd8d2bd, hemiIntensity: 1.0,  sunColor: 0xfff2d8, sunIntensity: 1.7, fillIntensity: 0.45, starOpacity: 0 }],   // day
  [0.55, { bg: 0xf5f0e4, hemiSky: 0xfff4dd, hemiGround: 0xcfc6ae, hemiIntensity: 0.9,  sunColor: 0xffe0b0, sunIntensity: 1.9, fillIntensity: 0.45, starOpacity: 0 }],   // dusk == v1 golden hour, verbatim
  [0.8,  { bg: 0x232a3d, hemiSky: 0x3a4666, hemiGround: 0x1c2333, hemiIntensity: 0.45, sunColor: 0x8fa3cc, sunIntensity: 0.35, fillIntensity: 0.1, starOpacity: 1 }],   // night
];

function lerpKeys(dayT) {
  const pts = [...KEYS, [KEYS[0][0] + 1, KEYS[0][1]]]; // wrap dawn at t=1
  let a = pts[0], b = pts[1];
  for (let i = 0; i < pts.length - 1; i++) {
    if (dayT >= pts[i][0] && dayT <= pts[i + 1][0]) { a = pts[i]; b = pts[i + 1]; break; }
  }
  const span = b[0] - a[0];
  const k = span === 0 ? 0 : smooth((dayT - a[0]) / span);
  const out = {};
  for (const key of Object.keys(a[1])) {
    if (typeof a[1][key] === "number" && key.match(/Intensity|Opacity/)) {
      out[key] = a[1][key] + (b[1][key] - a[1][key]) * k;
    } else {
      out[key] = new THREE.Color(a[1][key]).lerp(new THREE.Color(b[1][key]), k);
    }
  }
  return out;
}
const smooth = (x) => x * x * (3 - 2 * x);
const wrap01 = (x) => ((x % 1) + 1) % 1;

export class Cycle {
  constructor({ reducedMotion = false } = {}) {
    const q = new URLSearchParams(location.search);
    const sp = Number(q.get("speed"));
    this.speed = reducedMotion ? 0 : q.has("speed") && !isNaN(sp) ? Math.max(0, sp) : 1; // "?speed=0" must freeze

    this.dayT = q.has("time") ? wrap01(Number(q.get("time"))) : DUSK;
    const s = q.get("season");
    this.seasonIndex = s == null ? 0
      : isNaN(Number(s)) ? Math.max(0, SEASONS.indexOf(s))
      : ((Number(s) % 4) + 4) % 4;
    this.seasonTime = 0; // seconds into current season
    this.stars = null;
    this.state = {};
    this._recompute();
  }

  addStars(scene, camera) {
    camera.updateMatrixWorld(); // unproject needs a current matrixWorld pre-render
    const n = 130;
    const positions = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      // scatter across the upper frame: unproject camera-space coordinates so
      // stars are guaranteed on screen regardless of world-space framing
      const ndc = new THREE.Vector3(
        (Math.random() * 2 - 1) * 1.05, // full width, slight overshoot
        Math.random() * 0.95 + 0.05,    // upper ~half of the frame
        0.98                            // near the far plane, behind everything
      );
      ndc.unproject(camera);
      positions.set([ndc.x, ndc.y, ndc.z], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    // ortho camera: no size attenuation, so size is in device pixels; fog off
    // or the far-plane stars get fogged to the background color and vanish
    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xf5f0e4, size: 3, transparent: true, opacity: 0, depthWrite: false, fog: false,
    }));
    scene.add(this.stars);
  }

  update(dt) {
    const step = dt * this.speed;
    this.dayT = wrap01(this.dayT + step / DAY_LENGTH);
    this.seasonTime += step;
    const seasonLen = DAY_LENGTH * DAYS_PER_SEASON;
    if (this.seasonTime >= seasonLen) {
      this.seasonTime -= seasonLen;
      this.seasonIndex = (this.seasonIndex + 1) % 4;
    }
    this._recompute();
    if (this.stars) this.stars.material.opacity = this.state.lighting.starOpacity * 0.9;
  }

  _recompute() {
    const seasonLen = DAY_LENGTH * DAYS_PER_SEASON;
    const untilEnd = seasonLen - this.seasonTime;
    const lighting = lerpKeys(this.dayT);
    // night factor: how deep into night we are (drives fire/lantern/fireflies)
    const night = THREE.MathUtils.clamp((lighting.starOpacity ?? 0), 0, 1);
    this.state = {
      dayT: this.dayT,
      night,
      season: SEASONS[this.seasonIndex],
      seasonIndex: this.seasonIndex,
      nextSeason: SEASONS[(this.seasonIndex + 1) % 4],
      seasonBlend: untilEnd < SEASON_FADE ? 1 - untilEnd / SEASON_FADE : 0,
      lighting,
    };
  }
}
