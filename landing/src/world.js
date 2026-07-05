// world.js — the ocean plane and a handful of stylized low-poly landmasses.
// Not a real atlas: just enough geography to read as "a world" and to give
// the two diorama markers a place to sit (an archipelago for musashi's hill,
// open water for sparrow's wake).
import * as THREE from "three";
import { COLORS, mat, jitterGeometry } from "./palette.js";

const OCEAN_SIZE = 46;
const OCEAN_SEG = 36;

// [cx, cz, radius, points, jitter, height] — irregular blob landmasses
const LANDMASSES = [
  { cx: 11, cz: -6, r: 4.6, n: 9, jitter: 0.9, h: 0.55 }, // "Asia" mainland
  { cx: 15.5, cz: -1.5, r: 1.5, n: 7, jitter: 0.4, h: 0.4 }, // "Japan" archipelago (musashi sits here)
  { cx: -11, cz: 3, r: 4.2, n: 8, jitter: 0.85, h: 0.5 }, // "Americas"
  { cx: -3, cz: 10, r: 3.4, n: 8, jitter: 0.75, h: 0.45 }, // "Africa"-ish
  { cx: 6, cz: 12, r: 2.2, n: 7, jitter: 0.6, h: 0.4 }, // small southern landmass
];

function buildLandmass({ cx, cz, r, n, jitter, h }) {
  const shape = new THREE.Shape();
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 + (Math.random() - 0.5) * jitter);
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, steps: 1 });
  geo.rotateX(-Math.PI / 2); // shape(x,y) -> world(x, up, -y)
  jitterGeometry(geo, 0.06);

  const mesh = new THREE.Mesh(geo, mat(COLORS.land));
  mesh.position.set(cx, 0, cz);
  mesh.castShadow = mesh.receiveShadow = true;

  // darker shore band, a slightly wider flat twin sitting just under the surface
  const shoreGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false, steps: 1 });
  shoreGeo.scale(1.08, 1, 1.08);
  shoreGeo.rotateX(-Math.PI / 2);
  const shore = new THREE.Mesh(shoreGeo, mat(COLORS.landShore));
  shore.position.set(cx, -0.04, cz);
  shore.receiveShadow = true;

  const group = new THREE.Group();
  group.add(shore, mesh);
  return group;
}

export function buildWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // ocean: one big jittered low-poly plane, per-facet hash tint for texture
  // (calm and static on purpose — the two dioramas already spend their one
  // showpiece-water slot; this is just a backdrop for the markers)
  // jitter BEFORE toNonIndexed(): this is still an indexed plane here, so
  // shared corners between adjacent triangles move together — jittering
  // after toNonIndexed() would let those corners drift independently and
  // open hairline cracks between facets (visible as scratchy background-
  // colored lines across the whole surface).
  let oceanGeo = new THREE.PlaneGeometry(OCEAN_SIZE, OCEAN_SIZE, OCEAN_SEG, OCEAN_SEG);
  oceanGeo.rotateX(-Math.PI / 2);
  const indexedPos = oceanGeo.attributes.position;
  for (let i = 0; i < indexedPos.count; i++) {
    indexedPos.setY(i, indexedPos.getY(i) + (Math.random() - 0.5) * 0.05);
  }
  indexedPos.needsUpdate = true;
  oceanGeo = oceanGeo.toNonIndexed();
  const posAttr = oceanGeo.attributes.position;
  oceanGeo.computeVertexNormals();

  const hashes = new Float32Array(posAttr.count);
  for (let i = 0; i < posAttr.count; i += 3) {
    const h = Math.random();
    hashes[i] = hashes[i + 1] = hashes[i + 2] = h;
  }
  oceanGeo.setAttribute("hash", new THREE.Float32BufferAttribute(hashes, 1));

  const oceanMat = mat(COLORS.oceanMid, { vertexColors: false });
  oceanMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "attribute float hash;\nvarying float vHash;\n#include <common>")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvHash = hash;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "varying float vHash;\n#include <common>")
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\ndiffuseColor.rgb *= 0.92 + vHash * 0.14;"
      );
  };
  const ocean = new THREE.Mesh(oceanGeo, oceanMat);
  ocean.receiveShadow = true;
  group.add(ocean);

  for (const spec of LANDMASSES) group.add(buildLandmass(spec));

  return group;
}
