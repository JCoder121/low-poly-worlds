// The canonical wave model for the river + koi lake. The GLSL in water.js is
// string-built FROM these constants, and everything that rides the water
// (foam streaks, ripple rings, koi) samples waveHeight() — surface and
// floaters can never disagree, and retunes stay one-file.
// h(x,z,t) = Σ amp · sin(k·dot(dir,(x,z)) + t·speed·k),  k = 2π/λ

// Directions deliberately NON-orthogonal and wavelengths non-harmonic —
// orthogonal dirs + integer ratios tile the water into checkerboard argyle.
// One wave ~2.3× longer than the next pushes the repeat period past the
// river's whole course. Amplitudes are kept small — the shader biases the
// swell to build UPWARD from the base plane (0..2·WAVE_MAX), so troughs can
// never sink the surface below the banks/terrain (green showed through), and
// foam clearance (FOAM_Y 0.08 over river y 0.035 + 2·WAVE_MAX) still holds.
export const WAVES = [
  { dir: [0.62, 0.785], lambda: 2.6, amp: 0.006, speed: 0.1 }, // long set — de-tiles
  { dir: [0.94, 0.341], lambda: 1.13, amp: 0.008, speed: 0.2 }, // main swell
  { dir: [0.169, 0.986], lambda: 0.61, amp: 0.004, speed: 0.32 }, // cross chop
];

export const WAVE_MAX = WAVES.reduce((s, w) => s + w.amp, 0); // 0.018

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
