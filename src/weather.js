// Weather: one falling-particle system reused for petals, leaves, snow, plus
// each season's signature — spring rain, summer fireflies, autumn mist. Seasons
// cross-fade by respawning particles into the current config, so the old
// season's particles thin out as they land and dissolve rather than popping.
import * as THREE from "three";
import { COLORS } from "./world.js";

// Falling particle config per season. size=[w,h], fall=[base,range] (speed),
// count scales density, area picks the spawn volume. summer has no fall system.
const FALL_CONFIGS = {
  spring: { colors: [0xf2b8c6, 0xfbdce4], size: [0.075, 0.05], fall: [0.11, 0.09], count: 1.0, area: "tree" },
  summer: null,
  autumn: { colors: [0xd98e4a, 0xc96b3f], size: [0.095, 0.07], fall: [0.14, 0.1], count: 0.8, area: "tree" },
  winter: { colors: [0xffffff, 0xf4f2ec], size: [0.05, 0.05], fall: [0.07, 0.05], count: 1.2, area: "sky" },
};

export class Weather {
  constructor(scene, treePosition, reducedMotion, initialSeason) {
    this.tree = treePosition.clone ? treePosition.clone() : treePosition;
    this.reduced = reducedMotion;
    this.max = reducedMotion ? 30 : 110;
    this.dummy = new THREE.Object3D();
    this._col = new THREE.Color();

    // ---- falling particles (petals / leaves / snow) ----
    const geo = new THREE.PlaneGeometry(1, 1); // unit plane; per-instance size via scale
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    this.fall = new THREE.InstancedMesh(geo, material, this.max);
    this.fall.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fall.frustumCulled = false;
    // seed with the season the cycle actually opens on (passed in, so it stays in
    // sync with the cycle's random default), so no stray spring petals bleed into
    // an autumn/winter/summer first load
    this.items = Array.from({ length: this.max }, () => this.spawn(FALL_CONFIGS[initialSeason], true));
    for (let i = 0; i < this.max; i++) {
      const p = this.items[i];
      this.fall.setColorAt(i, this._col.setHex(p.cfg ? p.color : 0xffffff));
    }
    scene.add(this.fall);

    // ---- spring rain (bursts) ----
    if (!reducedMotion) {
      const rgeo = new THREE.BoxGeometry(0.01, 0.5, 0.01);
      const rmat = new THREE.MeshBasicMaterial({ color: 0xcfdbe2, transparent: true, opacity: 0.5 });
      this.rain = new THREE.InstancedMesh(rgeo, rmat, 60);
      this.rain.frustumCulled = false;
      this.rain.visible = false;
      this.rainDrops = Array.from({ length: 60 }, () => ({
        x: (Math.random() - 0.5) * 14,
        y: Math.random() * 6,
        z: (Math.random() - 0.5) * 12,
      }));
      this.rainDrops.forEach((d, i) => this.placeRain(i, d));
      this.rain.instanceMatrix.needsUpdate = true;
      scene.add(this.rain);
      this.rainOn = false;
      this.rainTimer = 90 + Math.random() * 60; // seconds until next burst
      this.rainDur = 0;
    }

    // ---- summer fireflies ----
    const fgeo = new THREE.IcosahedronGeometry(0.03, 0);
    this.fireflyGroup = new THREE.Group();
    this.fireflyGroup.visible = false;
    this.fireflies = [];
    for (let i = 0; i < 14; i++) {
      const fmat = new THREE.MeshBasicMaterial({ color: COLORS.flameCore, transparent: true, opacity: 0 });
      const m = new THREE.Mesh(fgeo, fmat);
      const base = {
        x: -3 + Math.random() * 7, // clearing x∈[-3,4]
        y: 0.3 + Math.random() * 1.3, // y∈[0.3,1.6]
        z: -3 + Math.random() * 5, // z∈[-3,2]
      };
      m.position.set(base.x, base.y, base.z);
      m.userData = { base, phase: Math.random() * Math.PI * 2, speed: 0.4 + Math.random() * 0.5 };
      this.fireflies.push(m);
      this.fireflyGroup.add(m);
    }
    scene.add(this.fireflyGroup);

    // ---- autumn mist ----
    const mgeo = new THREE.IcosahedronGeometry(1, 0);
    this.mistGroup = new THREE.Group();
    this.mistGroup.visible = false;
    this.mist = [];
    const mistSpots = [
      [-5, -3], [4, 3], [-3.5, 4], [5, -4],
    ];
    for (const [x, z] of mistSpots) {
      const r = 0.9 + Math.random() * 0.5;
      const mmat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, depthWrite: false });
      const m = new THREE.Mesh(mgeo, mmat);
      m.scale.set(r, r * 0.25, r); // flattened wisp near the ground
      m.position.set(x, 0.35, z);
      this.mist.push(m);
      this.mistGroup.add(m);
    }
    scene.add(this.mistGroup);

    // debug hook: force rain via window.__weather.rainOn = true (see report)
    if (import.meta.env.DEV && typeof window !== "undefined") window.__weather = this;
  }

  // Build one falling particle. cfg=null → a hidden placeholder that recycles
  // on a short timer, so leaving summer repopulates gradually (no pop).
  spawn(cfg, anywhere = false) {
    if (!cfg) return { cfg: null, rest: 0, restFor: 1 + Math.random() * 2.5 };
    const tree = cfg.area === "tree";
    return {
      cfg,
      x: tree ? this.tree.x + (Math.random() - 0.5) * 3.2 : (Math.random() - 0.5) * 14,
      y: anywhere
        ? Math.random() * (tree ? 2.4 : 5.5)
        : tree
        ? 1.6 + Math.random() * 1.0
        : 3.5 + Math.random() * 2.0,
      z: tree ? this.tree.z + (Math.random() - 0.5) * 2.6 : (Math.random() - 0.5) * 12,
      fall: cfg.fall[0] + Math.random() * cfg.fall[1],
      w: cfg.size[0],
      h: cfg.size[1],
      color: cfg.colors[Math.random() < 0.45 ? 1 : 0],
      swayPhase: Math.random() * Math.PI * 2,
      swayAmp: 0.25 + Math.random() * 0.3,
      drift: 0.05 + Math.random() * 0.12, // gentle wind, blows +x
      spin: (Math.random() - 0.5) * 1.1,
      rest: 0,
      restFor: 2.5 + Math.random() * 3,
    };
  }

  commit(i) {
    this.dummy.updateMatrix();
    this.fall.setMatrixAt(i, this.dummy.matrix);
  }

  update(dt, t, ws) {
    this.updateFall(dt, t, ws);
    this.updateRain(dt, ws);
    this.updateFireflies(t, ws);
    this.updateMist(dt, ws);
  }

  updateFall(dt, t, ws) {
    const cur = FALL_CONFIGS[ws.season];
    const nxt = FALL_CONFIGS[ws.nextSeason];
    const b = ws.seasonBlend;
    const curN = cur ? Math.round(this.max * cur.count) : 0;
    const nxtN = nxt ? Math.round(this.max * nxt.count) : 0;
    const activeN = Math.min(this.max, Math.round(curN + (nxtN - curN) * b));
    const pick = () => (Math.random() < b ? nxt : cur); // cross-fade during the blend window
    let colorDirty = false;

    const respawn = (i) => {
      const p = (this.items[i] = this.spawn(pick()));
      if (p.cfg) {
        this.fall.setColorAt(i, this._col.setHex(p.color));
        colorDirty = true;
      }
      return p;
    };

    for (let i = 0; i < this.max; i++) {
      let p = this.items[i];
      // instances beyond the active density budget stay hidden; keep resting
      // them (rest timer still advances) so they respawn into the CURRENT
      // config while hidden, instead of carrying a stale season's particle
      // (e.g. spring petals) that would pop in once activeN grows again
      if (i >= activeN) {
        this.dummy.scale.setScalar(0);
        this.commit(i);
        p.rest += dt;
        if (p.rest > p.restFor) respawn(i);
        continue;
      }
      // placeholder (no active season particle): hide, recycle on its timer
      if (!p.cfg) {
        this.dummy.scale.setScalar(0);
        this.commit(i);
        p.rest += dt;
        if (p.rest > p.restFor) respawn(i);
        continue;
      }
      if (p.y <= 0.02) {
        p.rest += dt;
        if (p.rest > p.restFor) {
          p = respawn(i);
          if (!p.cfg) {
            this.dummy.scale.setScalar(0);
            this.commit(i);
            continue;
          }
        }
      } else {
        p.y -= p.fall * dt;
        p.x += (Math.sin(t * 0.8 + p.swayPhase) * p.swayAmp * 0.4 + p.drift) * dt;
        p.z += Math.cos(t * 0.6 + p.swayPhase) * 0.1 * dt;
      }
      const settled = p.y <= 0.02;
      const scale = settled ? Math.max(0, 1 - Math.max(0, p.rest - p.restFor + 1)) : 1;
      this.dummy.position.set(p.x, Math.max(p.y, 0.02), p.z);
      this.dummy.rotation.set(
        settled ? -Math.PI / 2 : Math.sin(t * p.spin + p.swayPhase) * 1.2,
        settled ? p.swayPhase : t * p.spin,
        settled ? 0 : p.swayPhase
      );
      this.dummy.scale.set(p.w * scale, p.h * scale, 1);
      this.commit(i);
    }
    this.fall.instanceMatrix.needsUpdate = true;
    if (colorDirty && this.fall.instanceColor) this.fall.instanceColor.needsUpdate = true;
  }

  placeRain(i, d) {
    this.dummy.position.set(d.x, d.y, d.z);
    this.dummy.rotation.set(0, 0, 0);
    this.dummy.scale.setScalar(1);
    this.dummy.updateMatrix();
    this.rain.setMatrixAt(i, this.dummy.matrix);
  }

  updateRain(dt, ws) {
    if (this.reduced || !this.rain) return;
    if (ws.season === "spring") {
      if (this.rainOn) {
        this.rainDur -= dt;
        if (this.rainDur <= 0) {
          this.rainOn = false;
          this.rainTimer = 90 + Math.random() * 60;
        }
      } else {
        this.rainTimer -= dt;
        if (this.rainTimer <= 0) {
          this.rainOn = true;
          this.rainDur = 22;
        }
      }
    } else {
      this.rainOn = false;
    }
    this.rain.visible = this.rainOn;
    if (!this.rainOn) return;
    this.rainDrops.forEach((d, i) => {
      d.y -= 8 * dt;
      if (d.y < 0) {
        d.y += 6 + Math.random() * 2;
        d.x = (Math.random() - 0.5) * 14;
        d.z = (Math.random() - 0.5) * 12;
      }
      this.placeRain(i, d);
    });
    this.rain.instanceMatrix.needsUpdate = true;
  }

  updateFireflies(t, ws) {
    const on = ws.season === "summer";
    this.fireflyGroup.visible = on;
    if (!on) return;
    for (const m of this.fireflies) {
      const u = m.userData;
      if (!this.reduced) {
        m.position.set(
          u.base.x + Math.sin(t * u.speed + u.phase) * 0.6,
          u.base.y + Math.sin(t * u.speed * 0.7 + u.phase * 1.3) * 0.35,
          u.base.z + Math.cos(t * u.speed * 0.8 + u.phase) * 0.6
        );
      }
      const pulse = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2.5 + u.phase));
      m.material.opacity = ws.night * pulse; // fireflies only glow at night
    }
  }

  updateMist(dt, ws) {
    const on = ws.season === "autumn";
    this.mistGroup.visible = on;
    if (!on || this.reduced) return;
    for (const m of this.mist) {
      m.position.x += 0.05 * dt;
      if (m.position.x > 8) m.position.x = -8; // wrap across the island
    }
  }
}
