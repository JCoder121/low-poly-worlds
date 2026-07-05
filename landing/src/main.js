// low-poly-worlds landing — a 3D low-poly world map: extruded continents on a
// GPU-faceted sea (technique adapted from sparrows-wake). Fixed near-top-down
// ortho camera with mouse parallax; "cover" framing crops like the old SVG's
// preserveAspectRatio=slice so the sea always fills the viewport edge to edge.
// Two clickable DOM pins (musashi's hill fixed on Japan, sparrow's wake
// drifting + bobbing on the open Atlantic lane) are projected from world
// space every frame. Deliberately no day/night cycle — this is a directory
// page, calm and simple.
import * as THREE from "three";
import { Water } from "./water.js";
import { buildContinents, LAND_TOP } from "./continents.js";
import { waveHeight } from "./waves.js";

const PALETTE = {
  trough: "#1e6a7d",
  mid: "#2c839a",
  crest: "#7cc7d1",
  fog: "#a7ccd3",
  hemiSky: "#cfe5ea",
  hemiGround: "#5d6b4a",
  sun: "#fff1d6",
};

const params = new URLSearchParams(location.search);
const SPEED = params.has("speed") ? Number(params.get("speed")) : 1;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- scene ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.fog);
scene.fog = new THREE.Fog(PALETTE.fog, 105, 175);

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById("scene"),
  antialias: true,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// camera on a rig group so parallax is a pure rig rotation
const ELEV = THREE.MathUtils.degToRad(62);
const DIST = 80;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 260);
camera.position.set(0, Math.sin(ELEV) * DIST, Math.cos(ELEV) * DIST);
camera.lookAt(0, 0, 0);
const rig = new THREE.Group();
rig.add(camera);
scene.add(rig);

// cover framing: scale so the map region covers the viewport (its on-screen
// height is foreshortened by sin(elev)), cropping the rest. The cover depth
// is padded past the map's true 50 so common 16:9 screens keep the full
// 100-unit width (and Japan's pin) in frame — the padding is just more sea.
const MAP_W = 100;
const MAP_SCREEN_H = 60 * Math.sin(ELEV);
function resize() {
  const w = innerWidth, h = innerHeight;
  const s = Math.max(w / MAP_W, h / MAP_SCREEN_H);
  camera.left = -w / s / 2;
  camera.right = w / s / 2;
  camera.top = h / s / 2;
  camera.bottom = -h / s / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
addEventListener("resize", resize);
resize();

// ---------- lights ----------
scene.add(new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 0.85));
const sun = new THREE.DirectionalLight(PALETTE.sun, 1.7);
sun.position.set(38, 62, 24);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0006;
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 45, bottom: -45, far: 200 });
scene.add(sun);
const fill = new THREE.DirectionalLight(PALETTE.hemiSky, 0.3);
fill.position.set(-20, 40, 60);
scene.add(fill);

// ---------- world ----------
const water = new Water(scene, PALETTE);
buildContinents(scene);

// ---------- markers (DOM pins projected from world space) ----------
const labelEl = document.getElementById("marker-label");
const _proj = new THREE.Vector3();

const MUSASHI = new THREE.Vector3(43.4, LAND_TOP + 0.25, -8.5); // japan
const DRIFT_A = new THREE.Vector3(-12, 0, 3); // open-water lane between
const DRIFT_B = new THREE.Vector3(-1, 0, 8); //  the americas and africa
const DRIFT_PERIOD = 84; // 42s each way, like the old CSS drift

const markers = [...document.querySelectorAll(".marker")].map((el) => ({
  el,
  world: new THREE.Vector3(),
  drifts: el.classList.contains("marker-sparrows"),
}));

for (const { el } of markers) {
  const href = el.dataset.href;
  const label = el.dataset.label;
  el.addEventListener("mouseenter", () => {
    labelEl.textContent = label;
    labelEl.classList.add("visible");
  });
  el.addEventListener("mousemove", (e) => {
    labelEl.style.left = `${e.clientX}px`;
    labelEl.style.top = `${e.clientY}px`;
  });
  el.addEventListener("mouseleave", () => labelEl.classList.remove("visible"));
  const navigate = () => { window.location.href = import.meta.env.BASE_URL + href; };
  el.addEventListener("click", navigate);
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(); }
  });
}

function updateMarkers(time) {
  for (const m of markers) {
    if (m.drifts) {
      // smooth back-and-forth along the shipping lane, bobbing on the swell
      const k = reduced ? 0.5 : 0.5 - 0.5 * Math.cos((time / DRIFT_PERIOD) * Math.PI * 2);
      m.world.lerpVectors(DRIFT_A, DRIFT_B, k);
      m.world.y = waveHeight(m.world.x, m.world.z, time) * (reduced ? 0.5 : 1) + 0.2;
    } else {
      m.world.copy(MUSASHI);
    }
    _proj.copy(m.world).project(camera);
    m.el.style.left = `${(_proj.x * 0.5 + 0.5) * innerWidth}px`;
    m.el.style.top = `${(-_proj.y * 0.5 + 0.5) * innerHeight}px`;
  }
}

// ---------- mouse parallax (±2° on the fixed rig) ----------
let targetRX = 0, targetRY = 0;
addEventListener("pointermove", (e) => {
  const nx = (e.clientX / innerWidth) * 2 - 1;
  const ny = (e.clientY / innerHeight) * 2 - 1;
  targetRY = nx * THREE.MathUtils.degToRad(2);
  targetRX = ny * THREE.MathUtils.degToRad(1.2);
});

// ---------- themed loader ----------
const LOADER_LINES = ["unrolling the map…", "raising the continents…", "filling the sea…"];
const loaderEl = document.getElementById("loader");
const loaderMsg = document.getElementById("loader-msg");
const loaderFill = document.getElementById("loader-fill");
LOADER_LINES.forEach((line, i) => {
  setTimeout(() => {
    loaderMsg.textContent = line;
    loaderFill.style.width = `${((i + 1) / LOADER_LINES.length) * 100}%`;
  }, 300 * i);
});
let framesRendered = 0;

// ---------- loop ----------
const clock = new THREE.Clock();
let time = 12; // start mid-sea-state so a frozen (?speed=0) frame still has waves
function tick() {
  requestAnimationFrame(tick);
  if (document.hidden) return;
  const dt = Math.min(clock.getDelta(), 0.1);
  time += dt * SPEED * (reduced ? 0.6 : 1);

  if (!reduced) {
    rig.rotation.y += (targetRY - rig.rotation.y) * 0.04;
    rig.rotation.x += (targetRX - rig.rotation.x) * 0.04;
  }
  water.update(time, reduced);
  updateMarkers(time);
  renderer.render(scene, camera);

  if (++framesRendered === 2) {
    setTimeout(() => loaderEl.classList.add("done"), Math.max(0, 300 * LOADER_LINES.length + 300 - performance.now()));
  }
}
tick();
