// GPU-displaced faceted sea, adapted from sparrows-wake/src/water.js for a
// map-table framing: a single rectangular expanse sized to out-cover every
// viewport aspect, no foam pools, no island bowl, static palette (this page
// has no day/night cycle). The vertex stage runs the SAME wave model as
// waves.js; `flat` varyings keep each facet a single crisp color.
import * as THREE from "three";
import CustomShaderMaterial from "three-custom-shader-material/vanilla";
import { WAVE_MAX, waveGLSL } from "./waves.js";

const VERT = /* glsl */ `
uniform float uTime;
uniform float uAmp;
flat varying float vWaveH;
flat varying float vHash;

${waveGLSL()}

void main() {
  float h = waveHeight(position.xz, uTime);
  vWaveH = h;
  // per-facet hash from the provoking vertex (non-indexed geometry) —
  // breaks the sine-lattice tiling with a hand-cut tint
  vHash = fract(sin(dot(position.xz, vec2(127.1, 311.7))) * 43758.5453);
  vec3 displaced = position;
  displaced.y += h * uAmp;
  csm_Position = displaced;
}`;

const FRAG = /* glsl */ `
uniform vec3 uTrough;
uniform vec3 uMid;
uniform vec3 uCrest;
flat varying float vWaveH;
flat varying float vHash;

void main() {
  // mid owns the ramp: deep ink only in true troughs, pale only at true
  // peaks, crest capped — otherwise the tiling reads louder than it is
  float n = clamp(vWaveH / ${WAVE_MAX.toFixed(5)} * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(uTrough, uMid, smoothstep(0.08, 0.62, n));
  float up = pow(smoothstep(0.68, 0.99, n), 2.2);
  col = mix(col, uCrest, up * 0.5);
  col *= 0.97 + vHash * 0.06;
  csm_DiffuseColor = vec4(col, 1.0);
}`;

// the camera shows ~100 world units across the viewport, so cells land at
// ~18-20 screen px — chunky enough to read as facets, not pixel noise
const CELL = 1.3;
const EXPANSE_W = 150;
const EXPANSE_D = 110;

export class Water {
  constructor(scene, palette) {
    this.uniforms = {
      uTime: { value: 0 },
      uAmp: { value: 1 },
      uTrough: { value: new THREE.Color(palette.trough) },
      uMid: { value: new THREE.Color(palette.mid) },
      uCrest: { value: new THREE.Color(palette.crest) },
    };

    this.material = new CustomShaderMaterial({
      baseMaterial: THREE.MeshStandardMaterial,
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.uniforms,
      flatShading: true,
      roughness: 1,
      metalness: 0,
    });

    let geo = new THREE.PlaneGeometry(
      EXPANSE_W, EXPANSE_D,
      Math.round(EXPANSE_W / CELL), Math.round(EXPANSE_D / CELL)
    );
    geo.rotateX(-Math.PI / 2);
    geo = geo.toNonIndexed();
    this.surface = new THREE.Mesh(geo, this.material);
    this.surface.receiveShadow = true;
    scene.add(this.surface);

    // backstop skirt: grazing bottom-of-frustum rays pass under the displaced
    // surface on some viewports — a flat catch plane a little below sea level
    // in the same material reads as more sea
    const skirtGeo = new THREE.PlaneGeometry(EXPANSE_W, EXPANSE_D, 2, 2);
    skirtGeo.rotateX(-Math.PI / 2);
    const skirt = new THREE.Mesh(skirtGeo, this.material);
    skirt.position.y = -3;
    scene.add(skirt);
  }

  update(time, reduced) {
    this.uniforms.uTime.value = time;
    this.uniforms.uAmp.value = reduced ? 0.5 : 1;
  }
}
