// low-poly-worlds landing — a 3D low-poly world map. The map itself is
// "Cartoon world map" by Ashkod (https://sketchfab.com/3d-models/
// cartoon-world-map-8ad781e3183643899a31f228c00ff744), CC-BY 4.0 — a full
// map-table diorama (continents, trees, towns, ice caps AND its own water
// slab), which replaces the old code-built extruded continents + GPU sea.
// Fixed near-top-down ortho camera with mouse parallax; "cover" framing
// crops the slab so the map fills the viewport edge to edge. Two clickable
// DOM pins (musashi's hill fixed on Japan, sparrow's wake drifting the
// Atlantic lane) are projected from world space every frame. Deliberately
// no day/night cycle — this is a directory page, calm and simple.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const PALETTE = {
  bg: "#7ed4e6", // close to the model's painted sea so crop overflow blends in
  hemiSky: "#ffffff",
  hemiGround: "#bfe8f0",
  sun: "#fff6e0",
};

const params = new URLSearchParams(location.search);
const SPEED = params.has("speed") ? Number(params.get("speed")) : 1;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- scene ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.bg);

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById("scene"),
  antialias: true,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

// camera on a rig group so parallax is a pure rig rotation
const ELEV = THREE.MathUtils.degToRad(62);
const DIST = 160;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
camera.position.set(0, Math.sin(ELEV) * DIST, Math.cos(ELEV) * DIST);
camera.lookAt(0, 0, 0);
const rig = new THREE.Group();
rig.add(camera);
scene.add(rig);

// cover framing: scale so the map slab covers the viewport (its on-screen
// height is foreshortened by sin(elev)), cropping the rest. Sizes are
// measured from the loaded model's bounding box, minus a small inset so the
// slab's beveled rim never peeks into frame.
let MAP_W = 100;
let MAP_SCREEN_H = 60 * Math.sin(ELEV);
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
// The model's charm is painted into its textures; lights just present them
// evenly (no shadows — the map has its own painted depth).
scene.add(new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 2.6));
const sun = new THREE.DirectionalLight(PALETTE.sun, 1.1);
sun.position.set(38, 62, 24);
scene.add(sun);

// ---------- world: the Sketchfab map ----------
const SLAB_W = 100; // normalize the slab to a known world width
let mapReady = false;
new GLTFLoader().load(
  import.meta.env.BASE_URL + "models/cartoon_world_map.glb",
  (gltf) => {
    const map = gltf.scene;
    // the GLB carries its own normalizing root scale — measure, don't assume
    const raw = new THREE.Box3().setFromObject(map).getSize(new THREE.Vector3());
    map.scale.setScalar(SLAB_W / raw.x);
    scene.add(map);

    // center the slab on the origin and rest its top face at y=0
    const box = new THREE.Box3().setFromObject(map);
    const c = box.getCenter(new THREE.Vector3());
    map.position.x -= c.x;
    map.position.z -= c.z;
    map.position.y -= box.max.y;
    map.updateMatrixWorld(true);

    // frame to the slab, inset so the beveled rim stays out of the crop
    const size = box.getSize(new THREE.Vector3());
    MAP_W = size.x * 0.94;
    MAP_SCREEN_H = size.z * 0.94 * Math.sin(ELEV);
    resize();

    mapReady = true;
  },
  undefined,
  (err) => {
    console.error("map load failed", err);
    loaderMsg.textContent = "the map went missing…";
  }
);

// ---------- markers (DOM pins projected from world space) ----------
const labelEl = document.getElementById("marker-label");
const _proj = new THREE.Vector3();

const MUSASHI = new THREE.Vector3(36.5, 0.6, -4.5); // japan, off asia's east coast
const DRIFT_A = new THREE.Vector3(-15, 0.4, 16); // open south-atlantic lane
const DRIFT_B = new THREE.Vector3(-7, 0.4, 22); //  between brazil and africa
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
      // smooth back-and-forth along the shipping lane, with a gentle bob
      // (the painted sea is static, so the swell is faked on the pin alone)
      const k = reduced ? 0.5 : 0.5 - 0.5 * Math.cos((time / DRIFT_PERIOD) * Math.PI * 2);
      m.world.lerpVectors(DRIFT_A, DRIFT_B, k);
      if (!reduced) m.world.y += Math.sin(time * 1.7) * 0.25;
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
let framesReady = 0;

// ---------- loop ----------
const clock = new THREE.Clock();
let time = 12;
function tick() {
  requestAnimationFrame(tick);
  if (document.hidden) return;
  const dt = Math.min(clock.getDelta(), 0.1);
  time += dt * SPEED * (reduced ? 0.6 : 1);

  if (!reduced) {
    rig.rotation.y += (targetRY - rig.rotation.y) * 0.04;
    rig.rotation.x += (targetRX - rig.rotation.x) * 0.04;
  }
  updateMarkers(time);
  renderer.render(scene, camera);

  // hide the loader only once the map is actually on screen
  if (mapReady && ++framesReady === 2) {
    setTimeout(() => loaderEl.classList.add("done"), Math.max(0, 300 * LOADER_LINES.length + 300 - performance.now()));
  }
}
tick();
