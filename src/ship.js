// sparrow's wake — the brig. A chunky toy pirate ship, hove-to on the swell,
// now scaled up to a real ~19-unit brig that the size-1 figures live ON. The
// deck plan and hull grow ~3×, but the rig is height-capped (~2.4×) so the
// masts stay inside the ortho frame, and thin detail (rails, hoops, plank,
// steps) grows only ~2× so nothing reads as an oversized wall.
// Bow points +x, starboard (plank + traffic side) is +z. All deck life is
// parented to `group` so it rides the bob for free. Colors from palette COLORS,
// lit materials via mat(); animation driven only by ws.time (scrub-safe).
import * as THREE from "three";
import { COLORS, mat, unlit, jitterGeometry } from "./palette.js";
import { waveHeight } from "./waves.js";

const DECK_Y = 3.1; // local y of the walkable deck surface (was 1.05, ~3× up)
const HULL_DEPTH = 4.0; // extrude height of the hull prism
const HULL_BOTTOM = -0.9; // local y of the keel → ~0.9 draft at the waterline
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

// A small pyramid stack of cannonballs (4 base + 1 crown) at deck level.
function ballStack(x, z) {
  const g = new THREE.Group();
  const r = 0.12, d = 0.13;
  for (const [bx, bz] of [[-d, -d], [d, -d], [-d, d], [d, d]]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), mat(COLORS.cannon));
    b.position.set(bx, r, bz);
    b.castShadow = true;
    g.add(b);
  }
  const top = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), mat(COLORS.cannon));
  top.position.set(0, r * 1.95, 0);
  top.castShadow = true;
  g.add(top);
  g.position.set(x, DECK_Y, z);
  return g;
}

export class Ship {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.scale = 1; // page scale (setScale); buoyancy offsets scale with it
    this._rotX = 0; // damped roll / pitch state
    this._rotZ = 0;
    this.sails = []; // { mesh, base:Float32Array, phase }
    this.flag = null;
    this.glowMats = []; // window + lantern emissive mats (night)
    this.lantern = null; // stern PointLight

    this.deckY = DECK_Y;
    // walkable rect inside the bulwarks (~3× the old footprint)
    this.deckBounds = { minX: -6.9, maxX: 7.8, minZ: -2.85, maxZ: 2.85 };

    this._buildHull();
    this._buildSternCabin();
    this._buildMasts();
    this._buildDeckProps();
    this._buildBell();
    this._buildPlank();
    this._buildDetails();

    // Named deck stations (LOCAL coords). y = deckY unless noted. facing is a
    // world-plane bearing: 0 = +x (bow), +π/2 = +z (starboard / camera side).
    // Interaction spots sit a person-length (~0.5) off their prop, NOT ×3 away,
    // because the figures stayed size 1.0 while the ship grew around them.
    const P = (x, y, z, facing) => ({ position: new THREE.Vector3(x, y, z), facing });
    this.spots = {
      helm: P(-5.6, DECK_Y, 0, 0), // just aft of the wheel, hands forward
      bow: P(6.9, DECK_Y, 0, 0), // spyglass over the bow
      compass: P(1.8, DECK_Y, 1.05, 0), // amidships, watching the needle wander
      mapBarrel: P(1.05, DECK_Y, -1.2, -Math.PI / 2), // leaning over the map barrel (port)
      steps: P(-6.2, DECK_Y + 0.45, 1.5, 0), // seated on the cabin steps, rum in hand
      rail: P(2.4, DECK_Y, 2.8, Math.PI / 2), // leaning on the starboard rail
      gullRail: P(5.1, DECK_Y, 2.8, Math.PI / 2), // forward starboard rail, feeding gulls
      mastNap: P(-2.7, DECK_Y, -1.65, 0), // stretched out beside the mainmast
      cannon: P(2.85, DECK_Y, -1.56, -Math.PI / 2), // portside gun
      ropeSpot: P(4.5, DECK_Y, -1.35, 0), // hauling / coiling line
      hatch: P(-0.6, DECK_Y, 0, 0), // the amidships hatch (prisoner emerges here)
      plankBase: P(1.2, DECK_Y, 3.3, Math.PI / 2), // inboard end of the plank (at the rail)
      plankTip: P(1.2, DECK_Y, 6.0, Math.PI / 2), // out over the water
      crowsNest: P(-2.7, 9.0, 0, 0), // up the mainmast
      swabA: P(0.3, DECK_Y, 1.5, 0), // fore zone
      swabB: P(-3.9, DECK_Y, -1.2, 0), // aft zone
      swabC: P(-1.5, DECK_Y, 1.6, 0), // mid zone
      fishing: P(-5.7, DECK_Y, 2.8, Math.PI / 2), // stern quarter starboard rail
      pace1: P(-6.4, DECK_Y, -1.4, 0), // quarterdeck pacing, aft end
      pace2: P(-3.6, DECK_Y, -1.4, 0), // quarterdeck pacing, forward end
      bell: P(-1.7, DECK_Y, 1.0, Math.PI), // reaching the ship's bell by the mainmast
    };

    // Circles walkers route around (local coords): both masts, hatch, wheel,
    // the bulkier props, and the bell gallows so figures don't clip them.
    this.keepouts = [
      { x: 3.6, z: 0, r: 1.05 }, // foremast
      { x: -2.7, z: 0, r: 1.2 }, // mainmast
      { x: -0.6, z: 0, r: 1.5 }, // hatch
      { x: -5.1, z: 0, r: 1.05 }, // wheel
      { x: 2.85, z: -2.94, r: 1.1 }, // cannon
      { x: 1.05, z: -1.86, r: 0.84 }, // map barrel
      { x: -1.2, z: 1.86, r: 0.9 }, // second barrel
      { x: -2.3, z: 1.0, r: 0.45 }, // ship's bell gallows
      // detail-pass props that sit on the walkable deck
      { x: 5.0, z: -2.6, r: 0.38 }, // cannonball stack (fore port)
      { x: 0.3, z: -2.6, r: 0.38 }, // cannonball stack (mid port)
      { x: -4.2, z: -2.5, r: 0.38 }, // cannonball stack (aft port)
      { x: 5.6, z: 1.0, r: 0.38 }, // cannonball stack (bow starboard)
      { x: 5.2, z: 1.9, r: 0.4 }, // coiled rope (fore starboard)
      { x: -4.6, z: -2.4, r: 0.4 }, // coiled rope (aft port)
      { x: -0.6, z: 1.75, r: 0.6 }, // crate beside the hatch
    ];
  }

  // ---- hull: a jittered extruded prism with a pointed bow (all coords ×3) ----
  _buildHull() {
    // shape coords: x = length (bow +x), y = half-width (→ ship z)
    const s = new THREE.Shape();
    s.moveTo(-9.0, -3.0);
    s.lineTo(4.2, -3.6); // slightly overwide amidships
    s.lineTo(7.5, -2.85);
    s.lineTo(9.75, 0); // bow point (~18.75 long overall)
    s.lineTo(7.5, 2.85);
    s.lineTo(4.2, 3.6);
    s.lineTo(-9.0, 3.0);
    s.closePath();

    let geo = new THREE.ExtrudeGeometry(s, { depth: HULL_DEPTH, bevelEnabled: false, steps: 1 });
    geo.rotateX(-Math.PI / 2); // shape(x,y) → world(x, extrude, -y); depth becomes height 0..HULL_DEPTH
    jitterGeometry(geo, 0.06); // organic wobble (indexed → faces stay welded)
    const hull = new THREE.Mesh(geo, mat(COLORS.hull));
    hull.position.y = HULL_BOTTOM;
    hull.castShadow = hull.receiveShadow = true;
    this.group.add(hull);

    // waterline trim band (darker), a squat prism hugging the hull at rest level
    const band = new THREE.Mesh(new THREE.BoxGeometry(18.0, 0.34, 6.9), mat(COLORS.hullDark));
    band.position.y = 0.12;
    band.castShadow = true;
    this.group.add(band);

    // deck surfaces (receive shadow) — a main rectangle + a narrower bow patch
    const deckMain = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.3, 6.3), mat(COLORS.deck));
    deckMain.position.set(-0.15, DECK_Y - 0.15, 0);
    deckMain.receiveShadow = true;
    const deckBow = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.3, 4.2), mat(COLORS.deck));
    deckBow.position.set(7.65, DECK_Y - 0.15, 0);
    deckBow.receiveShadow = true;
    this.group.add(deckMain, deckBow);

    // bulwarks: straight port/starboard rails (thickness only ~2× — chunky, not
    // wall-like) + a converging bow cap
    for (const zside of [-3.24, 3.24]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.7, 0.16), mat(COLORS.hullDark));
      rail.position.set(-0.3, DECK_Y + 0.3, zside);
      rail.castShadow = rail.receiveShadow = true;
      this.group.add(rail);
    }
    for (const zside of [-3.15, 3.15]) {
      this.group.add(strut(6.0, DECK_Y + 0.3, zside, 9.45, DECK_Y + 0.2, 0, 0.12, COLORS.hullDark));
    }

    // bowsprit jutting forward and up from the stem
    this.group.add(strut(9.6, DECK_Y + 0.1, 0, 13.65, DECK_Y + 1.3, 0, 0.14, COLORS.mast, 6));
  }

  // ---- stern cabin (aft, -x): raised box, windows, ship's wheel, lantern ----
  _buildSternCabin() {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.16, 2.2, 5.7), mat(COLORS.hull));
    cabin.position.set(-7.86, DECK_Y + 1.1, 0);
    cabin.castShadow = cabin.receiveShadow = true;
    this.group.add(cabin);

    // slightly overhanging roof / poop deck
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.28, 6.15), mat(COLORS.hullDark));
    roof.position.set(-7.8, DECK_Y + 2.3, 0);
    roof.castShadow = true;
    this.group.add(roof);

    // three stern windows on the aft face (normal → -x), emissive at night
    for (const z of [-1.5, 0, 1.5]) {
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(0.6, 0.8),
        mat(0x15151f, { emissive: COLORS.lanternGlow, emissiveIntensity: 0 })
      );
      win.position.set(-8.97, DECK_Y + 1.2, z);
      win.rotation.y = -Math.PI / 2;
      this.group.add(win);
      this.glowMats.push(win.material);
    }

    // cabin steps down to the main deck (the "rum" seat sits on these)
    for (let i = 0; i < 4; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 1.8), mat(COLORS.mast));
      step.position.set(-6.6 + i * 0.42, DECK_Y + 0.14 + i * 0.28, 1.5);
      step.castShadow = step.receiveShadow = true;
      this.group.add(step);
    }

    // ship's wheel forward of the cabin — vertical, axle fore-aft (~2.5× prop)
    const wheel = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.07, 6, 14), mat(COLORS.mast));
    rim.rotation.y = Math.PI / 2;
    wheel.add(rim);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.35, 4), mat(COLORS.mast));
      spoke.rotation.x = a; // spin the spoke around the fore-aft axle
      wheel.add(spoke);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.36, 6), mat(COLORS.brass));
    hub.rotation.z = Math.PI / 2;
    wheel.add(hub);
    wheel.position.set(-5.1, DECK_Y + 0.85, 0);
    wheel.traverse((o) => (o.castShadow = true));
    // a binnacle post under the wheel
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.0, 6), mat(COLORS.hullDark));
    post.position.set(-5.1, DECK_Y + 0.45, 0);
    post.castShadow = true;
    this.group.add(wheel, post);

    // stern lantern: brass bracket + emissive glow sphere + a soft point light
    this.group.add(strut(-8.9, DECK_Y + 2.5, 0, -9.35, DECK_Y + 2.9, 0, 0.06, COLORS.brass, 5));
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.4, 6), mat(COLORS.brass));
    cage.position.set(-9.38, DECK_Y + 2.62, 0); // above the roofline — visible from the camera quarter
    cage.castShadow = true;
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 6),
      mat(COLORS.lanternGlow, { emissive: COLORS.lanternGlow, emissiveIntensity: 0 })
    );
    glow.position.copy(cage.position);
    this.group.add(cage, glow);
    this.glowMats.push(glow.material);

    this.lantern = new THREE.PointLight(COLORS.lanternGlow, 0, 16, 2);
    this.lantern.position.set(-9.38, DECK_Y + 2.62, 0);
    this.group.add(this.lantern);
  }

  // ---- masts, yards, billowing sails, crow's nest, flag, ratlines ----
  // Heights are height-capped (~1.6–1.7× the old rig, not 3×) so the flag tops
  // out near world y≈11 and the crow's nest stays ≤10.5 — inside the ortho frame.
  _buildMasts() {
    // [x, height above deck, yardY (world), sailCenterY (world), phase]
    const masts = [
      { x: 3.6, h: 7.4, yardY: 8.0, sailY: 6.6, phase: 0 }, // foremast
      { x: -2.7, h: 8.0, yardY: 8.5, sailY: 7.0, phase: 1.3 }, // mainmast (crow's nest + flag)
    ];
    for (const m of masts) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, m.h, 7), mat(COLORS.mast));
      mast.position.set(m.x, DECK_Y + m.h / 2, 0);
      mast.castShadow = true;
      this.group.add(mast);

      // yard (horizontal spar)
      const yard = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 6.7), mat(COLORS.mast));
      yard.position.set(m.x, m.yardY, 0);
      yard.castShadow = true;
      this.group.add(yard);

      // loose square sail: subdivided plane, faceted, billowed on the CPU
      const geo = new THREE.PlaneGeometry(6.0, 4.0, 6, 4);
      // sails hang edge-on to a high sun and go grey on hemi light alone —
      // a whisper of self-color emissive keeps the canvas reading cream
      const sail = new THREE.Mesh(
        geo,
        mat(COLORS.sail, { side: THREE.DoubleSide, emissive: COLORS.sail, emissiveIntensity: 0.16 })
      );
      sail.rotation.y = Math.PI / 2; // width runs across the ship (z); normal → fore/aft (x)
      // hang the canvas +0.4 forward of the mast axis so the swaying sail never
      // rhythmically occludes the mast cylinder behind it
      sail.position.set(m.x + 0.4, m.sailY, 0);
      sail.castShadow = true;
      this.group.add(sail);
      this.sails.push({ mesh: sail, base: Float32Array.from(geo.attributes.position.array), phase: m.phase });

      // ratline hints: a couple of shrouds from the rail up to the masthead
      for (const zside of [-1, 1]) {
        this.group.add(strut(m.x, DECK_Y, zside * 2.7, m.x, m.yardY - 0.7, zside * 0.36, 0.036, COLORS.rope, 4));
      }
    }

    // crow's nest ring on the mainmast (sized to hold a size-1 lookout)
    const nest = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.6, 0.16, 8), mat(COLORS.mast));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.08, 5, 10), mat(COLORS.hullDark));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.32;
    nest.add(floor, ring);
    nest.position.set(-2.7, 8.8, 0);
    nest.traverse((o) => (o.castShadow = true));
    this.group.add(nest);

    // black flag at the mainmast tip — a waving strip
    const fgeo = new THREE.PlaneGeometry(2.2, 1.2, 6, 3);
    const flag = new THREE.Mesh(fgeo, mat(COLORS.flag, { side: THREE.DoubleSide }));
    flag.position.set(-1.6, 10.3, 0); // left edge near the masthead (main top ≈11.1)
    flag.castShadow = true;
    this.group.add(flag);
    this.flag = { mesh: flag, base: Float32Array.from(fgeo.attributes.position.array) };
  }

  // ---- deck clutter: hatch, barrels, coiled rope, cannon ----
  _buildDeckProps() {
    // amidships hatch (prisoner pops from here in the plank event)
    const coaming = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.36, 2.16), mat(COLORS.hullDark));
    coaming.position.set(-0.6, DECK_Y + 0.18, 0);
    coaming.castShadow = coaming.receiveShadow = true;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 1.8), mat(COLORS.deck));
    lid.position.set(-0.6, DECK_Y + 0.42, 0);
    lid.castShadow = true;
    this.group.add(coaming, lid);

    // two barrels (one is the map barrel, port; one starboard) — ~2.2× so they
    // read waist-high on the crew, not silo-sized
    for (const [x, z, map] of [[1.05, -1.86, true], [-1.2, 1.86, false]]) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.53, 1.1, 9), mat(COLORS.barrel));
      barrel.position.set(x, DECK_Y + 0.55, z);
      barrel.castShadow = barrel.receiveShadow = true;
      this.group.add(barrel);
      for (const hy of [0.26, 0.83]) {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 4, 10), mat(COLORS.hullDark));
        hoop.rotation.x = Math.PI / 2;
        hoop.position.set(x, DECK_Y + hy, z);
        this.group.add(hoop);
      }
      if (map) {
        const scroll = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.85, 6), mat(COLORS.paper));
        scroll.rotation.z = Math.PI / 2;
        scroll.position.set(x, DECK_Y + 1.2, z);
        scroll.castShadow = true;
        this.group.add(scroll);
      }
    }

    // coiled rope near the rope station
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.1, 5, 12), mat(COLORS.rope));
    coil.rotation.x = Math.PI / 2;
    coil.position.set(4.5, DECK_Y + 0.1, -1.5);
    coil.castShadow = coil.receiveShadow = true;
    this.group.add(coil);

    // portside cannon on a low carriage, muzzle outboard (-z)
    const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.4, 1.05), mat(COLORS.hullDark));
    carriage.position.set(2.85, DECK_Y + 0.2, -2.7);
    carriage.castShadow = true;
    const barrelG = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.27, 1.5, 8), mat(COLORS.cannon));
    barrelG.rotation.x = Math.PI / 2; // lie along z
    barrelG.position.set(2.85, DECK_Y + 0.55, -3.15);
    barrelG.castShadow = true;
    this.group.add(carriage, barrelG);
  }

  // ---- ship's bell on a small gallows beside the mainmast ----
  _buildBell() {
    const g = new THREE.Group();
    // upright post
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.5, 6), mat(COLORS.mast));
    post.position.y = 0.75;
    post.castShadow = true;
    // crossarm reaching toward the captain (+x)
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, 0.09), mat(COLORS.mast));
    arm.position.set(0.2, 1.45, 0);
    arm.castShadow = true;
    // brass bell hanging from the arm end
    const yoke = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 5), mat(COLORS.brass));
    yoke.position.set(0.4, 1.4, 0);
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.28, 8), mat(COLORS.brass));
    bell.position.set(0.4, 1.22, 0);
    bell.castShadow = true;
    g.add(post, arm, yoke, bell);
    g.position.set(-2.3, DECK_Y, 1.0);
    this.group.add(g);
    this.bell = g;
  }

  // ---- the plank: permanently mounted, protruding starboard (+z) ----
  _buildPlank() {
    // length ×3 (out over the water) but width/thickness only ~2× — a board,
    // not a wall, for the size-1 prisoner to totter along.
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.16, 4.5), mat(COLORS.deck));
    plank.position.set(1.2, DECK_Y - 0.04, 4.3); // inboard on deck → out over the water (tip ≈6.5)
    plank.castShadow = plank.receiveShadow = true;
    this.group.add(plank);
    // a couple of lashings where it crosses the rail
    const lash = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 4, 8), mat(COLORS.rope));
    lash.rotation.y = Math.PI / 2;
    lash.position.set(1.2, DECK_Y, 3.24);
    this.group.add(lash);
  }

  // ---- finer detail pass: seams, strakes, rails, ground clutter, fittings ----
  // All code-built primitives, palette colors only. castShadow only on the
  // chunky pieces — seams/strakes/trim skip it to spare the shadow map.
  _buildDetails() {
    // deck plank seams: ~14 thin caulk lines running fore-aft, flush on deck
    for (let i = 0; i < 14; i++) {
      const z = -2.9 + (i / 13) * 5.8;
      const seam = new THREE.Mesh(new THREE.BoxGeometry(13.0, 0.04, 0.05), mat(COLORS.hullDark));
      seam.position.set(-0.15, DECK_Y + 0.02, z);
      this.group.add(seam);
    }

    // hull strakes: two long thin hullDark bands down each side
    for (const zside of [-3.32, 3.32]) {
      for (const hy of [1.35, 2.4]) {
        const strake = new THREE.Mesh(new THREE.BoxGeometry(12.0, 0.16, 0.08), mat(COLORS.hullDark));
        strake.position.set(-1.5, hy, zside);
        this.group.add(strake);
      }
    }

    // gunwale cap rail capping each bulwark
    for (const zside of [-3.24, 3.24]) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(12.7, 0.14, 0.34), mat(COLORS.mast));
      cap.position.set(-0.3, DECK_Y + 0.68, zside);
      cap.castShadow = true;
      this.group.add(cap);
    }

    // cannonball pyramid stacks (positions mirrored in keepouts)
    for (const [x, z] of [[5.0, -2.6], [0.3, -2.6], [-4.2, -2.5], [5.6, 1.0]]) {
      this.group.add(ballStack(x, z));
    }

    // stocked anchor hanging at the port bow (-z), flat against the hull side
    const anc = new THREE.Group();
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.9, 6), mat(COLORS.hullDark));
    shank.position.y = 0.05;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 5, 10), mat(COLORS.brass));
    ring.position.y = 1.05; // torus lies in x-y plane → faces outboard
    const stock = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.85, 5), mat(COLORS.hullDark));
    stock.rotation.z = Math.PI / 2; // crossbar along x
    stock.position.y = 0.72;
    anc.add(shank, ring, stock);
    for (const dir of [-1, 1]) {
      anc.add(strut(0, -0.85, 0, dir * 0.42, -0.5, 0, 0.055, COLORS.hullDark, 5)); // fluke arm
      const fluke = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.32, 5), mat(COLORS.hullDark));
      fluke.position.set(dir * 0.48, -0.42, 0);
      fluke.rotation.z = dir * -Math.PI / 2.3; // point outward and up
      fluke.castShadow = true;
      anc.add(fluke);
    }
    anc.traverse((o) => (o.castShadow = true));
    anc.position.set(6.8, DECK_Y - 1.2, -3.25);
    this.group.add(anc);

    // rudder blade at the stern, hung below the waterline band
    const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.5, 1.3), mat(COLORS.hullDark));
    rudder.position.set(-9.15, -0.25, 0);
    rudder.castShadow = true;
    this.group.add(rudder);

    // thin brass trim band under the stern windows (carved-look accent)
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 4.6), mat(COLORS.brass));
    trim.position.set(-8.99, DECK_Y + 0.62, 0);
    this.group.add(trim);

    // a couple more coiled ropes at rest on the deck
    for (const [x, z] of [[5.2, 1.9], [-4.6, -2.4]]) {
      const c = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.09, 5, 12), mat(COLORS.rope));
      c.rotation.x = Math.PI / 2;
      c.position.set(x, DECK_Y + 0.09, z);
      c.castShadow = c.receiveShadow = true;
      this.group.add(c);
    }

    // a crate beside the hatch
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.8), mat(COLORS.barrel));
    crate.position.set(-0.6, DECK_Y + 0.35, 1.75);
    crate.castShadow = crate.receiveShadow = true;
    const crateTop = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.08, 0.84), mat(COLORS.hullDark));
    crateTop.position.set(-0.6, DECK_Y + 0.74, 1.75);
    crateTop.castShadow = true;
    this.group.add(crate, crateTop);
  }

  // ---- page scale: main.js calls this once after construction (v3) ----
  // Scales the whole group (children/figures inherit), and scales the buoyancy
  // sample offsets + draft so the enlarged/shrunk hull still floats correctly.
  setScale(s) {
    this.scale = s;
    this.group.scale.setScalar(s);
  }

  update(ws) {
    const t = ws.time;
    const amp = ws.reduced ? 0.5 : 1;

    // buoyancy: sample the shared wave field at the four hull corners (world).
    // The wider ±8.5 / ±3.0 base spans several swell wavelengths, so fore-aft
    // and port-starboard deltas stay small — a big brig turns lazily. Offsets
    // (and the slope divisors + draft) scale with the group so the scaled hull
    // samples its true corners and floats at the same relative depth.
    const s = this.scale;
    const dxFA = 8.5 * s, dzPS = 3.0 * s;
    const gx = this.group.position.x, gz = this.group.position.z;
    const hFS = waveHeight(gx + dxFA, gz + dzPS, t); // fore-starboard
    const hFP = waveHeight(gx + dxFA, gz - dzPS, t); // fore-port
    const hAS = waveHeight(gx - dxFA, gz + dzPS, t); // aft-starboard
    const hAP = waveHeight(gx - dxFA, gz - dzPS, t); // aft-port
    const mean = (hFS + hFP + hAS + hAP) * 0.25;
    const hFwd = (hFS + hFP) * 0.5, hAft = (hAS + hAP) * 0.5;
    const hStar = (hFS + hAS) * 0.5, hPort = (hFP + hAP) * 0.5;

    // pitch about +z (bow up when fore is higher); roll about +x (starboard up
    // needs a negative x-rotation). Divisors are the full sample spans (17 & 6,
    // scaled) so these read as sea-surface slopes; damped toward target (0.06).
    const targetZ = ((hFwd - hAft) / (17.0 * s)) * amp;
    const targetX = (-(hStar - hPort) / (6.0 * s)) * 0.85 * amp;
    this._rotZ += (targetZ - this._rotZ) * 0.06;
    this._rotX += (targetX - this._rotX) * 0.06;

    this.group.position.y = mean + BOB_OFFSET * s;
    this.group.rotation.z = this._rotZ;
    this.group.rotation.x = this._rotX;
    this.group.rotation.y = Math.sin(t * 0.05) * 0.024 * amp; // slow heading drift (~40% calmer)

    // sail billow (CPU vertex offset along each plane's local normal / z);
    // amplitude reduced ~60% from 0.18 so the canvas breathes without slapping
    const sAmp = 0.072 * amp;
    for (const s of this.sails) {
      const pos = s.mesh.geometry.attributes.position;
      const base = s.base;
      for (let i = 0; i < pos.count; i++) {
        const bx = base[i * 3], by = base[i * 3 + 1];
        const w = Math.sin(bx * 0.9 + t * 1.4 + s.phase) * sAmp + Math.sin(by * 0.9 - t * 0.9 + s.phase) * sAmp * 0.5;
        pos.setZ(i, base[i * 3 + 2] + w);
      }
      pos.needsUpdate = true;
    }

    // flag: a livelier ripple, stronger toward the free (outer) edge
    if (this.flag) {
      const pos = this.flag.mesh.geometry.attributes.position;
      const base = this.flag.base;
      for (let i = 0; i < pos.count; i++) {
        const bx = base[i * 3]; // -1.1..1.1 (mast edge → free edge)
        const edge = (bx + 1.1) / 2.2; // 0 at mast, 1 at fly
        const w = Math.sin(bx * 2.2 + t * 3.5) * 0.26 * edge * amp;
        pos.setZ(i, base[i * 3 + 2] + w);
      }
      pos.needsUpdate = true;
    }

    // night glow: windows + lantern emissive, and the stern point light
    const e = ws.lighting.lampIntensity * 1.6;
    for (const m of this.glowMats) m.emissiveIntensity = e;
    // physical light units: point lights need far more than emissive scale
    if (this.lantern) this.lantern.intensity = e * 16; // physical units + 3x distances
  }
}
