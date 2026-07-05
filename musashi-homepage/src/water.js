// The water: the river runs under the bridge straight into the koi pond/lake
// at grade — the diorama's standout artifact. Since v8 the swell is
// GPU-displaced: the vertex stage runs the SAME wave model as waves.js
// (waveGLSL is string-built from the same constants), so streaks/koi
// sampling waveHeight() in JS can never disagree with the surface. The
// material is still MeshStandard under the hood (via CustomShaderMaterial),
// so scene lighting, shadows and fog — the day/night cycle's real work —
// apply unchanged; the sky-mirror tint arrives as a shared uColor uniform.
import * as THREE from "three";
import CustomShaderMaterial from "three-custom-shader-material/vanilla";
import { COLORS, mat, rock } from "./world.js";
import { WAVE_MAX, waveHeight, waveGLSL } from "./waves.js";

export const WATER = 0x93bfd0;
export const ICE = 0xd8e4ea;
export const FOAM_LINE = 0xfdfaf2;

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// module-scope scratch: zero per-frame allocations
const _mirror = new THREE.Color(), _base = new THREE.Color(WATER), _ice = new THREE.Color(ICE);

// reducedMotion bakes this one phase forever (the old CPU path baked t=1.7)
const STILL_T = 1.7;
// pond swell runs at a fraction of the river's — the lake reads calmer
const POND_AMP = 0.4;

// sky-mirror tint: WATER lerped toward the sky/fog colour, then toward ICE as
// the river freezes. Scene lighting on MeshStandard already carries most of
// the day/night darkening, so the lerp stays weak (a hue shift, not a wash)
// and the result is pulled slightly dark so water never assimilates into the
// warm terrain at dusk. Writes into `out` — no allocation.
function mirror(out, frozen, ws) {
  out.copy(_base).lerp(ws.lighting.bg, 0.30).multiplyScalar(0.90).lerp(_ice, frozen);
}

// banding by |k|: centre lane dark, edges pale. Contrast is pushed hard because
// the mirror tint washes the water pale — a gentle spread reads as flat.
const shade = (a) => (a < 0.45 ? 0.62 : a < 0.8 ? 0.90 : 1.22);

const smoothstep = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

// ---- shader (wave function shared with waves.js via waveGLSL) ---------------
// flat varyings: flatShading only gives free facet NORMALS under displacement
// (fragment derivatives); facet COLOR needs the provoking-vertex value or the
// height ramp smears into soft blobs. Geometry is non-indexed, so the
// provoking vertex is constant per triangle.
const VERT = /* glsl */ `
uniform float uTime;
uniform float uAmp;
attribute float aShade;
attribute float aAmp;
flat varying float vShade;
flat varying float vWaveH;
flat varying float vHash;

${waveGLSL()}

void main() {
  float w = waveHeight(position.xz, uTime);
  float k = uAmp * aAmp;
  vWaveH = w * k;
  vShade = aShade;
  // per-facet hash from the provoking vertex — breaks the sine-lattice tiling
  vHash = fract(sin(dot(position.xz, vec2(127.1, 311.7))) * 43758.5453);
  vec3 displaced = position;
  // upward-biased swell (0..2·WAVE_MAX above the base plane): troughs never
  // sink the surface below the banks/terrain, so the channel always reads
  // full of water. k → 0 (freeze / rim pin) settles flat at the base level.
  displaced.y += (w + ${WAVE_MAX.toFixed(5)}) * k;
  csm_Position = displaced;
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
flat varying float vShade;
flat varying float vWaveH;
flat varying float vHash;

void main() {
  // -WAVE_MAX..+WAVE_MAX → 0..1. Mid must OWN the ramp: darken only in true
  // troughs, lift only at true peaks, or every facet swings the full range
  // and the wave lattice reads louder than it is. The ramp is deliberately
  // subtle — the lane banding (vShade) stays the water's visual language.
  float n = clamp(vWaveH / ${WAVE_MAX.toFixed(5)} * 0.5 + 0.5, 0.0, 1.0);
  float lum = mix(0.92, 1.0, smoothstep(0.06, 0.52, n));
  lum += pow(smoothstep(0.60, 0.97, n), 2.1) * 0.10; // crest lift, capped
  vec3 col = uColor * vShade * lum;
  col *= 0.96 + vHash * 0.08; // ±4% per-facet tint — hand-cut feel
  csm_DiffuseColor = vec4(col, 1.0);
}`;

// shared uniform objects: one write per frame tints river + pond together
const uTime = { value: reducedMotion ? STILL_T : 0 };
const uColor = { value: new THREE.Color(WATER) };

function waterMaterial(ampScale) {
  return new CustomShaderMaterial({
    baseMaterial: THREE.MeshStandardMaterial,
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uTime, uColor, uAmp: { value: ampScale } },
    flatShading: true,
    roughness: 0.5,
    metalness: 0,
  });
}

// single source of the river's half-width: the wobble term shared by the laned
// ribbon, the dark banks, and the foam edges, times an entry taper that pinches
// the ribbon to a point at its source so the river emerges from the NW
// landscape instead of starting on a hard edge.
function riverHalfWidth(width, u) {
  return (width / 2 + Math.sin(u * 17) * 0.04) * Math.min(1, u / 0.12);
}

// old low-res single-lane ribbon — used only for the dark banks now (not
// animated). Stops at u 0.88, just short of the pond, so no dark bank juts
// into the open water.
function bankRibbon(curve, width) {
  const samples = 48;
  const positions = [];
  const pt = new THREE.Vector3(), tangent = new THREE.Vector3(), normal = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const edge = [];
  for (let i = 0; i <= samples; i++) {
    const u = (i / samples) * 0.88;
    curve.getPoint(u, pt);
    curve.getTangent(u, tangent);
    normal.crossVectors(up, tangent).normalize();
    const w = riverHalfWidth(width, u);
    edge.push([pt.x + normal.x * w, pt.z + normal.z * w, pt.x - normal.x * w, pt.z - normal.z * w]);
  }
  for (let i = 0; i < samples; i++) {
    const [ax, az, bx, bz] = edge[i];
    const [cx, cz, dx, dz] = edge[i + 1];
    positions.push(ax, 0, az, bx, 0, bz, cx, 0, cz, bx, 0, bz, dx, 0, dz, cx, 0, cz);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat(COLORS.mossDark));
}

// laned, non-indexed ribbon: `lanes` strips across the width so the shade
// attribute can band the water and the GPU swell has vertices to displace.
// Returns { mesh, frames } — the streaks consume `frames`.
function buildLanedRibbon(curve, width, segments, lanes) {
  const pt = new THREE.Vector3(), tangent = new THREE.Vector3(), normal = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const cols = []; // [segments+1][lanes+1] world positions
  const frames = { points: [], normals: [] };
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    curve.getPoint(u, pt);
    curve.getTangent(u, tangent);
    normal.crossVectors(up, tangent).normalize();
    frames.points.push(pt.clone());
    frames.normals.push(normal.clone());
    const w = riverHalfWidth(width, u);
    // head: sink into the ground so the source dips below the terrain rather
    // than sitting on it. Tail: rise to just under the pond surface (mesh
    // 0.035 + 0.02 = 0.055 < pond base 0.06) while the swell tapers to zero
    // slightly earlier, so the river settles calm and slides flat beneath the
    // pond's pinned rim — a seamless inflow, no crest ever pokes through.
    // Both are baked into the BASE y / aAmp (the GPU swell rides on top).
    const yBase = u < 0.08
      ? -0.08 * (1 - u / 0.08)
      : smoothstep(0.78, 0.95, u) * 0.02;
    const vAmp = 1 - smoothstep(0.72, 0.88, u);
    // lane banding dissolves into the pond rim's pale shade over the same
    // window, so the junction has no color step — river and pond read as one
    const sBlend = smoothstep(0.78, 0.96, u);
    const row = [];
    for (let l = 0; l <= lanes; l++) {
      const k = l / lanes - 0.5; // -0.5..0.5 across
      row.push([pt.x + normal.x * w * 2 * k, yBase, pt.z + normal.z * w * 2 * k, k, vAmp, sBlend]);
    }
    cols.push(row);
  }
  const positions = [], shades = [], amps = [];
  const pushV = ([x, y, z, k, vAmp, sBlend]) => {
    positions.push(x, y, z);
    shades.push(shade(Math.abs(k) * 2) * (1 - sBlend) + 1.19 * sBlend);
    amps.push(vAmp);
  };
  for (let i = 0; i < segments; i++) {
    for (let l = 0; l < lanes; l++) {
      const a = cols[i][l], b = cols[i][l + 1], c = cols[i + 1][l], d = cols[i + 1][l + 1];
      // wound so face normals point +y (lane order runs -k → +k; the plan's
      // (a,b,c)(b,d,c) order pointed them down and the river backface-culled)
      pushV(a); pushV(c); pushV(b); pushV(b); pushV(c); pushV(d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("aShade", new THREE.Float32BufferAttribute(shades, 1));
  geo.setAttribute("aAmp", new THREE.Float32BufferAttribute(amps, 1));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, waterMaterial(1));
  return { mesh, frames };
}

// pond surface: a proper facet grid clipped to the disc (keep only triangles
// fully inside the radius) — a cylinder cap is one centre fan, i.e. no waves
// at all. The stepped rim reads hand-cut; the pond body cap below covers the
// slivers between rim and true circle. aAmp pins the outer ring to grade so
// no wave lifts the edge above the surrounding ground. Positions are baked in
// island coords so the wave field is continuous where the river overlaps.
const PIN_IN = 0.78, PIN_OUT = 1.04; // aAmp falloff radii
function buildPondSurface(px, pz, radius) {
  const cell = 0.155;
  const seg = Math.round((radius * 2) / cell);
  let grid = new THREE.PlaneGeometry(radius * 2, radius * 2, seg, seg);
  grid.rotateX(-Math.PI / 2);
  grid = grid.toNonIndexed();
  const p = grid.attributes.position;
  const kept = [];
  for (let i = 0; i < p.count; i += 3) {
    let inside = true;
    for (let v = i; v < i + 3; v++) {
      if (Math.hypot(p.getX(v), p.getZ(v)) > radius) { inside = false; break; }
    }
    if (inside) {
      for (let v = i; v < i + 3; v++) kept.push(p.getX(v) + px, 0, p.getZ(v) + pz);
    }
  }
  const shades = [], amps = [];
  for (let i = 0; i < kept.length; i += 3) {
    const r = Math.hypot(kept[i] - px, kept[i + 2] - pz);
    // continuous radial ramp, not the river's stepped shade(): the old
    // cylinder-cap fan interpolated 0.62→1.22 linearly across the radius and
    // read as a soft wash; steps on a fine facet grid read as a chunky blob
    shades.push(0.62 + 0.6 * Math.min(1, r / radius));
    amps.push(1 - smoothstep(PIN_IN, PIN_OUT, r));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(kept, 3));
  geo.setAttribute("aShade", new THREE.Float32BufferAttribute(shades, 1));
  geo.setAttribute("aAmp", new THREE.Float32BufferAttribute(amps, 1));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, waterMaterial(POND_AMP));
}

// foam sits above the swell's peak (river mesh y 0.035 + 2·WAVE_MAX ≈ 0.071)
// so it never z-fights/stitches into the animated water surface.
const FOAM_Y = 0.08;
const FOAM_STRIP_W = 0.035;

// bank foam: two thin strips hugging both edges of the river, built straight
// from the ribbon's saved curve frames — no fresh curve sampling needed.
// MeshBasicMaterial + DoubleSide sidesteps the winding trap (thin unlit strips
// don't need correct-facing normals to be visible). The strips narrow to
// nothing over the same window the swell tapers, so the foam threads fade out
// before the pond instead of drawing white lines across the open water.
function buildFoamEdges(frames, width) {
  const { points, normals } = frames;
  const segments = points.length - 1;
  const positions = [];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < segments; i++) {
      const u0 = i / segments, u1 = (i + 1) / segments;
      const t0 = 1 - smoothstep(0.72, 0.88, u0);
      const t1 = 1 - smoothstep(0.72, 0.88, u1);
      if (t0 <= 0.001) continue;
      const w0 = riverHalfWidth(width, u0) - 0.02;
      const w1 = riverHalfWidth(width, u1) - 0.02;
      const p0 = points[i], n0 = normals[i], p1 = points[i + 1], n1 = normals[i + 1];
      const a = [p0.x + n0.x * side * w0, FOAM_Y, p0.z + n0.z * side * w0];
      const b = [p0.x + n0.x * side * (w0 + FOAM_STRIP_W * t0), FOAM_Y, p0.z + n0.z * side * (w0 + FOAM_STRIP_W * t0)];
      const c = [p1.x + n1.x * side * w1, FOAM_Y, p1.z + n1.z * side * w1];
      const d = [p1.x + n1.x * side * (w1 + FOAM_STRIP_W * t1), FOAM_Y, p1.z + n1.z * side * (w1 + FOAM_STRIP_W * t1)];
      positions.push(...a, ...c, ...b, ...b, ...c, ...d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geo;
}

export function buildWater(island, mode = "island") {
  const group = new THREE.Group();
  island.add(group);

  // river: NW edge → a relatively straight, gently curved course under the
  // bridge → into the koi pond, all at grade. The bridge still crosses at
  // (-4.2, 2.6); the last two points extend the same heading down to the
  // relocated (lower-on-screen) pond, ending inside the pond disc so the two
  // surfaces overlap and share the same mirror tint (no visible seam).
  const riverCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-6.6, 0, -3.4),
    new THREE.Vector3(-5.2, 0, -0.9),
    new THREE.Vector3(-4.2, 0, 2.6),
    new THREE.Vector3(-3.3, 0, 4.3),
    new THREE.Vector3(-2.55, 0, 5.5),
  ]);
  const riverSurf = buildLanedRibbon(riverCurve, 0.55, 160, 4);
  riverSurf.mesh.position.y = 0.035; // slightly above ground, below the path
  riverSurf.mesh.receiveShadow = true;
  group.add(riverSurf.mesh);
  const riverMat = riverSurf.mesh.material;
  const FRAME_N = riverSurf.frames.points.length;

  // bank foam lines: crisp thin threads hugging both edges of the whole course
  const foamMat = new THREE.MeshBasicMaterial({ color: FOAM_LINE, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
  const foamEdges = new THREE.Mesh(buildFoamEdges(riverSurf.frames, 0.55), foamMat);
  group.add(foamEdges);

  // drifting foam streaks: short dashes carried downstream by the current,
  // riding the sampled swell so they sit ON the water, not floating above it
  const STREAK_N = 10;
  const streakMat = new THREE.MeshBasicMaterial({ color: FOAM_LINE, transparent: true, opacity: 0.65, depthWrite: false });
  const streaks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.008, 0.03), streakMat, STREAK_N);
  group.add(streaks);
  // clamped to u ∈ [0.15, 0.86] so streaks never ride the tapered/sunken tip
  // and dissolve before the river's tail slides under the pond
  const streakState = Array.from({ length: STREAK_N }, () => ({
    u: 0.15 + Math.random() * 0.71,
    lane: (Math.random() - 0.5) * 0.6,
    speed: 0.018 + Math.random() * 0.01,
  }));

  // dark banks so the water reads as inset (low-res, not animated)
  const banks = bankRibbon(riverCurve, 0.8);
  banks.position.y = 0.028;
  group.add(banks);

  // ---- koi pond / lake at POND_CENTER (world -2.2, 5.9), sitting at grade ----
  const PX = -2.2, PZ = 5.9;
  const POND_R = 1.1;

  // pond body: the old tapered cylinder, dropped so its top face sits just
  // under the animated surface — the slivers between the surface's stepped
  // grid rim and the true circle must read as deeper water, not ground.
  const bodyGeo = new THREE.CylinderGeometry(POND_R, 1.02, 0.06, 28, 1);
  const pondBodyMat = mat(WATER, { roughness: 0.5 });
  const pondBody = new THREE.Mesh(bodyGeo, pondBodyMat);
  pondBody.position.set(PX, 0.012, PZ); // top face y 0.042, below the surface's base 0.06
  group.add(pondBody);

  // pond surface: GPU-swell facet grid at y 0.06 (grade, like the road)
  const pondSurf = buildPondSurface(PX, PZ, POND_R);
  pondSurf.position.y = 0.06;
  const pondMat = pondSurf.material;
  group.add(pondSurf);

  // JS twin of the shader's rim pin, for anything riding the pond surface
  const pondPin = (x, z) => 1 - smoothstep(PIN_IN, PIN_OUT, Math.hypot(x - PX, z - PZ));

  // koi: two small silhouettes circling the pond, flattened so they read as
  // at-the-surface from the iso view. Nose-forward cone body + patch + a
  // tail cone that sways independently.
  function koi(bodyColor, patchColor) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 4), mat(bodyColor));
    body.rotation.x = Math.PI / 2; // nose forward along +z
    body.scale.y = 0.45; // flattened for the top-down view
    const patch = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4, 3), mat(patchColor));
    patch.position.set(0.012, 0.02, 0.02);
    patch.scale.y = 0.4;
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 3), mat(bodyColor));
    tail.rotation.x = -Math.PI / 2;
    tail.position.z = -0.1;
    g.add(body, patch, tail);
    g.userData.tail = tail;
    return g;
  }
  // pond center (x, z); koi swim just under the pond surface.
  const POOL = new THREE.Vector3(PX, 0, PZ);
  const koiA = koi(0xd96f38, 0xfdfaf2);
  const koiB = koi(0xfdfaf2, 0xd96f38);
  group.add(koiA, koiB);
  // orbit radii (0.4/0.62) + body half-length (~0.13) stay inside the 1.1 pond
  // rim; started at opposite angles and staggered pause phases so the two never
  // read as synced.
  const koiState = [
    { g: koiA, angle: 0, radius: 0.4, speed: 0.5, pauseTimer: 1.0 },
    { g: koiB, angle: 2.1, radius: 0.62, speed: 0.38, pauseTimer: -3.0 },
  ];

  const dummy = new THREE.Object3D();

  // sittable rock on the pond's south-east shore for the flute spot
  const fluteRock = rock(0.22);
  fluteRock.position.set(-1.7, 0.05, 7.0);
  group.add(fluteRock);

  const spots = {
    // gassho at the water's edge, just outside the pond rim, facing the pond;
    // facing = atan2(centerX-posX, centerZ-posZ) ≈ atan2(-0.95, 0.85)
    misogi: { position: new THREE.Vector3(-1.25, 0, 5.05), facing: -0.84 },
    // seated on the rock on the pond's SE shore, facing the pond;
    // facing = atan2(centerX-posX, centerZ-posZ) ≈ atan2(-0.5, -1.1)
    flute: { position: new THREE.Vector3(-1.7, 0, 7.0), facing: -2.71 },
  };

  function update(dt, t2, ws) {
    const frozen = ws.season === "winter" ? 1 - ws.seasonBlend : ws.nextSeason === "winter" ? ws.seasonBlend : 0;
    // sky-mirror tint: warm/ink sky, then ice as it freezes
    mirror(_mirror, frozen, ws);
    uColor.value.copy(_mirror);
    pondBodyMat.color.copy(_mirror); // rim slivers blend into the surface
    // traveling swell — the amp glides to zero across the freeze window so the
    // water flattens into ice with no popping. reducedMotion keeps the one
    // phase baked at build (uTime STILL_T, full amp), matching the old CPU
    // bake-once behavior.
    const riverAmp = reducedMotion ? 1 : 1 - frozen;
    if (!reducedMotion) {
      uTime.value = t2;
      riverMat.uniforms.uAmp.value = riverAmp;
      pondMat.uniforms.uAmp.value = POND_AMP * riverAmp;
    }
    const tNow = reducedMotion ? STILL_T : t2;

    // bank foam: slow opacity pulse, calmed to a static value under
    // reducedMotion; fades out entirely as the river freezes.
    foamMat.opacity = (reducedMotion ? 0.4 : 0.4 + Math.sin(t2 * 0.9) * 0.12) * (1 - frozen);

    // drifting current streaks: fade out approaching freeze (no single-frame
    // pop), then hidden once mostly frozen or under reducedMotion
    streakMat.opacity = 0.65 * Math.max(0, 1 - frozen * 2);
    streaks.visible = frozen < 0.5 && !reducedMotion;
    if (streaks.visible) {
      // streaks set their own rotation/scale each iteration below; dummy carries
      // no stale transform in from another consumer.
      const { points, normals } = riverSurf.frames;
      streakState.forEach((s, i) => {
        s.u += s.speed * dt;
        if (s.u > 0.86) s.u -= 0.71; // wrap back to 0.15, clear of the tapered tip
        const idx = Math.min(FRAME_N - 1, Math.floor(s.u * FRAME_N));
        const p = points[idx], n = normals[idx];
        const nextIdx = idx + 1 >= FRAME_N ? idx : idx + 1;
        const sx = p.x + n.x * s.lane * 0.5, sz = p.z + n.z * s.lane * 0.5;
        dummy.position.set(sx, 0.035 + (waveHeight(sx, sz, tNow) + WAVE_MAX) * riverAmp + 0.02, sz);
        dummy.rotation.set(0, Math.atan2(points[nextIdx].x - p.x, points[nextIdx].z - p.z), 0);
        // shrink to nothing over the last stretch so streaks dissolve into
        // the calm inflow instead of popping at the wrap point
        const pulse = (0.6 + 0.4 * Math.sin(t2 * 1.7 + i * 2.4)) * (1 - smoothstep(0.78, 0.86, s.u));
        dummy.scale.set(pulse, 1, pulse);
        dummy.updateMatrix();
        streaks.setMatrixAt(i, dummy.matrix);
      });
      streaks.instanceMatrix.needsUpdate = true;
    }

    // koi: circular swim with occasional pauses, bobbing on the sampled swell
    // (the shared wave model is the buoyancy source, same as the surface);
    // hidden once mostly frozen, slowed (not hidden) under reducedMotion
    const koiVisible = frozen < 0.5;
    koiState.forEach((k, i) => {
      k.g.visible = koiVisible;
      if (!koiVisible) return;
      k.pauseTimer -= dt;
      const moving = k.pauseTimer < 0 || k.pauseTimer > 1.5; // pause = 1.5s window every ~8-14s
      if (k.pauseTimer < -8 - i * 6) k.pauseTimer = 1.5;
      const sp = k.speed * (moving ? 1 : 0.05) * (reducedMotion ? 0.15 : 1);
      k.angle += sp * dt;
      const kx = POOL.x + Math.cos(k.angle) * k.radius;
      const kz = POOL.z + Math.sin(k.angle) * k.radius;
      const ky = 0.06 + (waveHeight(kx, kz, tNow) + WAVE_MAX) * POND_AMP * riverAmp * pondPin(kx, kz) + 0.012;
      k.g.position.set(kx, ky, kz);
      k.g.rotation.y = -k.angle; // tangent to the circle
      k.g.userData.tail.rotation.y = Math.sin(t2 * 6) * 0.5; // tail sway
    });
  }

  return { spots, update };
}
