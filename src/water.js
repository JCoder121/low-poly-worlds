// water.js — THE showpiece. A GPU-displaced sheet of calm Caribbean swell,
// flat-shaded so every wavelet is a facet and the moon-glitter path falls out
// of the lighting for free. One draw call for the surface: the vertex stage
// runs the SAME wave model as waves.js (waveGLSL is string-built from the same
// constants), so the sea and everything floating on it can never disagree.
//
// The fragment ramps trough→mid→crest by the vertex's own wave height (passed
// down a varying), biased toward mid so the pale crest reads as a highlight,
// not a wash. Colors and amplitude arrive as uniforms synced from `ws` each
// frame; scene lighting + fog do the rest (day/night darkening, far-edge fade).
//
// splash()/ring() draw event foam from pre-allocated pools, animated purely
// from ws.time — no timers, no per-frame allocations anywhere in update.
import * as THREE from "three";
import CustomShaderMaterial from "three-custom-shader-material/vanilla";
import { COLORS, mat, unlit } from "./palette.js";
import { WAVE_MAX, waveHeight, waveGLSL } from "./waves.js";

// ---- shader source (wave function shared with waves.js via waveGLSL) --------
const VERT = /* glsl */ `
uniform float uTime;
uniform float uAmp;
flat varying float vWaveH;
flat varying float vHash;

${waveGLSL()}

void main() {
  // position.xz are world XY of the grid (rotation baked into the geometry).
  float h = waveHeight(position.xz, uTime);
  vWaveH = h;                 // raw ±WAVE_MAX; fragment normalizes it
  // per-facet hash from the provoking vertex (geometry is non-indexed, so
  // this is constant across each triangle) — breaks the sine-lattice tiling
  vHash = fract(sin(dot(position.xz, vec2(127.1, 311.7))) * 43758.5453);
  vec3 displaced = position;
  displaced.y += h * uAmp;    // uAmp halves under reduced motion
  csm_Position = displaced;   // flatShading derives facet normals from this
}`;

const FRAG = /* glsl */ `
uniform vec3 uTrough;
uniform vec3 uMid;
uniform vec3 uCrest;
flat varying float vWaveH;
flat varying float vHash;

void main() {
  // -WAVE_MAX..+WAVE_MAX → 0..1, trough at 0, mid at .5, crest at 1.
  // Mid must OWN the sea: deep ink only in real troughs, pale only at true
  // peaks — otherwise every cell swings the full ramp and the surface tiles.
  float n = clamp(vWaveH / ${WAVE_MAX.toFixed(5)} * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(uTrough, uMid, smoothstep(0.06, 0.52, n));
  float up = pow(smoothstep(0.60, 0.97, n), 2.1);
  col = mix(col, uCrest, up * 0.85); // crests never fully saturate to the pale

  col *= 0.955 + vHash * 0.09;  // ±4.5% per-facet tint — hand-cut feel
  csm_DiffuseColor = vec4(col, 1.0);
}`;

// ---- module-scope constants + scratch (zero per-frame allocation) -----------
const CELL = 0.55; // grid cell — chunky vs the λ7 swell is where facets live
const EXPANSE = 56; // rect side (fog eats the far edge)
const BOWL_R = 13.2; // sea-surface disc radius inside the fishbowl
const GLASS_TINT = 0xcfe0e4; // cool glass hint for the bowl + rim (local, approved)
const SHARD_G = 2.6; // ballistic gravity for splash shards
const _shardGeo = new THREE.TetrahedronGeometry(0.055);
const _ringGeo = new THREE.RingGeometry(0.82, 1.0, 24);

export class Water {
  constructor(scene, pageMode) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this._time = 0;
    this._amp = 1;

    this.uniforms = {
      uTime: { value: 0 },
      uAmp: { value: 1 },
      uTrough: { value: new THREE.Color() },
      uMid: { value: new THREE.Color() },
      uCrest: { value: new THREE.Color() },
    };

    // one CSM/MeshStandard material — GPU displacement, scene-lit, fog-aware,
    // shadow-receiving, faceted. csm_DiffuseColor supplies the ramped albedo.
    this.material = new CustomShaderMaterial({
      baseMaterial: THREE.MeshStandardMaterial,
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.uniforms,
      flatShading: true,
      roughness: 1,
      metalness: 0,
    });

    // ---- the surface ----------------------------------------------------
    let surfGeo;
    if (pageMode === "island") {
      // a proper facet grid clipped to the disc: keep only triangles fully
      // inside the radius — the stepped rim reads hand-cut, and the dark inner
      // wall below hides the stairsteps. CircleGeometry would give one giant
      // fan (center→rim triangles), i.e. no waves at all.
      const size = BOWL_R * 2 + 1;
      const seg = Math.round(size / CELL);
      let grid = new THREE.PlaneGeometry(size, size, seg, seg);
      grid.rotateX(-Math.PI / 2);
      grid = grid.toNonIndexed();
      const p = grid.attributes.position;
      const kept = [];
      for (let i = 0; i < p.count; i += 3) {
        let inside = true;
        for (let v = i; v < i + 3; v++) {
          if (Math.hypot(p.getX(v), p.getZ(v)) > BOWL_R) { inside = false; break; }
        }
        if (inside) {
          for (let v = i; v < i + 3; v++) kept.push(p.getX(v), p.getY(v), p.getZ(v));
        }
      }
      surfGeo = new THREE.BufferGeometry();
      surfGeo.setAttribute("position", new THREE.Float32BufferAttribute(kept, 3));
      surfGeo.computeVertexNormals();
      this._buildBowl();
    } else {
      const seg = Math.round(EXPANSE / CELL); // ~102 → cell ≈ 0.55
      surfGeo = new THREE.PlaneGeometry(EXPANSE, EXPANSE, seg, seg);
      surfGeo.rotateX(-Math.PI / 2);
      surfGeo = surfGeo.toNonIndexed();
    }
    this.surface = new THREE.Mesh(surfGeo, this.material);
    this.surface.receiveShadow = true;
    this.group.add(this.surface);

    // ---- foam pools (splash shards + ripple rings) ----------------------
    this._rings = [];
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(
        _ringGeo,
        unlit(COLORS.foam, { transparent: true, opacity: 0, depthWrite: false })
      );
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      m.userData = { active: false, x: 0, z: 0, t0: 0, dur: 1, maxR: 1 };
      this.group.add(m);
      this._rings.push(m);
    }
    this._shards = [];
    for (let i = 0; i < 48; i++) {
      const m = new THREE.Mesh(
        _shardGeo,
        unlit(COLORS.foam, { transparent: true, opacity: 0, depthWrite: false })
      );
      m.visible = false;
      m.userData = {
        active: false, x: 0, z: 0, t0: 0, dur: 1,
        vx: 0, vy: 0, vz: 0, sp: 0, base: 1,
      };
      this.group.add(m);
      this._shards.push(m);
    }
  }

  // An OPEN GLASS FISHBOWL holding the disc of sea. A dark inner wall + cap
  // make the water read deep; a translucent lathe shell + a brighter rim torus
  // give the glass. Only built for island mode.
  _buildBowl() {
    // --- dark inner wall + cap so the sea reads as deep water, not paper ----
    // opaque cylinder just inside the glass; DoubleSide so the far inner face
    // (the one we look at through the front glass) is lit.
    const wallGeo = new THREE.CylinderGeometry(13.4, 13.4, 5.6, 48, 1, true);
    const wall = new THREE.Mesh(
      wallGeo,
      mat(COLORS.troughNight, { side: THREE.DoubleSide })
    );
    wall.position.y = -3.0; // spans y -0.2 → -5.8
    wall.receiveShadow = true;
    this.group.add(wall);

    // solid cap just beneath the wave surface: the stepped rim inevitably
    // leaves slivers between surface and wall — they must read as deep water,
    // never as the inside of the bowl showing through
    const capGeo = new THREE.CircleGeometry(13.3, 48);
    capGeo.rotateX(-Math.PI / 2);
    const cap = new THREE.Mesh(capGeo, mat(COLORS.troughNight));
    cap.position.y = -0.23;
    this.group.add(cap);

    // soft round contact shadow on the paper beneath the bowl
    const blobGeo = new THREE.CircleGeometry(15.5, 48);
    blobGeo.rotateX(-Math.PI / 2);
    const blob = new THREE.Mesh(
      blobGeo,
      unlit(0x6b5c3f, { transparent: true, opacity: 0.08, depthWrite: false })
    );
    blob.position.y = -6.35; // just under the rounded bottom (y -6.2)
    this.group.add(blob);

    // --- the glass shell: lathe profile, rounded bottom → wall → rim lip -----
    // profile bottom→top (radius, y): rounded base, wall curving up+out through
    // (13.8, 0), rim lip at (14.2, 4.6) with a small outward curl.
    const profile = [
      new THREE.Vector2(4.5, -6.2),
      new THREE.Vector2(7.2, -5.4),
      new THREE.Vector2(9.7, -4.1),
      new THREE.Vector2(11.7, -2.3),
      new THREE.Vector2(13.1, -0.5),
      new THREE.Vector2(13.8, 0.0),
      new THREE.Vector2(14.05, 2.3),
      new THREE.Vector2(14.2, 4.6),
      new THREE.Vector2(14.5, 4.85), // outward lip curl
    ];
    const glassGeo = new THREE.LatheGeometry(profile, 48);
    const glass = new THREE.Mesh(
      glassGeo,
      mat(GLASS_TINT, {
        roughness: 0.15,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    // depthWrite:false → draw the glass LAST so sea/wall/ship (renderOrder 0)
    // sort correctly behind the near pane.
    glass.renderOrder = 50;
    this.group.add(glass);

    // brighter thin rim torus at the lip so the bowl edge reads
    const rimGeo = new THREE.TorusGeometry(14.28, 0.13, 8, 48);
    rimGeo.rotateX(-Math.PI / 2);
    const rim = new THREE.Mesh(
      rimGeo,
      mat(GLASS_TINT, {
        roughness: 0.15,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    rim.position.y = 4.6;
    rim.renderOrder = 51;
    this.group.add(rim);
  }

  // ---- event foam: called by plank.js / others; pooled, no allocation ----
  ring(x, z) {
    const r = this._rings.find((m) => !m.userData.active);
    if (!r) return;
    const u = r.userData;
    u.active = true; u.x = x; u.z = z; u.t0 = this._time; u.dur = 1.4; u.maxR = 2.0;
    r.position.set(x, 0, z);
    r.visible = true;
  }

  splash(x, z, scale = 1) {
    // one ripple ring...
    const r = this._rings.find((m) => !m.userData.active);
    if (r) {
      const u = r.userData;
      u.active = true; u.x = x; u.z = z; u.t0 = this._time; u.dur = 1.2;
      u.maxR = 2.2 * scale;
      r.position.set(x, 0, z);
      r.visible = true;
    }
    // ...plus 6-10 foam shards popping up ballistically
    const count = 6 + Math.floor(Math.random() * 5);
    let spawned = 0;
    for (let i = 0; i < this._shards.length && spawned < count; i++) {
      const m = this._shards[i];
      if (m.userData.active) continue;
      const a = Math.random() * Math.PI * 2;
      const out = (0.9 + Math.random() * 1.4) * scale;
      const u = m.userData;
      u.active = true; u.x = x; u.z = z; u.t0 = this._time;
      u.dur = 0.95 + Math.random() * 0.3;
      u.vx = Math.cos(a) * out;
      u.vz = Math.sin(a) * out;
      u.vy = (1.9 + Math.random() * 1.3) * (0.7 + 0.3 * scale);
      u.sp = (Math.random() - 0.5) * 10; // spin rate
      u.base = 0.6 + 0.7 * scale;
      m.visible = true;
      spawned++;
    }
  }

  update(ws) {
    const t = ws.time;
    this._time = t;
    this._amp = ws.reduced ? 0.5 : 1;

    this.uniforms.uTime.value = t;
    this.uniforms.uAmp.value = this._amp;
    this.uniforms.uTrough.value.copy(ws.lighting.trough);
    this.uniforms.uMid.value.copy(ws.lighting.mid);
    this.uniforms.uCrest.value.copy(ws.lighting.crest);

    // rings: expand + fade, riding the sampled swell so foam sits on the water
    for (let i = 0; i < this._rings.length; i++) {
      const r = this._rings[i];
      const u = r.userData;
      if (!u.active) continue;
      const k = (t - u.t0) / u.dur;
      if (k >= 1 || k < 0) { u.active = false; r.visible = false; continue; }
      const grow = 1 - (1 - k) * (1 - k); // ease-out
      const rad = 0.2 + grow * u.maxR;
      r.scale.set(rad, rad, rad);
      r.position.y = waveHeight(u.x, u.z, t) * this._amp + 0.03;
      r.material.opacity = (1 - k) * 0.7;
    }

    // shards: ballistic pop, spin, shrink + fade
    for (let i = 0; i < this._shards.length; i++) {
      const m = this._shards[i];
      const u = m.userData;
      if (!u.active) continue;
      const age = t - u.t0;
      const k = age / u.dur;
      if (k >= 1 || k < 0) { u.active = false; m.visible = false; continue; }
      const surfY = waveHeight(u.x, u.z, t) * this._amp;
      m.position.set(
        u.x + u.vx * age,
        surfY + 0.05 + u.vy * age - 0.5 * SHARD_G * age * age,
        u.z + u.vz * age
      );
      const s = u.base * (1 - k * 0.6);
      m.scale.set(s, s, s);
      m.rotation.set(age * u.sp, age * u.sp * 0.7, 0);
      m.material.opacity = 1 - k * k;
    }
  }
}
