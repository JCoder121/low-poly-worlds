// low-poly-worlds landing — one palette, one mat() factory, shared everywhere.
// Old-atlas parchment + deep ocean, with one accent per diorama it points to.
import * as THREE from "three";

export const COLORS = {
  parchment: 0xf2e8d5,
  ink: 0x1c2333,

  oceanDeep: 0x1c5f74,
  oceanMid: 0x2c839a,
  oceanShallow: 0x4fa8b8,

  land: 0x8a9b6e,
  landDark: 0x6f8256,
  landShore: 0xd8c896,

  musashiAccent: 0xf2b8c6, // sakura
  sparrowsAccent: 0x241c14, // pirate hull/flag ink
  brass: 0xc9a227,
  foam: 0xf7f2e2,
};

export function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 1,
    metalness: 0,
    flatShading: true,
    ...extra,
  });
}

export function unlit(color, extra = {}) {
  return new THREE.MeshBasicMaterial({ color, ...extra });
}

// small deterministic-ish organic wobble for hand-cut low-poly edges
export function jitterGeometry(geo, amount = 0.05) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      pos.getX(i) + (Math.random() - 0.5) * amount,
      pos.getY(i) + (Math.random() - 0.5) * amount,
      pos.getZ(i) + (Math.random() - 0.5) * amount
    );
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}
