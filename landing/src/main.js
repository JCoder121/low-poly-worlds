// low-poly-worlds landing — an old-atlas map of the diorama collection.
// Two clickable pins (fixed for musashi's hill, drifting for sparrow's wake)
// navigate to each project's expanse page. Calm, static world by design —
// this page is a directory, not a third showpiece.
import * as THREE from "three";
import { COLORS } from "./palette.js";
import { buildWorld } from "./world.js";
import { buildMarkers, updateMarkers } from "./markers.js";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- renderer & scene ----------
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(COLORS.parchment);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(COLORS.parchment, 26, 46);

// ---------- lighting ----------
const hemi = new THREE.HemisphereLight(0xfff4dd, 0xb9c9c6, 0.95);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffe8c0, 1.7);
sun.position.set(10, 14, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -22;
sun.shadow.camera.right = 22;
sun.shadow.camera.top = 22;
sun.shadow.camera.bottom = -22;
sun.shadow.camera.near = 2;
sun.shadow.camera.far = 50;
sun.shadow.bias = -0.0006;
scene.add(sun);

const fill = new THREE.DirectionalLight(0xfff1dd, 0.4);
fill.position.set(-9, 6, 10);
scene.add(fill);

// ---------- orthographic camera, gentle mouse parallax ----------
const FRUSTUM = 15;
const camera = new THREE.OrthographicCamera();
const CAM_BASE = new THREE.Vector3(6, 20, 17);
const CAM_TARGET = new THREE.Vector3(2, 0, 2);
function sizeCamera() {
  const a = window.innerWidth / window.innerHeight;
  camera.left = -FRUSTUM * a;
  camera.right = FRUSTUM * a;
  camera.top = FRUSTUM;
  camera.bottom = -FRUSTUM;
  camera.near = 0.1;
  camera.far = 80;
  camera.updateProjectionMatrix();
}
sizeCamera();
camera.position.copy(CAM_BASE);
camera.lookAt(CAM_TARGET);
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  sizeCamera();
});

let parX = 0, parY = 0;
window.addEventListener("pointermove", (e) => {
  parX = (e.clientX / window.innerWidth - 0.5) * 2;
  parY = (e.clientY / window.innerHeight - 0.5) * 2;
});

// ---------- world + markers ----------
buildWorld(scene);
const markers = buildMarkers(scene);

// ---------- hover + click ----------
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const labelEl = document.getElementById("marker-label");
let hovered = null;

function markerAt(clientX, clientY) {
  pointerNDC.x = (clientX / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  const targets = markers.map((m) => m.group);
  const hits = raycaster.intersectObjects(targets, true);
  if (!hits.length) return null;
  let obj = hits[0].object;
  while (obj && !markers.some((m) => m.group === obj)) obj = obj.parent;
  return markers.find((m) => m.group === obj) ?? null;
}

window.addEventListener("pointermove", (e) => {
  const hit = markerAt(e.clientX, e.clientY);
  hovered = hit;
  document.body.classList.toggle("hover-marker", !!hit);
  if (hit) {
    labelEl.textContent = hit.label;
    labelEl.style.left = `${e.clientX}px`;
    labelEl.style.top = `${e.clientY}px`;
    labelEl.classList.add("visible");
  } else {
    labelEl.classList.remove("visible");
  }
});

window.addEventListener("click", (e) => {
  const hit = markerAt(e.clientX, e.clientY);
  if (hit) window.location.href = import.meta.env.BASE_URL + hit.href;
});

// ---------- themed loader ----------
const LOADER_LINES = [
  "unrolling the map…",
  "placing the markers…",
  "charting the seas…",
  "dusting off the corners…",
];
const loaderEl = document.getElementById("loader");
const loaderMsg = document.getElementById("loader-msg");
const loaderFill = document.getElementById("loader-fill");
LOADER_LINES.forEach((line, i) => {
  setTimeout(() => {
    loaderMsg.textContent = line;
    loaderFill.style.width = `${((i + 1) / LOADER_LINES.length) * 100}%`;
  }, 360 * i);
});
setTimeout(() => loaderEl.classList.add("done"), 360 * LOADER_LINES.length + 350);

// ---------- loop ----------
const clock = new THREE.Clock();
let hidden = false;
document.addEventListener("visibilitychange", () => {
  hidden = document.hidden;
  if (!hidden) clock.getDelta();
});

let t = 0;
function frame() {
  requestAnimationFrame(frame);
  if (hidden) return;
  const dt = Math.min(clock.getDelta(), 0.1);
  t += reducedMotion ? 0 : dt;

  updateMarkers(markers, t);

  const ax = parX * THREE.MathUtils.degToRad(1.4);
  const ay = parY * THREE.MathUtils.degToRad(1.4);
  camera.position.set(
    CAM_BASE.x * Math.cos(ax) - CAM_BASE.z * Math.sin(ax),
    CAM_BASE.y + ay * 2.4,
    CAM_BASE.x * Math.sin(ax) + CAM_BASE.z * Math.cos(ax)
  );
  camera.lookAt(CAM_TARGET);

  renderer.render(scene, camera);
}
frame();
