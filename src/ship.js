// sparrow's wake — the brig. A chunky toy pirate ship, hove-to on the swell.
// Bow points +x, starboard (plank + traffic side) is +z. All deck life is
// parented to `group` so it rides the bob for free. Colors from palette COLORS,
// lit materials via mat(); animation driven only by ws.time (scrub-safe).
import * as THREE from "three";
import { COLORS, mat, unlit, jitterGeometry } from "./palette.js";
import { waveHeight } from "./waves.js";

const DECK_Y = 1.05; // local y of the walkable deck surface
const HULL_DEPTH = 1.4; // extrude height of the hull prism
const HULL_BOTTOM = -0.35; // local y of the keel → 0.35 draft when origin sits at the waterline
const BOB_OFFSET = -0.02; // settle the hull a touch deeper than mean water

// module-scope scratch so update() allocates nothing
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();

// A thin rounded strut between two points (ratlines, bowsprit, brackets).
function strut(ax, ay, az, bx, by, bz, r, color, seg = 5) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const len = Math.hypot(dx, dy, dz) || 0.001;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat(color));
  m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  m.quaternion.setFromUnitVectors(_up, _dir.set(dx, dy, dz).normalize());
  m.castShadow = true;
  return m;
}

export class Ship {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this._rotX = 0; // damped roll / pitch state
    this._rotZ = 0;
    this.sails = []; // { mesh, base:Float32Array, phase }
    this.flag = null;
    this.glowMats = []; // window + lantern emissive mats (night)
    this.lantern = null; // stern PointLight

    this.deckY = DECK_Y;
    this.deckBounds = { minX: -2.3, maxX: 2.6, minZ: -0.95, maxZ: 0.95 };

    this._buildHull();
    this._buildSternCabin();
    this._buildMasts();
    this._buildDeckProps();
    this._buildPlank();

    // Named deck stations (LOCAL coords). y = deckY unless noted. facing is a
    // world-plane bearing: 0 = +x (bow), +π/2 = +z (starboard / camera side).
    const P = (x, y, z, facing) => ({ position: new THREE.Vector3(x, y, z), facing });
    this.spots = {
      helm: P(-2.1, DECK_Y, 0, 0), // just aft of the wheel, hands forward
      bow: P(2.3, DECK_Y, 0, 0), // spyglass over the bow
      compass: P(0.6, DECK_Y, 0.35, 0), // amidships, watching the needle wander
      mapBarrel: P(0.35, DECK_Y, -0.32, -Math.PI / 2), // leaning over the map barrel (port)
      steps: P(-2.25, DECK_Y + 0.15, 0.5, 0), // seated on the cabin steps, rum in hand
      rail: P(0.8, DECK_Y, 0.8, Math.PI / 2), // leaning on the starboard rail
      gullRail: P(1.7, DECK_Y, 0.78, Math.PI / 2), // forward starboard rail, feeding gulls
      mastNap: P(-0.4, DECK_Y, -0.55, 0), // stretched out beside the mainmast
      cannon: P(0.95, DECK_Y, -0.52, -Math.PI / 2), // portside gun
      ropeSpot: P(1.5, DECK_Y, -0.45, 0), // hauling / coiling line
      hatch: P(-0.2, DECK_Y, 0, 0), // the amidships hatch (prisoner emerges here)
      plankBase: P(0.4, DECK_Y, 0.9, Math.PI / 2), // inboard end of the plank
      plankTip: P(0.4, DECK_Y, 2.0, Math.PI / 2), // out over the water
      crowsNest: P(-0.9, 4.3, 0, 0), // up the mainmast
      swabA: P(0.1, DECK_Y, 0.5, 0),
      swabB: P(-1.3, DECK_Y, -0.4, 0),
    };

    // Circles walkers route around (local coords): both masts, hatch, wheel,
    // plus the bulkier props so figures don't clip them.
    this.keepouts = [
      { x: 1.2, z: 0, r: 0.35 }, // foremast
      { x: -0.9, z: 0, r: 0.4 }, // mainmast
      { x: -0.2, z: 0, r: 0.5 }, // hatch
      { x: -1.7, z: 0, r: 0.35 }, // wheel
      { x: 0.95, z: -0.98, r: 0.4 }, // cannon
      { x: 0.35, z: -0.62, r: 0.28 }, // map barrel
      { x: -0.4, z: 0.62, r: 0.3 }, // second barrel
    ];
  }

  // ---- hull: a jittered extruded prism with a pointed bow ----
  _buildHull() {
    // shape coords: x = length (bow +x), y = half-width (→ ship z)
    const s = new THREE.Shape();
    s.moveTo(-3.0, -1.0);
    s.lineTo(1.4, -1.2); // slightly overwide amidships
    s.lineTo(2.5, -0.95);
    s.lineTo(3.25, 0); // bow point
    s.lineTo(2.5, 0.95);
    s.lineTo(1.4, 1.2);
    s.lineTo(-3.0, 1.0);
    s.closePath();

    let geo = new THREE.ExtrudeGeometry(s, { depth: HULL_DEPTH, bevelEnabled: false, steps: 1 });
    geo.rotateX(-Math.PI / 2); // shape(x,y) → world(x, extrude, -y); depth becomes height 0..HULL_DEPTH
    jitterGeometry(geo, 0.02); // organic wobble (indexed → faces stay welded)
    const hull = new THREE.Mesh(geo, mat(COLORS.hull));
    hull.position.y = HULL_BOTTOM;
    hull.castShadow = hull.receiveShadow = true;
    this.group.add(hull);

    // waterline trim band (darker), a squat prism hugging the hull at rest level
    const band = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.16, 2.3), mat(COLORS.hullDark));
    band.position.y = 0.06;
    band.castShadow = true;
    this.group.add(band);

    // deck surfaces (receive shadow) — a main rectangle + a narrower bow patch
    const deckMain = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.16, 2.1), mat(COLORS.deck));
    deckMain.position.set(-0.05, DECK_Y - 0.08, 0);
    deckMain.receiveShadow = true;
    const deckBow = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 1.4), mat(COLORS.deck));
    deckBow.position.set(2.55, DECK_Y - 0.08, 0);
    deckBow.receiveShadow = true;
    this.group.add(deckMain, deckBow);

    // bulwarks: straight port/starboard rails + a converging bow cap
    for (const zside of [-1.08, 1.08]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.34, 0.08), mat(COLORS.hullDark));
      rail.position.set(-0.1, DECK_Y + 0.15, zside);
      rail.castShadow = rail.receiveShadow = true;
      this.group.add(rail);
    }
    for (const zside of [-1.05, 1.05]) {
      this.group.add(strut(2.0, DECK_Y + 0.15, zside, 3.15, DECK_Y + 0.1, 0, 0.06, COLORS.hullDark));
    }

    // bowsprit jutting forward and up from the stem
    this.group.add(strut(3.2, DECK_Y + 0.05, 0, 4.55, DECK_Y + 0.55, 0, 0.07, COLORS.mast, 6));
  }

  // ---- stern cabin (aft, -x): raised box, windows, ship's wheel, lantern ----
  _buildSternCabin() {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.92, 1.9), mat(COLORS.hull));
    cabin.position.set(-2.62, DECK_Y + 0.46, 0);
    cabin.castShadow = cabin.receiveShadow = true;
    this.group.add(cabin);

    // slightly overhanging roof / poop deck
    const roof = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.12, 2.05), mat(COLORS.hullDark));
    roof.position.set(-2.6, DECK_Y + 0.98, 0);
    roof.castShadow = true;
    this.group.add(roof);

    // three stern windows on the aft face (normal → -x), emissive at night
    for (const z of [-0.5, 0, 0.5]) {
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(0.24, 0.3),
        mat(0x15151f, { emissive: COLORS.lanternGlow, emissiveIntensity: 0 })
      );
      win.position.set(-2.99, DECK_Y + 0.5, z);
      win.rotation.y = -Math.PI / 2;
      this.group.add(win);
      this.glowMats.push(win.material);
    }

    // cabin steps down to the main deck (the "rum" seat sits on these)
    for (let i = 0; i < 3; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.9), mat(COLORS.mast));
      step.position.set(-2.28 + i * 0.16, DECK_Y + 0.06 + i * 0.12, 0.5);
      step.castShadow = step.receiveShadow = true;
      this.group.add(step);
    }

    // ship's wheel forward of the cabin — vertical, axle fore-aft
    const wheel = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 6, 14), mat(COLORS.mast));
    rim.rotation.y = Math.PI / 2;
    wheel.add(rim);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.52, 4), mat(COLORS.mast));
      spoke.rotation.x = a; // spin the spoke around the fore-aft axle
      wheel.add(spoke);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 6), mat(COLORS.brass));
    hub.rotation.z = Math.PI / 2;
    wheel.add(hub);
    wheel.position.set(-1.7, DECK_Y + 0.34, 0);
    wheel.traverse((o) => (o.castShadow = true));
    // a small binnacle post under the wheel
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.34, 6), mat(COLORS.hullDark));
    post.position.set(-1.7, DECK_Y + 0.05, 0);
    post.castShadow = true;
    this.group.add(wheel, post);

    // stern lantern: brass bracket + emissive glow sphere + a soft point light
    this.group.add(strut(-3.0, DECK_Y + 0.9, 0, -3.28, DECK_Y + 0.78, 0, 0.03, COLORS.brass, 5));
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 6), mat(COLORS.brass));
    cage.position.set(-3.3, DECK_Y + 0.62, 0);
    cage.castShadow = true;
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 6),
      mat(COLORS.lanternGlow, { emissive: COLORS.lanternGlow, emissiveIntensity: 0 })
    );
    glow.position.copy(cage.position);
    this.group.add(cage, glow);
    this.glowMats.push(glow.material);

    this.lantern = new THREE.PointLight(COLORS.lanternGlow, 0, 4.5, 2);
    this.lantern.position.set(-3.3, DECK_Y + 0.62, 0);
    this.group.add(this.lantern);
  }

  // ---- masts, yards, billowing sails, crow's nest, flag, ratlines ----
  _buildMasts() {
    // [x, height, yardY, sailCenterY, phase]
    const masts = [
      { x: 1.2, h: 4.6, yardY: 3.6, sailY: 2.75, phase: 0 }, // foremast
      { x: -0.9, h: 4.9, yardY: 4.0, sailY: 3.1, phase: 1.3 }, // mainmast (crow's nest + flag)
    ];
    for (const m of masts) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, m.h, 7), mat(COLORS.mast));
      mast.position.set(m.x, DECK_Y + m.h / 2, 0);
      mast.castShadow = true;
      this.group.add(mast);

      // yard (horizontal spar)
      const yard = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 2.4), mat(COLORS.mast));
      yard.position.set(m.x, m.yardY, 0);
      yard.castShadow = true;
      this.group.add(yard);

      // loose square sail: subdivided plane, faceted, billowed on the CPU
      const geo = new THREE.PlaneGeometry(2.2, 1.6, 6, 4);
      const sail = new THREE.Mesh(geo, mat(COLORS.sail, { side: THREE.DoubleSide }));
      sail.rotation.y = Math.PI / 2; // width runs across the ship (z); normal → fore/aft (x)
      sail.position.set(m.x, m.sailY, 0);
      sail.castShadow = true;
      this.group.add(sail);
      this.sails.push({ mesh: sail, base: Float32Array.from(geo.attributes.position.array), phase: m.phase });

      // ratline hints: a couple of shrouds from the rail up to the masthead
      for (const zside of [-1, 1]) {
        this.group.add(strut(m.x, DECK_Y, zside * 0.9, m.x, m.yardY - 0.3, zside * 0.12, 0.018, COLORS.rope, 4));
      }
    }

    // crow's nest ring on the mainmast
    const nest = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.08, 8), mat(COLORS.mast));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 5, 10), mat(COLORS.hullDark));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.16;
    nest.add(floor, ring);
    nest.position.set(-0.9, 4.24, 0);
    nest.traverse((o) => (o.castShadow = true));
    this.group.add(nest);

    // black flag at the mainmast tip — a waving strip
    const fgeo = new THREE.PlaneGeometry(0.9, 0.5, 6, 3);
    const flag = new THREE.Mesh(fgeo, mat(COLORS.flag, { side: THREE.DoubleSide }));
    flag.position.set(-0.45, DECK_Y + 4.9 - 0.35, 0); // left edge near the masthead
    flag.castShadow = true;
    this.group.add(flag);
    this.flag = { mesh: flag, base: Float32Array.from(fgeo.attributes.position.array) };
  }

  // ---- deck clutter: hatch, barrels, coiled rope, cannon ----
  _buildDeckProps() {
    // amidships hatch (prisoner pops from here in the plank event)
    const coaming = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.18, 0.72), mat(COLORS.hullDark));
    coaming.position.set(-0.2, DECK_Y + 0.09, 0);
    coaming.castShadow = coaming.receiveShadow = true;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.6), mat(COLORS.deck));
    lid.position.set(-0.2, DECK_Y + 0.21, 0);
    lid.castShadow = true;
    this.group.add(coaming, lid);

    // two barrels (one is the map barrel, port; one starboard)
    for (const [x, z, map] of [[0.35, -0.62, true], [-0.4, 0.62, false]]) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.5, 9), mat(COLORS.barrel));
      barrel.position.set(x, DECK_Y + 0.25, z);
      barrel.castShadow = barrel.receiveShadow = true;
      this.group.add(barrel);
      for (const hy of [0.12, 0.38]) {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.02, 4, 10), mat(COLORS.hullDark));
        hoop.rotation.x = Math.PI / 2;
        hoop.position.set(x, DECK_Y + hy, z);
        this.group.add(hoop);
      }
      if (map) {
        const scroll = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.34, 6), mat(COLORS.paper));
        scroll.rotation.z = Math.PI / 2;
        scroll.position.set(x, DECK_Y + 0.53, z);
        scroll.castShadow = true;
        this.group.add(scroll);
      }
    }

    // coiled rope near the rope station
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 5, 12), mat(COLORS.rope));
    coil.rotation.x = Math.PI / 2;
    coil.position.set(1.5, DECK_Y + 0.05, -0.5);
    coil.castShadow = coil.receiveShadow = true;
    this.group.add(coil);

    // portside cannon on a low carriage, muzzle outboard (-z)
    const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.42), mat(COLORS.hullDark));
    carriage.position.set(0.95, DECK_Y + 0.08, -0.9);
    carriage.castShadow = true;
    const barrelG = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.6, 8), mat(COLORS.cannon));
    barrelG.rotation.x = Math.PI / 2; // lie along z
    barrelG.position.set(0.95, DECK_Y + 0.22, -1.05);
    barrelG.castShadow = true;
    this.group.add(carriage, barrelG);
  }

  // ---- the plank: permanently mounted, protruding starboard (+z) ----
  _buildPlank() {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 1.5), mat(COLORS.deck));
    plank.position.set(0.4, DECK_Y - 0.02, 1.45); // inboard on deck → out over the water
    plank.castShadow = plank.receiveShadow = true;
    this.group.add(plank);
    // a couple of lashings where it crosses the rail
    const lash = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 4, 8), mat(COLORS.rope));
    lash.rotation.y = Math.PI / 2;
    lash.position.set(0.4, DECK_Y, 1.05);
    this.group.add(lash);
  }

  update(ws) {
    const t = ws.time;
    const amp = ws.reduced ? 0.5 : 1;

    // buoyancy: sample the shared wave field at the four hull corners (world)
    const gx = this.group.position.x, gz = this.group.position.z;
    const hFS = waveHeight(gx + 2.6, gz + 1.0, t); // fore-starboard
    const hFP = waveHeight(gx + 2.6, gz - 1.0, t); // fore-port
    const hAS = waveHeight(gx - 2.6, gz + 1.0, t); // aft-starboard
    const hAP = waveHeight(gx - 2.6, gz - 1.0, t); // aft-port
    const mean = (hFS + hFP + hAS + hAP) * 0.25;
    const hFwd = (hFS + hFP) * 0.5, hAft = (hAS + hAP) * 0.5;
    const hStar = (hFS + hAS) * 0.5, hPort = (hFP + hAP) * 0.5;

    // pitch about +z (bow up when fore is higher); roll about +x (starboard up
    // needs a negative x-rotation). damped toward target (lerp 0.06).
    const targetZ = ((hFwd - hAft) / 5.2) * amp;
    const targetX = (-(hStar - hPort) / 2.0) * 0.85 * amp;
    this._rotZ += (targetZ - this._rotZ) * 0.06;
    this._rotX += (targetX - this._rotX) * 0.06;

    this.group.position.y = mean + BOB_OFFSET;
    this.group.rotation.z = this._rotZ;
    this.group.rotation.x = this._rotX;
    this.group.rotation.y = Math.sin(t * 0.05) * 0.04 * amp; // slow heading drift

    // sail billow (CPU vertex offset along each plane's local normal / z)
    const sAmp = 0.1 * amp;
    for (const s of this.sails) {
      const pos = s.mesh.geometry.attributes.position;
      const base = s.base;
      for (let i = 0; i < pos.count; i++) {
        const bx = base[i * 3], by = base[i * 3 + 1];
        const w = Math.sin(bx * 2.2 + t * 1.4 + s.phase) * sAmp + Math.sin(by * 1.6 - t * 0.9 + s.phase) * sAmp * 0.5;
        pos.setZ(i, base[i * 3 + 2] + w);
      }
      pos.needsUpdate = true;
    }

    // flag: a livelier ripple, stronger toward the free (outer) edge
    if (this.flag) {
      const pos = this.flag.mesh.geometry.attributes.position;
      const base = this.flag.base;
      for (let i = 0; i < pos.count; i++) {
        const bx = base[i * 3]; // -0.45..0.45 (mast edge → free edge)
        const edge = (bx + 0.45) / 0.9; // 0 at mast, 1 at fly
        const w = Math.sin(bx * 6 + t * 3.5) * 0.14 * edge * amp;
        pos.setZ(i, base[i * 3 + 2] + w);
      }
      pos.needsUpdate = true;
    }

    // night glow: windows + lantern emissive, and the stern point light
    const e = ws.lighting.lampIntensity * 1.6;
    for (const m of this.glowMats) m.emissiveIntensity = e;
    // physical light units: point lights need far more than emissive scale
    if (this.lantern) this.lantern.intensity = e * 7;
  }
}
