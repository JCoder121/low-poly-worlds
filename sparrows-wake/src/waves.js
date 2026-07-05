// The canonical wave model. The GLSL in water.js is generated FROM these
// constants, and every floating thing (ship, traffic, prisoner) samples
// waveHeight() so sea and floaters can never disagree.
// h(x,z,t) = Σ amp · sin(k·dot(dir,(x,z)) + t·speed·k),  k = 2π/λ

// Directions deliberately NON-orthogonal and wavelengths non-harmonic —
// orthogonal dirs + integer ratios tile the sea into checkerboard argyle.
export const WAVES = [
  { dir: [0.52, -0.854], lambda: 17.0, amp: 0.03, speed: 0.22 }, // slow set — de-tiles the crest pattern
  { dir: [0.94, 0.341], lambda: 7.3, amp: 0.13, speed: 0.32 }, // long swell
  { dir: [0.169, 0.986], lambda: 3.9, amp: 0.045, speed: 0.5 }, // cross chop
  { dir: [-0.615, 0.788], lambda: 1.7, amp: 0.022, speed: 0.85 }, // shimmer
];

export const WAVE_MAX = WAVES.reduce((s, w) => s + w.amp, 0); // 0.21

export function waveHeight(x, z, t) {
  let h = 0;
  for (const w of WAVES) {
    const k = (2 * Math.PI) / w.lambda;
    h += w.amp * Math.sin(k * (w.dir[0] * x + w.dir[1] * z) + t * w.speed * k);
  }
  return h;
}

// GLSL twin, string-built from the same constants (keep signatures in sync).
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
