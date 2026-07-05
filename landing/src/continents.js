// Extruded low-poly landmasses. The outlines are the same hand-authored
// stylized continents the old 2D SVG atlas used (viewBox 2000×1000, Americas
// west / Europe-Africa-Asia east), lifted into 3D: each polygon becomes a
// beveled extrusion (flat plateau top, sloped faceted coast) rising out of
// the sea — the extruded-map look of the usual low-poly world-map assets,
// rebuilt in code so it stays license-free and palette-coherent.
import * as THREE from "three";

// SVG-space outlines (x 0..2000, y 0..1000)
const OUTLINES = [
  // north america
  [[160,160],[260,90],[380,110],[480,80],[560,140],[600,220],[640,300],[600,360],
   [560,420],[520,400],[460,440],[400,480],[340,460],[300,380],[240,300],[180,220]],
  // south america
  [[520,480],[600,460],[680,490],[740,560],[720,650],[680,750],[640,850],[600,920],
   [580,960],[560,900],[540,800],[520,700],[500,600],[490,540]],
  // europe
  [[1060,140],[1120,120],[1180,160],[1220,220],[1160,280],[1080,320],[1020,280],
   [1000,220],[1020,160]],
  // africa
  [[1020,380],[960,420],[970,480],[1010,520],[1000,600],[1030,700],[1050,780],[1070,820],
   [1110,780],[1140,700],[1160,620],[1180,540],[1220,480],[1180,440],[1140,400],[1080,360]],
  // asia
  [[1260,180],[1400,100],[1560,120],[1680,180],[1700,260],[1660,320],[1620,380],[1580,440],
   [1600,500],[1560,580],[1520,540],[1480,500],[1440,560],[1380,620],[1340,560],[1360,480],
   [1300,420],[1280,340],[1260,260]],
  // japan
  [[1840,300],[1870,280],[1900,310],[1890,350],[1860,380],[1830,360],[1820,330]],
  // southeast island
  [[1700,660],[1780,640],[1860,660],[1880,720],[1840,780],[1760,800],[1700,760],[1680,700]],
];

export const SVG_TO_WORLD = 0.05; // 2000×1000 svg → 100×50 world units
export const LAND_TOP = 0.55; // plateau height above the waterline

const LAND = new THREE.Color("#8a9b6e");
// subtle per-continent tint so the map doesn't read as one flat sticker
const TINTS = [1.0, 0.97, 1.04, 0.95, 1.02, 1.06, 0.98];

// deterministic per-position jitter so coincident vertices (cap/wall seams in
// ExtrudeGeometry duplicate them) move together and the mesh stays watertight
function hash(x, y, z, seed) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

function jitter(geo, amount) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = Math.round(p.getX(i) * 100), y = Math.round(p.getY(i) * 100),
      z = Math.round(p.getZ(i) * 100);
    p.setXYZ(
      i,
      p.getX(i) + hash(x, y, z, 1.3) * amount,
      p.getY(i) + hash(x, y, z, 7.9) * amount * 0.5,
      p.getZ(i) + hash(x, y, z, 4.2) * amount
    );
  }
}

export function buildContinents(scene) {
  const group = new THREE.Group();
  OUTLINES.forEach((pts, idx) => {
    const shape = new THREE.Shape();
    pts.forEach(([sx, sy], i) => {
      const x = (sx - 1000) * SVG_TO_WORLD;
      const y = (500 - sy) * SVG_TO_WORLD; // shape-Y becomes world -Z after rotateX
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 1.1,
      bevelEnabled: true,
      bevelThickness: 0.35,
      bevelSize: 0.5,
      bevelSegments: 1,
    });
    jitter(geo, 0.14);
    geo.rotateX(-Math.PI / 2);
    geo.computeBoundingBox();
    // drop the block so the plateau sits at LAND_TOP and the base is well
    // under the swell — no gap can open at the waterline
    geo.translate(0, LAND_TOP - geo.boundingBox.max.y, 0);
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: LAND.clone().multiplyScalar(TINTS[idx]),
        roughness: 1,
        metalness: 0,
        flatShading: true,
      })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });
  scene.add(group);
  return group;
}
