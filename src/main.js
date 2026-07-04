import * as THREE from "three";
import { buildWorld, COLORS } from "./world.js";
import { Weather } from "./weather.js";
import { buildLandmarks } from "./landmarks.js";
import { Musashi } from "./musashi.js";
import { Travelers } from "./travelers.js";
import { Cycle } from "./cycle.js";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- renderer & scene ----------

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(COLORS.paper);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(COLORS.paper, 20, 38);

// ---------- golden-hour light ----------

const hemi = new THREE.HemisphereLight(0xfff4dd, 0xcfc6ae, 0.9);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffe0b0, 1.9);
sun.position.set(9, 11, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -11;
sun.shadow.camera.right = 11;
sun.shadow.camera.top = 11;
sun.shadow.camera.bottom = -11;
sun.shadow.camera.near = 2;
sun.shadow.camera.far = 40;
sun.shadow.bias = -0.0006;
scene.add(sun);

// gentle fill from the camera side so shadowed faces keep their color
const fill = new THREE.DirectionalLight(0xfff1dd, 0.45);
fill.position.set(-8, 6, 10);
scene.add(fill);

// ---------- isometric camera with mouse parallax ----------

const FRUSTUM = 11;
const camera = new THREE.OrthographicCamera();
function frameCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  // on narrow screens, widen the frustum so the whole island stays in frame
  const height = Math.max(FRUSTUM, 16.5 / aspect);
  camera.left = (-height * aspect) / 2;
  camera.right = (height * aspect) / 2;
  camera.top = height / 2;
  camera.bottom = -height / 2;
  camera.near = 0.1;
  camera.far = 100;
  camera.updateProjectionMatrix();
}
frameCamera();
const CAM_BASE = new THREE.Vector3(13, 10.5, 13);
const LOOK_AT = new THREE.Vector3(0, -0.4, 0);
camera.position.copy(CAM_BASE);
camera.lookAt(LOOK_AT);

const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
if (!reducedMotion) {
  window.addEventListener("pointermove", (e) => {
    parallax.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    parallax.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  });
}

// ---------- world & actors ----------

const world = buildWorld(scene);
const weather = new Weather(scene, world.treePosition, reducedMotion);
const landmarks = buildLandmarks(world.island);

const cycle = new Cycle({ reducedMotion });
cycle.addStars(scene, camera); // camera framed + positioned above

const musashi = new Musashi(world.island, {
  fire: { position: new THREE.Vector3(0.25, 0, 0.55), facing: 1.1 }, // faces the fire
  tree: { position: new THREE.Vector3(-1.75, 0, -0.7), facing: 0.9 }, // back to the sakura, facing the clearing
  easel: { position: new THREE.Vector3(1.1, 0, -1.5), facing: -2.6 },
  kata: { position: new THREE.Vector3(2.6, 0, 0.6), facing: -1.9 },
  ...landmarks.spots,
});

// ---------- status line (musashi narrates; travelers may interrupt) ----------

const statusEl = document.getElementById("status");
const ACTIVITY_LINES = {
  zazen: "musashi is sitting by the fire",
  reading: "musashi is reading beneath the sakura",
  painting: "musashi is painting",
  kata: "musashi is practicing kata",
  tea: "musashi is taking tea",
  raking: "musashi is raking the garden",
  temple: "musashi is bowing at the temple",
  misogi: "musashi stands beneath the falls",
  carving: "musashi is carving a bokken",
  bridge: "musashi is watching the water",
};
const WALK_LINES = {
  fire: "musashi walks to the fire", tree: "musashi walks to the sakura",
  easel: "musashi walks to his easel", kata: "musashi walks to the clearing",
  garden: "musashi walks to the garden", temple: "musashi walks to the temple",
  misogi: "musashi walks to the falls", bridge: "musashi walks to the bridge",
};
let interrupted = false;

function setStatus(text) {
  statusEl.classList.add("fading");
  setTimeout(() => {
    statusEl.textContent = text;
    statusEl.classList.remove("fading");
  }, 600);
}

musashi.onActivityChange = (activity) => {
  if (!interrupted) setStatus(ACTIVITY_LINES[activity]);
};
musashi.onWalkStart = (spotName) => { if (!interrupted) setStatus(WALK_LINES[spotName]); };

const travelers = new Travelers(world.island, world.curve, camera, (text) => {
  if (text) {
    interrupted = true;
    setStatus(text);
  } else {
    interrupted = false;
    setStatus(ACTIVITY_LINES[musashi.activity]);
  }
});

// ---------- themed loader ----------

const LOADER_LINES = [
  "raking the hillside…",
  "planting the cherry tree…",
  "lighting the fire…",
  "sharpening both swords…",
  "waiting for travelers…",
];
const loaderEl = document.getElementById("loader");
const loaderMsg = document.getElementById("loader-msg");
const loaderFill = document.getElementById("loader-fill");
LOADER_LINES.forEach((line, i) => {
  setTimeout(() => {
    loaderMsg.textContent = line;
    loaderFill.style.width = `${((i + 1) / LOADER_LINES.length) * 100}%`;
  }, 450 * i);
});
setTimeout(() => loaderEl.classList.add("done"), 450 * LOADER_LINES.length + 500);

// ---------- loop ----------

const clock = new THREE.Clock();
let t = 0;

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1); // clamp tab-return jumps
  t += dt;

  cycle.update(dt);
  const ws = cycle.state;
  const L = ws.lighting;
  renderer.setClearColor(L.bg);
  scene.fog.color.copy(L.bg);
  hemi.color.copy(L.hemiSky);
  hemi.groundColor.copy(L.hemiGround);
  hemi.intensity = L.hemiIntensity;
  sun.color.copy(L.sunColor);
  sun.intensity = L.sunIntensity;
  fill.intensity = L.fillIntensity;

  parallax.x += (parallax.tx - parallax.x) * 0.04;
  parallax.y += (parallax.ty - parallax.y) * 0.04;
  camera.position.set(
    CAM_BASE.x + parallax.x * 0.7,
    CAM_BASE.y - parallax.y * 0.45,
    CAM_BASE.z - parallax.x * 0.7
  );
  camera.lookAt(LOOK_AT);

  world.fire.update(t, ws.night);
  weather.update(dt, t, ws);
  world.seasons.update(ws);
  landmarks.update(dt, t, ws);
  musashi.update(dt, t, ws);
  travelers.update(dt, t);

  renderer.render(scene, camera);
});

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  frameCamera();
});
