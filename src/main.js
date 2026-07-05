// sparrow's wake — renderer, camera, lights, loader, toggles, the loop.
import * as THREE from "three";
import { COLORS } from "./palette.js";
import { Cycle } from "./cycle.js";
import { Water } from "./water.js";
import { Ship } from "./ship.js";
import { Captain } from "./captain.js";
import { Crew } from "./crew.js";
import { Plank } from "./plank.js";
import { Traffic } from "./traffic.js";
import { Ambience } from "./sound.js";

const pageMode = document.body.dataset.mode; // 'expanse' | 'island'

// ---------- renderer / scene / camera ----------
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.parchment);
// camera sits ~23 units out — fog must start BEYOND the ship so the diorama
// center stays crisp and only the far ocean melts into the paper
scene.fog = new THREE.Fog(COLORS.parchment, pageMode === "expanse" ? 27 : 29, pageMode === "expanse" ? 46 : 52);

const FRUSTUM = 12.5; // half-height in world units; smaller = closer
const camera = new THREE.OrthographicCamera();
const CAM_BASE = new THREE.Vector3(14, 11.5, 14);
const CAM_TARGET = new THREE.Vector3(0, 0.4, 0);
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
renderer.setSize(window.innerWidth, window.innerHeight);

// mouse parallax ±2°
let parX = 0, parY = 0;
window.addEventListener("pointermove", (e) => {
  parX = (e.clientX / window.innerWidth - 0.5) * 2;
  parY = (e.clientY / window.innerHeight - 0.5) * 2;
});

// ---------- lights ----------
const hemi = new THREE.HemisphereLight(0xfff2d9, 0xbfd0ce, 0.85);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffe8c0, 1.8);
sun.position.set(9, 13, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -12;
sun.shadow.camera.right = 12;
sun.shadow.camera.top = 12;
sun.shadow.camera.bottom = -12;
sun.shadow.camera.near = 2;
sun.shadow.camera.far = 45;
sun.shadow.bias = -0.0006;
scene.add(sun);

const fill = new THREE.DirectionalLight(0xfff1dd, 0.4);
fill.position.set(-10, 6, 12);
scene.add(fill);

// ---------- night sky: stars + moon ----------
// Ortho camera has no sky dome — anything above the frustum band is culled.
// So the sky lives as camera children: points spread across the upper view
// band, far back, so they render into the fog/background area on screen
// (and ride the parallax for free).
scene.add(camera);
const starGeo = new THREE.BufferGeometry();
{
  const pts = [];
  for (let i = 0; i < 150; i++) {
    const x = (Math.random() - 0.5) * 46;
    const y = 6.5 + Math.random() * 6.5; // top strip of the view
    pts.push(x, y + Math.abs(x) * 0.05, -58); // corners lift slightly — dome hint
  }
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
}
// the iso ocean fills most of the frame; the sky is the hazed top strip, so
// sky elements skip the depth test and draw over the fog-faded far water
const starMat = new THREE.PointsMaterial({ color: 0xf5f0e0, size: 0.22, transparent: true, opacity: 0, depthWrite: false, depthTest: false, fog: false });
const stars = new THREE.Points(starGeo, starMat);
stars.renderOrder = 90;
camera.add(stars);

const moonMat = new THREE.MeshBasicMaterial({ color: 0xeae6d8, transparent: true, opacity: 0, fog: false, depthWrite: false, depthTest: false });
const moon = new THREE.Mesh(new THREE.CircleGeometry(0.8, 24), moonMat);
moon.position.set(-5.5, 10.1, -57);
moon.renderOrder = 92;
camera.add(moon);
// a faint halo behind the moon
const haloMat = new THREE.MeshBasicMaterial({ color: 0xdfe4f0, transparent: true, opacity: 0, fog: false, depthWrite: false, depthTest: false });
const halo = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24), haloMat);
halo.position.set(-5.5, 10.1, -57.5);
halo.renderOrder = 91;
camera.add(halo);

// ---------- world modules ----------
const cycle = new Cycle();
const events = { plank: { active: false, phase: "idle" } };

const water = new Water(scene, pageMode);
const ship = new Ship(scene);
const captain = new Captain(ship, events);
const crew = new Crew(ship, events);
const plank = new Plank(ship, captain, crew, water, events);
const traffic = new Traffic(scene, camera, events);
const ambience = new Ambience();

// ---------- themed loader ----------
const LOADER_LINES = [
  "hoisting the colours…",
  "swabbing the deck…",
  "charting the course…",
  "counting the rum…",
  "waking the captain…",
];
const loaderEl = document.getElementById("loader");
const loaderMsg = document.getElementById("loader-msg");
const loaderFill = document.getElementById("loader-fill");
LOADER_LINES.forEach((line, i) => {
  setTimeout(() => {
    loaderMsg.textContent = line;
    loaderFill.style.width = `${((i + 1) / LOADER_LINES.length) * 100}%`;
  }, 420 * i);
});
setTimeout(() => loaderEl.classList.add("done"), 420 * LOADER_LINES.length + 400);

// ---------- toggles ----------
const modeToggle = document.getElementById("mode-toggle");
const soundToggle = document.getElementById("sound-toggle");
const liveToggle = document.getElementById("live-toggle");
const skyline = document.getElementById("skyline");

function labelToggles() {
  modeToggle.textContent = cycle.mode === "day" ? "night ↗" : "day ↗";
  soundToggle.textContent = ambience.enabled ? "hush ↗" : "sound ↗";
  liveToggle.textContent = cycle.live ? "drift ↗" : "live ↗";
  skyline.textContent = cycle.mode === "day" ? "somewhere in the trades, noon" : "somewhere in the trades, past midnight";
}
modeToggle.addEventListener("click", () => {
  cycle.toggle();
  labelToggles();
});
soundToggle.addEventListener("click", () => {
  ambience.toggle();
  labelToggles();
});
liveToggle.addEventListener("click", () => {
  localStorage.setItem("sw-live", cycle.live ? "0" : "1");
  location.reload(); // loader covers the blink; honest reseed from the clock
});
labelToggles();

// ---------- loop ----------
const clock = new THREE.Clock();
let hidden = false;
document.addEventListener("visibilitychange", () => {
  hidden = document.hidden;
  if (!hidden) clock.getDelta(); // swallow the away-time
});

function frame() {
  requestAnimationFrame(frame);
  if (hidden) return;
  const dt = Math.min(clock.getDelta(), 0.1);
  cycle.update(dt);
  const ws = cycle.ws;

  // lighting follows the cycle
  const L = ws.lighting;
  scene.background.copy(L.bg);
  scene.fog.color.copy(L.bg);
  hemi.color.copy(L.hemiSky);
  hemi.groundColor.copy(L.hemiGround);
  hemi.intensity = L.hemiIntensity;
  sun.color.copy(L.sun);
  sun.intensity = L.sunIntensity;
  fill.intensity = L.fillIntensity;
  starMat.opacity = L.starAlpha * 0.9;
  moonMat.opacity = L.starAlpha * 0.95;
  haloMat.opacity = L.starAlpha * 0.07;
  document.body.classList.toggle("night", ws.blend > 0.5);

  // sun swings west + drops at night (moon comes from the other quarter)
  sun.position.set(THREE.MathUtils.lerp(9, -11, ws.blend), THREE.MathUtils.lerp(13, 9, ws.blend), THREE.MathUtils.lerp(5, 7, ws.blend));

  water.update(ws);
  ship.update(ws);
  captain.update(ws, dt);
  crew.update(ws, dt);
  plank.update(ws, dt);
  traffic.update(ws, dt);
  ambience.update(ws, dt);

  // parallax ±2°
  const ax = parX * THREE.MathUtils.degToRad(2);
  const ay = parY * THREE.MathUtils.degToRad(2);
  camera.position.set(
    CAM_BASE.x * Math.cos(ax) - CAM_BASE.z * Math.sin(ax),
    CAM_BASE.y + ay * 3,
    CAM_BASE.x * Math.sin(ax) + CAM_BASE.z * Math.cos(ax)
  );
  camera.lookAt(CAM_TARGET);

  renderer.render(scene, camera);
}
frame();
