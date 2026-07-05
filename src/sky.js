// sparrow's wake — everything celestial, disc-less (v3). The sun/moon discs +
// phase overlay + halo are GONE: the lighting cycle alone tells the time now.
// What remains: stars, a pooled shooting star, and three rare pooled events —
//   rainbow      — after a daytime rain→clear break, a soft low-sat 5-band arch
//   meteor shower — clear nights, a dense burst of 5-7 streaks (reuses the pool)
//   gull flock    — day, five tiny flapping two-triangle gulls in a loose V
// Two page modes, same as before:
//   'expanse' — a camera-child band layer (camera-local, z ≈ -57, depthTest off,
//     drawn over the fog-faded far water).
//   'island'  — the fishbowl page: world-anchored above the bowl, billboarded to
//     face the camera.
// All animation from ws.time; colors from palette + a few approved local tints.
// Everything is pooled at construction — zero per-frame allocations.
import * as THREE from "three";
import { COLORS, unlit } from "./palette.js";

const STAR_HEX = 0xf5f0e0; // approved constant
// soft, low-saturation, palette-adjacent rainbow tints (approved local consts).
// index 0 = innermost band (violet) → 4 = outermost (rose); all kept muted so
// the arch reads as haze, never a cartoon rainbow. Opacity is capped ≤ 0.35.
const RAINBOW_TINTS = [0xb3a6cf, 0x9fb6d6, 0x9ccbb0, 0xe6d39a, 0xd9a48f];

// module scratch — never reallocated
const _camPos = new THREE.Vector3();
const _camQuat = new THREE.Quaternion();

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

// loose-V chevron offsets (flock-local, +x = travel direction): a leader with
// two trailing arms.
const CHEV = [
  [0, 0], [-0.9, 0.5], [-0.9, -0.5], [-1.8, 1.0], [-1.8, -1.0],
];

export class Sky {
  constructor(scene, camera, pageMode) {
    this.camera = camera;
    this.island = pageMode === "island";

    this.layer = new THREE.Group();
    this.layer.frustumCulled = false;

    this.stars = this._buildStars();
    this._buildShoot();   // pooled single streak (shared by shower)
    this._buildRainbow(); // pooled 5-band arch
    this._buildGulls();   // pooled flock of 5

    // rain→clear rainbow tracking + event schedules (ws.time based)
    this._prevKind = null;
    this.meteorActive = false;
    this.meteorRemaining = 0;
    this.meteorStreakAt = 0;
    this.meteorNextWindow = 240 + Math.random() * 240; // first chance 4–8 min

    this.layer.add(this.stars, this.shootGroup, this.rainbow, this.gullGroup);

    if (this.island) scene.add(this.layer);
    else camera.add(this.layer); // main.js does scene.add(camera) before us
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
    // one thin bright streak, oriented at launch and faded through its life;
    // reused both for the ambient shooting star and each meteor-shower streak.
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
    // travel geometry (set per launch), state, and ambient schedule
    this._sx = 0; this._sy = 0; this._dx = 1; this._dy = 0; this._travel = 15;
    this.shootActive = false;
    this.shootStart = 0;
    this.shootDur = 0.7;
    this.shootNext = 100 + Math.random() * 140; // first ambient fire (ws.time)
  }

  _buildRainbow() {
    // 5 nested half-rings (RingGeometry, theta 0..π = an upper arch). The arch
    // is oversized and dropped low so only its crown crosses the visible band.
    this.rainbow = new THREE.Group();
    this.rainbow.frustumCulled = false;
    this.rainbow.visible = false;
    const R = this.island ? 13 : 15;
    const width = this.island ? 0.6 : 0.72;
    // drop the arch so its crown lands in-band: expanse below the frame,
    // island right at the waterline so it arcs over the globe.
    this.rainbow.position.set(0, this.island ? 0 : -4, this.island ? 0 : -57);
    this.rainbowMats = [];
    for (let i = 0; i < 5; i++) {
      const inner = R + i * width;
      const geo = new THREE.RingGeometry(inner, inner + width, 48, 1, 0, Math.PI);
      const m = unlit(RAINBOW_TINTS[i], {
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthTest: this.island,
        depthWrite: false,
        fog: false,
      });
      const ring = new THREE.Mesh(geo, m);
      ring.renderOrder = this.island ? 20 : 89;
      ring.frustumCulled = false;
      this.rainbowMats.push(m);
      this.rainbow.add(ring);
    }
    this.rainbowActive = false;
    this.rainbowStart = 0;
    this.rainbowDur = 25;
  }

  _buildGulls() {
    // five tiny gulls, each two mirrored wing triangles sharing one geometry +
    // material. Chevron offsets baked in now; only wing flap + bob animate.
    this.gullGroup = new THREE.Group();
    this.gullGroup.frustumCulled = false;
    this.gullGroup.visible = false;
    this.gulls = [];
    const wingMat = unlit(COLORS.gullWing, {
      transparent: true,
      opacity: 0.92,
      depthTest: this.island,
      depthWrite: false,
      fog: false,
    });
    const wgeo = new THREE.BufferGeometry();
    wgeo.setAttribute("position", new THREE.Float32BufferAttribute(
      [0, 0, 0, -0.55, 0.06, 0, -0.4, -0.14, 0], 3,
    ));
    const ro = this.island ? 21 : 91;
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group();
      const left = new THREE.Mesh(wgeo, wingMat);
      const right = new THREE.Mesh(wgeo, wingMat);
      right.scale.x = -1; // mirror → identical rotation.z reads symmetric
      left.renderOrder = ro; right.renderOrder = ro;
      left.frustumCulled = false; right.frustumCulled = false;
      g.add(left, right);
      const [cx, cy] = CHEV[i];
      g.position.set(cx, cy, 0);
      g.userData = { left, right, fy: cy, phase: Math.random() * Math.PI * 2 };
      this.gulls.push(g);
      this.gullGroup.add(g);
    }
    this.flockActive = false;
    this.flockStart = 0;
    this.flockDur = 14; // seconds to cross the band
    this._flockDir = 1;
    this._flockY = 10;
    this.flockNext = 180 + Math.random() * 180; // first flock 3–6 min
  }

  update(ws) {
    const L = ws.lighting || {};
    const w = ws.weather || {};
    const kind = w.kind || "clear";
    const time = ws.time || 0;

    const starAlpha = L.starAlpha != null ? L.starAlpha : 0;
    const blend = ws.blend != null ? ws.blend : starAlpha; // 0 day → 1 night
    const reduced = !!ws.reduced;
    const clear = kind === "clear";
    const day = blend < 0.5;
    const night = blend > 0.55;

    // weather thins the stars (rain/storm veils them)
    const starWx = clear ? 1 : 0.25;
    this.stars.material.opacity = starAlpha * starWx * 0.9;

    // island celestials are world-anchored → grab camera pose once per frame
    if (this.island) {
      this.camera.getWorldQuaternion(_camQuat);
      this.camera.getWorldPosition(_camPos);
    }

    this._updateRainbow(time, kind, day);
    this._updateMeteor(time, clear, night, reduced);
    this._updateShoot(time, starAlpha, clear, blend, reduced);
    this._updateGulls(time, day, reduced);

    this._prevKind = kind;
  }

  _place(obj, x, y) {
    if (this.island) obj.position.set(x, y, 0);
    else obj.position.set(x, y, -57);
  }

  // --- rainbow: rain → clear during daytime -------------------------------
  _updateRainbow(time, kind, day) {
    if (this._prevKind === "rain" && kind === "clear" && day && !this.rainbowActive) {
      this.rainbowActive = true;
      this.rainbowStart = time;
    }
    if (!this.rainbowActive) return;

    const p = (time - this.rainbowStart) / this.rainbowDur;
    if (p < 0 || p >= 1) { // done (or ws.time scrubbed past it)
      this.rainbowActive = false;
      this.rainbow.visible = false;
      for (const m of this.rainbowMats) m.opacity = 0;
      return;
    }
    // eased fade in (first ~16%) and out (last ~24%), capped ≤ 0.35
    const env = smoothstep(0, 0.16, p) * (1 - smoothstep(0.76, 1, p));
    const op = env * 0.32;
    for (const m of this.rainbowMats) m.opacity = op;
    this.rainbow.visible = true;
    // island arch faces the camera in azimuth while staying upright
    if (this.island) this.rainbow.rotation.y = Math.atan2(_camPos.x, _camPos.z);
  }

  // --- meteor shower window (clear nights) --------------------------------
  _updateMeteor(time, clear, night, reduced) {
    if (this.meteorActive) return;
    if (time >= this.meteorNextWindow) {
      if (clear && night && !reduced) {
        this.meteorActive = true;
        this.meteorRemaining = 5 + Math.floor(Math.random() * 3); // 5–7 streaks
        this.meteorStreakAt = time; // first streak immediately
      } else {
        this.meteorNextWindow = time + 30 + Math.random() * 40; // recheck soon
      }
    }
    if (time < this.meteorNextWindow - 900) { // ws.time scrubbed backward
      this.meteorNextWindow = time + 240 + Math.random() * 240;
    }
  }

  // --- shooting star: ambient single + meteor-shower burst (shared mesh) ---
  _updateShoot(time, starAlpha, clear, blend, reduced) {
    if (this.shootActive) { this._stepShoot(time); return; }

    // shower burst takes priority: fire the pooled streak repeatedly (~12s)
    if (this.meteorActive) {
      if (this.meteorRemaining > 0 && time >= this.meteorStreakAt) {
        this._launchShoot(time);
        this.meteorRemaining--;
        this.meteorStreakAt = time + 1.2 + Math.random(); // ~1.2–2.2s apart
      }
      if (this.meteorRemaining <= 0) {
        this.meteorActive = false;
        this.meteorNextWindow = time + 240 + Math.random() * 240;
      }
      return;
    }

    // ambient single shooting star — clear nights only
    const canFire = clear && starAlpha > 0.6 && !reduced && blend > 0.55;
    if (canFire && time >= this.shootNext) {
      this._launchShoot(time);
      this.shootNext = time + 100 + Math.random() * 140;
    } else if (time < this.shootNext - 400) { // scrubbed backward → resync
      this.shootNext = time + 100 + Math.random() * 140;
    }
  }

  _stepShoot(time) {
    const p = (time - this.shootStart) / this.shootDur;
    if (p < 0 || p > 1) {
      this.shootActive = false;
      this.shoot.material.opacity = 0;
      return;
    }
    const x = this._sx + this._dx * this._travel * p;
    const y = this._sy + this._dy * this._travel * p;
    this._place(this.shoot, x, y);
    // bright, then a fading tail as it goes
    this.shoot.material.opacity = Math.sin(Math.PI * p) * (p < 0.5 ? 1 : 0.85);
    if (this.island) this.shootGroup.quaternion.copy(_camQuat);
  }

  _launchShoot(time) {
    this.shootActive = true;
    this.shootStart = time;
    this._travel = 15;
    if (this.island) {
      this._sx = 6 + Math.random() * 4; this._sy = 12 + Math.random() * 3;
      this._dx = -1; this._dy = -0.28;
    } else {
      this._sx = -12 + Math.random() * 6;
      this._sy = 9 + Math.random() * 3;
      this._dx = 1; this._dy = -0.28;
    }
    // normalize so travel length holds regardless of slant
    const m = Math.hypot(this._dx, this._dy);
    this._dx /= m; this._dy /= m;
    this.shoot.rotation.z = Math.atan2(this._dy, this._dx);
    this.shoot.material.opacity = 0;
  }

  // --- gull flock: a loose V crossing the upper band by day ---------------
  _updateGulls(time, day, reduced) {
    if (!this.flockActive) {
      if (day && !reduced && time >= this.flockNext) {
        this.flockActive = true;
        this.flockStart = time;
        this._flockDir = Math.random() < 0.5 ? 1 : -1;
        this._flockY = this.island ? (9 + Math.random() * 2) : (9.5 + Math.random() * 2.5);
      } else {
        if (time < this.flockNext - 500) this.flockNext = time + 180 + Math.random() * 180;
        this.gullGroup.visible = false;
        return;
      }
    }

    const p = (time - this.flockStart) / this.flockDur;
    if (p < 0 || p >= 1) {
      this.flockActive = false;
      this.gullGroup.visible = false;
      this.flockNext = time + 180 + Math.random() * 180;
      return;
    }

    this.gullGroup.visible = true;
    const dir = this._flockDir;
    if (this.island) {
      this.gullGroup.position.set(dir * (14 - 28 * p), this._flockY, -2);
      this.gullGroup.quaternion.copy(_camQuat);
    } else {
      this.gullGroup.position.set(dir * (-22 + 44 * p), this._flockY, -57);
    }
    this.gullGroup.scale.x = dir; // mirror the chevron to face travel

    for (let i = 0; i < this.gulls.length; i++) {
      const g = this.gulls[i];
      const u = g.userData;
      const f = Math.sin(time * 6 + u.phase) * 0.6; // wing flap
      u.left.rotation.z = f;
      u.right.rotation.z = f;
      g.position.y = u.fy + Math.sin(time * 1.5 + u.phase) * 0.08; // gentle bob
    }
  }
}
