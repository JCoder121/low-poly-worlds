// sparrow's wake — everything celestial. Sun/moon discs, phased moon, stars,
// shooting stars. Two page modes:
//   'expanse' — the sky is a hazed top strip of an ortho iso frame, so it lives
//     as a camera-child band layer (camera-local coords, depthTest off, drawn
//     over the fog-faded far water). Discs arc high enough to slide off-frame
//     around noon/midnight ("absent noon").
//   'island'  — the fishbowl page: celestials are WORLD-anchored above the bowl
//     with normal depth testing, billboarded to face the camera.
// All animation from ws.time; colors from ws/palette; the pale moon + star hex
// are approved constants. Zero per-frame allocations.
import * as THREE from "three";
import { COLORS } from "./palette.js";

const MOON_PALE = 0xe8e4d4; // approved constant
const STAR_HEX = 0xf5f0e0; // approved constant

// module scratch — never reallocated
const _camPos = new THREE.Vector3();
const _col = new THREE.Color();

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

export class Sky {
  constructor(scene, camera, pageMode) {
    this.camera = camera;
    this.island = pageMode === "island";
    const r = this.island ? 1.1 : 0.8; // disc radius (moon slightly smaller)

    this.layer = new THREE.Group();
    this.layer.frustumCulled = false;

    // --- sun disc ---
    this.sun = this._disc(r, 0xffffff, this.island ? 20 : 92);

    // --- moon: pale disc + a bg-tinted overlay that carves the phase ---
    this.moonGroup = new THREE.Group();
    this.moon = this._disc(this.island ? 1.1 : 0.75, MOON_PALE, this.island ? 20 : 92);
    this.moonOverlay = this._disc(this.island ? 1.1 : 0.75, 0x000000, this.island ? 22 : 93);
    this.moonR = this.island ? 1.1 : 0.75;
    this.moonGroup.add(this.moon, this.moonOverlay);
    // overlay sits a hair in front of the moon (group-local +z faces camera)
    this.moonOverlay.position.z = this.island ? 0.02 : 0.3;

    // --- stars ---
    this.stars = this._buildStars();

    // --- shooting star (pooled, reused) ---
    this._buildShoot();

    this.layer.add(this.sun, this.moonGroup, this.stars, this.shootGroup);

    if (this.island) scene.add(this.layer);
    else camera.add(this.layer); // main.js does scene.add(camera) before us
  }

  _disc(radius, color, renderOrder) {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthTest: this.island, // camera-child band skips depth; world discs keep it
      depthWrite: false,
      fog: false,
    });
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 32), mat);
    mesh.renderOrder = renderOrder;
    mesh.frustumCulled = false;
    return mesh;
  }

  _buildStars() {
    const pts = [];
    if (this.island) {
      // scattered on a shell above the bowl (radius ~12, y > 4)
      for (let i = 0; i < 90; i++) {
        const u = Math.random() * Math.PI * 2;
        const v = Math.acos(2 * Math.random() - 1);
        const x = 12 * Math.sin(v) * Math.cos(u);
        const z = 12 * Math.sin(v) * Math.sin(u);
        let y = 12 * Math.cos(v);
        if (y < 4) y = 4 + Math.random() * 8; // keep them overhead
        pts.push(x, y, z);
      }
    } else {
      // ~150 across the band; corners lift slightly for a dome hint
      for (let i = 0; i < 150; i++) {
        const x = (Math.random() - 0.5) * 46; // ±23
        const y = 3 + Math.random() * 10; // 3..13
        pts.push(x, y + Math.abs(x) * 0.05, -58);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const mat = new THREE.PointsMaterial({
      color: STAR_HEX,
      size: this.island ? 0.14 : 0.22,
      transparent: true,
      opacity: 0,
      depthTest: this.island,
      depthWrite: false,
      fog: false,
    });
    const stars = new THREE.Points(geo, mat);
    stars.renderOrder = this.island ? 19 : 90;
    stars.frustumCulled = false;
    return stars;
  }

  _buildShoot() {
    // one thin bright streak, oriented at activation and faded through its life
    this.shootGroup = new THREE.Group();
    this.shootGroup.frustumCulled = false;
    const len = this.island ? 3.2 : 3.6;
    const thick = this.island ? 0.05 : 0.07;
    const mat = new THREE.MeshBasicMaterial({
      color: COLORS.foam,
      transparent: true,
      opacity: 0,
      depthTest: this.island,
      depthWrite: false,
      fog: false,
    });
    this.shoot = new THREE.Mesh(new THREE.PlaneGeometry(len, thick), mat);
    this.shoot.renderOrder = this.island ? 24 : 94;
    this.shoot.frustumCulled = false;
    this.shootGroup.add(this.shoot);
    // travel geometry (set per launch), state, and schedule
    this._sx = 0; this._sy = 0; this._dx = 1; this._dy = 0; this._travel = 15;
    this.shootActive = false;
    this.shootStart = 0;
    this.shootDur = 0.7;
    this.shootNext = 100 + Math.random() * 140; // first possible fire (ws.time)
  }

  update(ws) {
    const L = ws.lighting || {};
    const w = ws.weather || {};
    const kind = w.kind || "clear";
    const time = ws.time || 0;

    // --- defensive v2 reads (survive the pre-v2 cycle.js during parallel work)
    const discPos = clamp01(L.discPos != null ? L.discPos : 0.5);
    const starAlpha = L.starAlpha != null ? L.starAlpha : 0;
    const moonPhase = ws.moonPhase != null ? ws.moonPhase : 0.5;
    const blend = ws.blend != null ? ws.blend : starAlpha; // 0 day → 1 night

    // sky-matched sun disc color; bg carves the moon phase
    const sunColor = L.sunColor || L.sun;
    const bg = L.bg;

    // day/night selection — quick crossfade; near the swap the up-disc is at
    // the horizon (discPos ~0/1) and already faded by the rise/set ramp.
    const nightF = smoothstep(0.45, 0.55, blend);
    const dayF = 1 - nightF;

    // fade in/out over the first/last 8% of the arc — no popping at rise/set
    const riseSet = clamp01(discPos / 0.08) * clamp01((1 - discPos) / 0.08);

    // weather dims discs 60%, stars 75%
    const clear = kind === "clear";
    const discWx = clear ? 1 : 0.4;
    const starWx = clear ? 1 : 0.25;

    // --- arc position of whichever disc is up ---
    let dx, dy;
    if (this.island) {
      dx = 13 * Math.cos(Math.PI * discPos);
      dy = 1.2 + 12.3 * Math.sin(Math.PI * discPos);
    } else {
      dx = lerp(-19, 19, discPos);
      dy = 2.5 + 16 * Math.sin(Math.PI * discPos); // apex overshoots the band
    }

    // --- sun ---
    if (sunColor) this.sun.material.color.copy(sunColor);
    this.sun.material.opacity = dayF * riseSet * discWx;
    this._place(this.sun, dx, dy);

    // --- moon + phase overlay ---
    const moonOp = nightF * riseSet * discWx;
    this.moon.material.opacity = moonOp;
    this.moon.material.color.set(MOON_PALE);
    this._place(this.moonGroup, dx, dy);

    // overlay carves the lit fraction: full disc off at phase 0.5 (full moon),
    // fully covering at phase 0 / 1 (new). Slides across as phase advances.
    const d = Math.abs(2 * moonPhase - 1); // 0 at full, 1 at new
    const sign = moonPhase < 0.5 ? -1 : 1;
    const offX = sign * (1 - d) * 2 * this.moonR;
    this.moonOverlay.position.x = offX;
    if (bg) this.moonOverlay.material.color.copy(bg);
    this.moonOverlay.material.opacity = moonOp;

    // --- stars ---
    this.stars.material.opacity = starAlpha * starWx * 0.9;

    // --- shooting star (clear nights only) ---
    this._updateShoot(ws, time, starAlpha, clear, dayF);

    // island celestials billboard to face the camera
    if (this.island) {
      this.camera.getWorldQuaternion(this.sun.quaternion);
      this.moonGroup.quaternion.copy(this.sun.quaternion);
    }
  }

  _place(obj, x, y) {
    if (this.island) obj.position.set(x, y, 0);
    else obj.position.set(x, y, -57);
  }

  _updateShoot(ws, time, starAlpha, clear, dayF) {
    if (this.shootActive) {
      const p = (time - this.shootStart) / this.shootDur;
      if (p < 0 || p > 1) {
        this.shootActive = false;
        this.shoot.material.opacity = 0;
        this.shootNext = time + 100 + Math.random() * 140;
        return;
      }
      const x = this._sx + this._dx * this._travel * p;
      const y = this._sy + this._dy * this._travel * p;
      this._place(this.shoot, x, y);
      // bright, then a fading tail as it goes
      this.shoot.material.opacity = Math.sin(Math.PI * p) * (p < 0.5 ? 1 : 0.85);
      if (this.island) this.shootGroup.quaternion.copy(this.sun.quaternion);
      return;
    }
    // dormant — decide whether to launch
    const canFire = clear && starAlpha > 0.6 && !(ws.reduced) && dayF < 0.2;
    if (canFire && time >= this.shootNext) {
      this.shootActive = true;
      this.shootStart = time;
      this._travel = 15;
      if (this.island) {
        // arc across, over the bowl, slight downward slant
        this._sx = 8; this._sy = 13 + Math.random() * 2;
        this._dx = -1; this._dy = -0.28;
      } else {
        this._sx = -12 + Math.random() * 6;
        this._sy = 9 + Math.random() * 3;
        this._dx = 1; this._dy = -0.28;
      }
      // normalize the direction so travel length holds regardless of slant
      const m = Math.hypot(this._dx, this._dy);
      this._dx /= m; this._dy /= m;
      // orient the streak plane along travel
      this.shoot.rotation.z = Math.atan2(this._dy, this._dx);
    } else if (time < this.shootNext - 400) {
      // ws.time was scrubbed backward — resync the schedule
      this.shootNext = time + 100 + Math.random() * 140;
    }
  }
}
