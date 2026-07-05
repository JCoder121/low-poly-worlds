// The landing page's wave model — same architecture as sparrows-wake's
// waves.js (one set of constants, a JS sampler + a string-built GLSL twin so
// the sea and anything riding it can never disagree) but retuned much calmer:
// this is a navigation directory, not a showpiece ocean.
// h(x,z,t) = Σ amp · sin(k·dot(dir,(x,z)) + t·speed·k),  k = 2π/λ

// Directions non-orthogonal, wavelengths non-harmonic, one extra-long set —
// otherwise the sine lattice tiles into checkerboard argyle.
// Wavelengths are planet-scale broad: the camera shows the WHOLE 100-unit map
// at once, so anything under ~4 grid cells reads as salt-and-pepper noise
// rather than swell bands at this zoom.
export const WAVES = [
  { dir: [0.51, -0.86], lambda: 34.0, amp: 0.035, speed: 0.22 }, // slow de-tiling set
  { dir: [0.93, 0.368], lambda: 16.0, amp: 0.09, speed: 0.3 }, // main swell
  { dir: [0.155, 0.988], lambda: 8.5, amp: 0.035, speed: 0.45 }, // cross chop
  { dir: [-0.6, 0.8], lambda: 5.2, amp: 0.015, speed: 0.6 }, // shimmer
];

export const WAVE_MAX = WAVES.reduce((s, w) => s + w.amp, 0);

export function waveHeight(x, z, t) {
  let h = 0;
  for (const w of WAVES) {
    const k = (2 * Math.PI) / w.lambda;
    h += w.amp * Math.sin(k * (w.dir[0] * x + w.dir[1] * z) + t * w.speed * k);
  }
  return h;
}

export function waveGLSL() {
  const lines = WAVES.map((w) => {
    const k = ((2 * Math.PI) / w.lambda).toFixed(6);
    return `h += ${w.amp.toFixed(4)} * sin(${k} * dot(vec2(${w.dir[0].toFixed(
      4
    )}, ${w.dir[1].toFixed(4)}), p) + t * ${(w.speed * ((2 * Math.PI) / w.lambda)).toFixed(6)});`;
  });
  return `
float waveHeight(vec2 p, float t) {
  float h = 0.0;
  ${lines.join("\n  ")}
  return h;
}`;
}
