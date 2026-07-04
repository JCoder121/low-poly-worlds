// Musashi: a small flat-shaded figure who cycles through his day —
// zazen by the fire, reading, painting, sword kata.
import * as THREE from "three";
import { COLORS, mat } from "./world.js";

const KIMONO = 0x3a4a73; // lifted ink navy — dark enough to read as ink, light enough to keep its shape in shadow
const KIMONO_DARK = 0x1c2333;

function limb(radius, length, color) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.85, length, 5), mat(color));
  m.position.y = -length / 2;
  m.castShadow = true;
  const hand = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 1.15, 0), mat(COLORS.skin));
  hand.position.y = -length;
  hand.castShadow = true;
  g.add(m, hand);
  return g;
}

function katana(length = 0.62) {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.018, length, 0.045), mat(0xcfd2d6));
  blade.position.y = length / 2 + 0.09;
  const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.015, 6), mat(KIMONO_DARK));
  guard.position.y = 0.09;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.18, 5), mat(0x4a3b2c));
  blade.castShadow = true;
  g.add(blade, guard, grip);
  return g;
}

function scabbard(length) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.024, length, 5), mat(KIMONO_DARK));
  m.castShadow = true;
  return m;
}

export class Musashi {
  constructor(parent, spots) {
    this.spots = spots; // { fire, tree, easel, kata } — each { position, facing }
    this.root = new THREE.Group();

    // body: kimono skirt + chest + head, all pivoting around this.body
    this.body = new THREE.Group();

    this.skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.31, 0.6, 6), mat(KIMONO));
    this.skirt.position.y = 0.3;
    this.skirt.castShadow = true;

    this.chest = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.34, 6), mat(KIMONO));
    this.chest.position.y = 0.72;
    this.chest.castShadow = true;

    this.sash = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.19, 0.08, 6), mat(COLORS.vermillion));
    this.sash.position.y = 0.57;

    this.headGroup = new THREE.Group();
    this.headGroup.position.y = 0.94;
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.145, 1), mat(COLORS.skin));
    head.castShadow = true;
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2.6),
      mat(KIMONO_DARK)
    );
    hair.position.y = 0.02;
    const topknot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.1, 5), mat(KIMONO_DARK));
    topknot.position.set(0, 0.17, -0.04);
    topknot.rotation.x = -0.5;
    this.headGroup.add(head, hair, topknot);

    this.armL = limb(0.045, 0.36, KIMONO);
    this.armL.position.set(-0.17, 0.86, 0);
    this.armR = limb(0.045, 0.36, KIMONO);
    this.armR.position.set(0.17, 0.86, 0);

    // the two swords worn at the left hip
    this.wornKatana = scabbard(0.52);
    this.wornKatana.position.set(-0.12, 0.5, -0.04);
    this.wornKatana.rotation.z = 1.3;
    this.wornKatana.rotation.y = -0.7; // tucked, running hip to back
    this.wornWakizashi = scabbard(0.34);
    this.wornWakizashi.position.set(-0.11, 0.58, 0.03);
    this.wornWakizashi.rotation.z = 1.35;
    this.wornWakizashi.rotation.y = -0.6;

    // the drawn katana, parented to the right hand; hidden unless doing kata
    this.heldKatana = katana();
    this.heldKatana.position.y = -0.36;
    this.heldKatana.visible = false;
    this.armR.add(this.heldKatana);

    this.body.add(
      this.skirt, this.chest, this.sash, this.headGroup,
      this.armL, this.armR, this.wornKatana, this.wornWakizashi
    );
    this.root.add(this.body);

    // ---- props (each lives at its spot; visibility toggled by activity) ----

    this.scroll = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.015, 0.14), mat(0xfdfaf2));
    this.scroll.visible = false;
    this.root.add(this.scroll);

    this.easel = new THREE.Group();
    const table = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.38), mat(COLORS.trunk));
    table.position.y = 0.16;
    table.castShadow = true;
    for (const [lx, lz] of [[-0.24, -0.15], [0.24, -0.15], [-0.24, 0.15], [0.24, 0.15]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.05), mat(COLORS.trunk));
      leg.position.set(lx, 0.08, lz);
      this.easel.add(leg);
    }
    const canvas = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.01, 0.28), mat(0xfdfaf2));
    canvas.position.y = 0.2;
    this.easel.add(table, canvas);
    // ink strokes appear one by one during a painting session
    this.strokes = [];
    const strokeMat = () =>
      new THREE.MeshBasicMaterial({ color: KIMONO_DARK, transparent: true, opacity: 0 });
    const strokeShapes = [
      [0.16, 0.02, -0.06, -0.02, 0.4],   // w, h, x, z, rot
      [0.1, 0.018, 0.08, 0.03, -0.3],
      [0.05, 0.05, -0.1, 0.06, 0],
      [0.14, 0.016, 0.02, 0.08, 0.15],
      [0.03, 0.03, 0.12, -0.05, 0],
    ];
    for (const [w, h, x, z, rot] of strokeShapes) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), strokeMat());
      s.rotation.x = -Math.PI / 2;
      s.rotation.z = rot;
      s.position.set(x, 0.212, z);
      this.strokes.push(s);
      this.easel.add(s);
    }
    this.easel.visible = false;
    this.root.add(this.easel);

    parent.add(this.root);

    // collect materials for fade transitions
    this.fadeMats = [];
    this.body.traverse((o) => {
      if (o.isMesh) {
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          m.transparent = true;
          this.fadeMats.push(m);
        }
      }
    });

    this.activities = ["zazen", "kata", "reading", "painting"];
    this.index = 0;
    this.activityTime = 0;
    this.activityDuration = 75; // seconds per activity
    this.phase = "settled"; // settled | fadeOut | fadeIn
    this.fade = 1;
    this.applyActivity(this.activities[0]);
  }

  get activity() {
    return this.activities[this.index];
  }

  // hard-set the figure into an activity's base pose and location
  applyActivity(name) {
    const spot = this.spots[name === "zazen" ? "fire" : name === "reading" ? "tree" : name === "painting" ? "easel" : "kata"];
    this.root.position.copy(spot.position);
    this.root.rotation.y = spot.facing;

    this.scroll.visible = name === "reading";
    this.easel.visible = name === "painting";
    this.heldKatana.visible = name === "kata";

    const seated = name !== "kata";
    this.body.position.y = seated ? -0.24 : 0;
    this.skirt.scale.set(seated ? 1.25 : 1, seated ? 0.75 : 1, seated ? 1.25 : 1);

    // neutral joints; per-frame animation layers on top of these
    this.armL.rotation.set(0, 0, 0.12);
    this.armR.rotation.set(0, 0, -0.12);
    this.headGroup.rotation.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);

    if (name === "zazen") {
      this.armL.rotation.set(0.55, 0, 0.5);
      this.armR.rotation.set(0.55, 0, -0.5);
      this.headGroup.rotation.x = 0.14;
    } else if (name === "reading") {
      this.armL.rotation.set(0.9, 0, 0.25);
      this.armR.rotation.set(0.9, 0, -0.25);
      this.headGroup.rotation.x = 0.42;
      // scroll and easel are children of root, so they take local coordinates
      this.scroll.position.set(0, 0.52, 0.32);
      this.scroll.rotation.set(0, 0, 0);
    } else if (name === "painting") {
      this.armL.rotation.set(0.35, 0, 0.2);
      this.armR.rotation.set(1.15, 0, -0.15);
      this.headGroup.rotation.x = 0.38;
      for (const s of this.strokes) s.material.opacity = 0;
      this.easel.position.set(0, 0, 0.55);
      this.easel.rotation.set(0, 0, 0);
    } else if (name === "kata") {
      this.armL.rotation.set(1.15, 0, 0.35);
      this.armR.rotation.set(1.15, 0, -0.35);
    }
  }

  update(dt, t) {
    this.activityTime += dt;

    // ---- activity switching with a fade ----
    if (this.phase === "settled" && this.activityTime > this.activityDuration) {
      this.phase = "fadeOut";
    }
    if (this.phase === "fadeOut") {
      this.fade = Math.max(0, this.fade - dt * 2.2);
      if (this.fade === 0) {
        this.index = (this.index + 1) % this.activities.length;
        this.applyActivity(this.activity);
        this.activityTime = 0;
        this.phase = "fadeIn";
        if (this.onActivityChange) this.onActivityChange(this.activity);
      }
    } else if (this.phase === "fadeIn") {
      this.fade = Math.min(1, this.fade + dt * 1.8);
      if (this.fade === 1) this.phase = "settled";
    }
    for (const m of this.fadeMats) m.opacity = this.fade;
    this.scroll.material.opacity = this.fade;

    // ---- per-activity idle motion ----
    const breathe = Math.sin(t * 1.4) * 0.015;
    this.chest.scale.setScalar(1 + breathe);

    const a = this.activity;
    if (a === "zazen") {
      this.body.rotation.x = 0.02 + Math.sin(t * 0.7) * 0.012; // slow sway
    } else if (a === "reading") {
      this.headGroup.rotation.y = Math.sin(t * 0.25) * 0.12; // eyes track the scroll
    } else if (a === "painting") {
      // the brush hand works in small circles; strokes appear over the session
      this.armR.rotation.x = 1.15 + Math.sin(t * 2.1) * 0.1;
      this.armR.rotation.z = -0.15 + Math.cos(t * 2.1) * 0.08;
      const progress = this.activityTime / this.activityDuration;
      this.strokes.forEach((s, i) => {
        const appearAt = (i + 1) / (this.strokes.length + 1);
        if (progress > appearAt) {
          s.material.opacity = Math.min(0.85, s.material.opacity + dt * 0.5) * this.fade;
        }
      });
    } else if (a === "kata") {
      // an endless slow cut: raise (2.4s) — pause — cut (0.4s) — hold (1.6s)
      const cycle = 6.0;
      const k = (this.activityTime % cycle) / cycle;
      let lift; // 0 = guard, 1 = overhead
      if (k < 0.4) lift = easeInOut(k / 0.4); // raise
      else if (k < 0.5) lift = 1; // poised
      else if (k < 0.57) lift = 1 - easeIn((k - 0.5) / 0.07); // the cut
      else lift = 0; // held low, breathing
      const armX = 1.15 + lift * -2.05; // from forward guard to overhead
      this.armL.rotation.x = armX;
      this.armR.rotation.x = armX;
      this.body.rotation.x = lift * -0.06 + (lift === 0 ? Math.sin(t * 1.4) * 0.008 : 0);
      this.headGroup.rotation.x = lift * 0.15;
    }
  }
}

function easeInOut(x) {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}
function easeIn(x) {
  return x * x;
}
