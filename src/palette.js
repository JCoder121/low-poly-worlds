// sparrow's wake — the whole palette, one mat() factory, and the jitter pass.
// Every module colors ONLY from here.
import * as THREE from "three";

export const COLORS = {
  // world / paper
  parchment: 0xf4e9d4,
  nightBg: 0x161f36,

  // water ramps (trough → mid → crest)
  troughDay: 0x14597a,
  midDay: 0x1f7fa4,
  crestDay: 0x5fc4cd,
  troughNight: 0x0b2238,
  midNight: 0x24466b,
  crestNight: 0x4c82a8,
  foam: 0xfbf6ea,

  // ship
  hull: 0x4a3728,
  hullDark: 0x2e2016,
  deck: 0x8a6a47,
  mast: 0x5c452f,
  sail: 0xede3cb,
  sailShadow: 0xd9cba8,
  flag: 0x1e1b18,
  rope: 0xc7b08a,
  brass: 0xc9a227,
  lanternGlow: 0xffb65c,
  cannon: 0x33302c,

  // people
  skin: 0xe8c39e,
  skinTan: 0xc89b72,
  crimson: 0xa63d33, // captain bandana/sash, accents
  captainCoat: 0x3a3f55,
  captainHat: 0x241c14,
  crewShirt: 0xe6dcc3,
  crewStripe: 0x3a4a5c,
  crewPants: 0x5c5340,
  boots: 0x241a12,
  prisoner: 0x8d8371,

  // traffic
  canoe: 0x8a5a33,
  bottleGlass: 0x7fa88f,
  paper: 0xefe2c0,
  turtle: 0x6e8b5e,
  turtleShell: 0x55704a,
  driftwood: 0x7a5c3d,
  gull: 0xf2ede2,
  gullWing: 0x9aa0a6,
  barrel: 0x6e4f30,
  sharkFin: 0x5a6672,
  whale: 0x46586a,
  ghostShip: 0x2a3448, // silhouette only, night
};

// The one lit-material factory (skill: MeshStandardMaterial, roughness 1,
// metalness 0, flatShading). Pass { vertexColors: true } where facets band.
export function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 1,
    metalness: 0,
    flatShading: true,
    ...opts,
  });
}

// Unlit factory for foam / glows / silhouettes.
export function unlit(color, opts = {}) {
  return new THREE.MeshBasicMaterial({ color, ...opts });
}

// Organic wobble for hulls, driftwood, anything too-perfect.
export function jitterGeometry(geo, amount) {
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
