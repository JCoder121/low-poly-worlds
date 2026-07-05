import * as THREE from "three";
import { buildWorld, COLORS } from "./world.js";
import { Weather } from "./weather.js";
import { buildLandmarks } from "./landmarks.js";
import { buildWater } from "./water.js";
import { Musashi } from "./musashi.js";
import { Travelers } from "./travelers.js";
import { Cycle } from "./cycle.js";
import { Wind } from "./wind.js";
import { Ambience } from "./sound.js";
import { Cat } from "./cat.js";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const mode = document.body.dataset.mode ?? "island";

// ---------- renderer & scene ----------

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(COLORS.paper);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(COLORS.paper, mode === "expanse" ? 16 : 20, mode === "expanse" ? 30 : 38);

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

const FRUSTUM = mode === "expanse" ? 11 : 11.8;
const camera = new THREE.OrthographicCamera();
function frameCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  // on narrow screens, widen the frustum so the whole island stays in frame.
  // Expanse has no island to fit — its ground is a full-bleed plane — and
  // growing the frustum height here would push the bottom rows of very
  // narrow/tall viewports past the near clip plane (the ray for those rows
  // dips below y=0 before it even reaches the ground), showing background
  // instead of terrain. So expanse keeps a fixed height and just narrows
  // horizontally on tall screens, same as the default (non-narrow) case.
  const height = mode === "expanse" ? FRUSTUM : Math.max(FRUSTUM, 16.5 / aspect);
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

const world = buildWorld(scene, mode);
// cycle first: it picks the (random) opening season, which weather seeds from
const cycle = new Cycle({ reducedMotion });
const weather = new Weather(scene, world.treePosition, reducedMotion, cycle.state.season);
const landmarks = buildLandmarks(world.island, mode);
const water = buildWater(world.island, mode);

// expanse's ground fills the whole frame (no sky gap above an island edge to
// hang stars in), so the star field would just be a dead draw call there.
if (mode !== "expanse") cycle.addStars(scene, camera); // camera framed + positioned above

const musashi = new Musashi(world.island, {
  fire: { position: new THREE.Vector3(0.25, 0, 0.55), facing: 1.1 }, // faces the fire
  tree: { position: new THREE.Vector3(-1.75, 0, -0.7), facing: 0.9 }, // back to the sakura, facing the clearing
  easel: { position: new THREE.Vector3(1.1, 0, -1.5), facing: -2.6 },
  kata: { position: new THREE.Vector3(2.6, 0, 0.6), facing: -1.9 },
  ...landmarks.spots,
  ...water.spots,
});

const cat = new Cat(world.island);
const travelers = new Travelers(world.island, world.curve, camera);

const wind = new Wind();
const ambience = new Ambience();

// ---------- themed loader ----------

const LOADER_LINES = [
  "raking the hillside…",
  "planting the cherry tree…",
  "lighting the fire…",
  "sharpening both swords…",
  "waiting for travelers…",
];
// live season in the wordmark, driven by the cycle each frame
const seasonEl = document.getElementById("season");
let seasonShown = "";

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

// ---------- bottom-left toggles: live clock & ambient sound ----------

// live/drift: flip the persisted flag and reload — the loader covers the blink,
// and a reload is the honest way to reseed the cycle from the real clock.
const liveToggle = document.getElementById("live-toggle");
liveToggle.textContent = cycle.live ? "drift ↗" : "live ↗";
liveToggle.addEventListener("click", () => {
  localStorage.setItem("musashi-live", cycle.live ? "0" : "1");
  location.reload();
});

// sound: no reload — start()/stop() the synthesized ambience on click. A prior
// visitor's "on" just relabels; the browser blocks autoplay, so first click starts.
const soundToggle = document.getElementById("sound-toggle");
soundToggle.textContent = localStorage.getItem("musashi-sound") === "1" ? "mute ↗" : "sound ↗";
soundToggle.addEventListener("click", () => {
  if (ambience.enabled) {
    ambience.stop();
    localStorage.setItem("musashi-sound", "0");
    soundToggle.textContent = "sound ↗";
  } else {
    ambience.start();
    localStorage.setItem("musashi-sound", "1");
    soundToggle.textContent = "mute ↗";
  }
});

// ---------- loop ----------

const clock = new THREE.Clock();
let t = 0;
let nightUI = false; // hysteresis so the overlay text swap doesn't flicker at the threshold

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1); // clamp tab-return jumps
  t += dt;

  cycle.update(dt);
  const ws = cycle.state;
  if (ws.season !== seasonShown) { seasonShown = ws.season; seasonEl.textContent = ws.season; }
  const L = ws.lighting;
  if (!nightUI && ws.night >= 0.45) nightUI = true;
  else if (nightUI && ws.night <= 0.35) nightUI = false;
  document.body.classList.toggle("night", nightUI);
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

  const gust = wind.update(dt, t);
  world.wind?.(gust, t);
  if (ambience.enabled) ambience.setWind(gust);

  world.fire.update(t, ws.night);
  weather.update(dt, t, ws, gust);
  world.seasons.update(ws);
  landmarks.update(dt, t, ws);
  water.update(dt, t, ws);
  cat.update(dt, t, ws);
  musashi.update(dt, t, ws);
  travelers.update(dt, t);

  renderer.render(scene, camera);
});

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  frameCamera();
});
