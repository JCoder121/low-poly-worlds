// sparrow's wake — renderer, camera, lights, loader, toggles, the loop.
import * as THREE from "three";
import { COLORS } from "./palette.js";
import { Cycle } from "./cycle.js";
import { Weather } from "./weather.js";
import { Sky } from "./sky.js";
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
// weather scales these each frame (fogFactor < 1 pulls the wall closer)
const FOG_BASE = pageMode === "expanse" ? { near: 31, far: 50 } : { near: 33, far: 56 };
scene.fog = new THREE.Fog(COLORS.parchment, FOG_BASE.near, FOG_BASE.far);

// island page = the snow globe on a shelf: frame the whole glass sphere
const FRUSTUM = pageMode === "island" ? 14.5 : 13.8;
const camera = new THREE.OrthographicCamera();
const CAM_BASE = new THREE.Vector3(15, 12.5, 15);
const CAM_TARGET = new THREE.Vector3(0, 2.0, 0);
function sizeCamera() {
  const a = window.innerWidth / window.innerHeight;
  camera.left = -FRUSTUM * a;
  camera.right = FRUSTUM * a;
  camera.top = FRUSTUM;
  camera.bottom = -FRUSTUM;
  camera.near = 0.1;
  camera.far = 90;
  camera.updateProjectionMatrix();
}
sizeCamera();
camera.position.copy(CAM_BASE);
camera.lookAt(CAM_TARGET);
scene.add(camera); // sky.js hangs the expanse celestial band off it

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  sizeCamera();
});
renderer.setSize(window.innerWidth, window.innerHeight);

// mouse parallax ±1.2°
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
sun.shadow.camera.left = -17;
sun.shadow.camera.right = 17;
sun.shadow.camera.top = 17;
sun.shadow.camera.bottom = -17;
sun.shadow.camera.near = 2;
sun.shadow.camera.far = 55;
sun.shadow.bias = -0.0006;
scene.add(sun);

const fill = new THREE.DirectionalLight(0xfff1dd, 0.4);
fill.position.set(-10, 6, 12);
scene.add(fill);

// ---------- world modules ----------
const cycle = new Cycle();
const events = { plank: { active: false, phase: "idle" }, camera }; // cast projects bubbles via events.camera

const weather = new Weather(scene);
const water = new Water(scene, pageMode);
const ship = new Ship(scene);
ship.setScale(pageMode === "island" ? 0.55 : 0.9); // globe miniature / 10% trim
const captain = new Captain(ship, events);
const crew = new Crew(ship, events);
const plank = new Plank(ship, captain, crew, water, events);
const traffic = new Traffic(scene, camera, events);
const sky = new Sky(scene, camera, pageMode);
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

// ---------- toggles (musashi grammar: live / sound left, page right) ----------
const soundToggle = document.getElementById("sound-toggle");
const liveToggle = document.getElementById("live-toggle");
const skyline = document.getElementById("skyline");

function labelToggles() {
  soundToggle.textContent = ambience.enabled ? "hush ↗" : "sound ↗";
  liveToggle.textContent = cycle.live ? "drift ↗" : "live ↗";
}
soundToggle.addEventListener("click", () => {
  ambience.toggle();
  labelToggles();
});
liveToggle.addEventListener("click", () => {
  localStorage.setItem("sw-live", cycle.live ? "0" : "1");
  location.reload(); // loader covers the blink; honest reseed from the clock
});
labelToggles();

// live status line: hour band + weather, refreshed once a second
const HOURS = [
  [0.06, "dawn"], [0.18, "morning"], [0.33, "noon"], [0.48, "afternoon"],
  [0.62, "golden hour"], [0.72, "dusk"], [0.9, "past midnight"], [1.01, "before dawn"],
];
const WEATHER_LINE = { clear: "", rain: ", rain coming down", storm: ", storm overhead" };
let skylineTimer = 0;
function updateSkyline(ws) {
  const band = HOURS.find(([end]) => ws.dayPos < end);
  skyline.textContent = `somewhere in the trades, ${band ? band[1] : "night"}${WEATHER_LINE[ws.weather.kind] ?? ""}`;
}

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
  cycle.update(dt); // publishes ws using last frame's weather numbers
  const ws = cycle.ws;
  weather.update(ws, dt); // advances the machine + rain/mist/flash visuals

  // lighting follows the cycle (weather dim is already folded in by cycle)
  const L = ws.lighting;
  scene.background.copy(L.bg);
  scene.fog.color.copy(L.bg);
  scene.fog.near = FOG_BASE.near * ws.weather.fogFactor;
  scene.fog.far = FOG_BASE.far * ws.weather.fogFactor;
  hemi.color.copy(L.hemiSky);
  hemi.groundColor.copy(L.hemiGround);
  hemi.intensity = L.hemiIntensity + ws.weather.flash * 2.2; // lightning lifts the world
  sun.color.copy(L.sun);
  sun.intensity = L.sunIntensity;
  fill.intensity = L.fillIntensity;
  document.body.classList.toggle("night", ws.blend > 0.5);

  // the key light tracks the visible disc: rises screen-left, apex overhead,
  // sets screen-right — shadows sweep the deck across the day
  const dp = L.discPos;
  sun.position.set(
    THREE.MathUtils.lerp(13, -13, dp),
    4.5 + 9 * Math.sin(Math.PI * dp),
    THREE.MathUtils.lerp(4, 8, dp)
  );

  water.update(ws);
  sky.update(ws);
  ship.update(ws);
  captain.update(ws, dt);
  crew.update(ws, dt);
  plank.update(ws, dt);
  traffic.update(ws, dt);
  ambience.update(ws, dt);

  skylineTimer += dt;
  if (skylineTimer > 1) { skylineTimer = 0; updateSkyline(ws); }

  // parallax ±1.2°
  const ax = parX * THREE.MathUtils.degToRad(1.2);
  const ay = parY * THREE.MathUtils.degToRad(1.2);
  camera.position.set(
    CAM_BASE.x * Math.cos(ax) - CAM_BASE.z * Math.sin(ax),
    CAM_BASE.y + ay * 3,
    CAM_BASE.x * Math.sin(ax) + CAM_BASE.z * Math.cos(ax)
  );
  camera.lookAt(CAM_TARGET);

  renderer.render(scene, camera);
}
frame();
