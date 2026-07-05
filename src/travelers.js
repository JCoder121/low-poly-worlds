// Travelers walk the path below the clearing. Near the middle they offer
// a doorway — a speech bubble with one world-history link.
import * as THREE from "three";
import { COLORS, mat } from "./world.js";
import { makeLinkDeck } from "./links.js";

const ROBES = [0x7a6a8f, 0x5f7d6e, 0x8f6a5a, 0x4e5d78, 0x86755b];

function strawHat(radius = 0.19, height = 0.09) {
  const hat = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 8), mat(0xd9c07f));
  hat.position.y = 0.1;
  hat.castShadow = true;
  return hat;
}

// a sword/scabbard worn at the hip, angled across the body
function hipSword(color = 0x1c2333, len = 0.5) {
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, len, 5), mat(color));
  s.castShadow = true;
  return s;
}

// A small white fox spirit: a Ghibli aside padding the same road. Built at its
// own animal scale (never the humanoid 1.3×), low to the ground and trotting.
function buildFox() {
  const g = new THREE.Group();
  const white = mat(0xfdfaf2);

  // body: a low cone lying along +z (local forward), tapering to the snout
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.46, 6), white);
  body.rotation.x = -Math.PI / 2; // apex points forward
  body.position.set(0, 0.19, 0.04);
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), white);
  head.position.set(0, 0.24, 0.24);
  head.castShadow = true;
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 5), white);
  snout.rotation.x = -Math.PI / 2;
  snout.position.set(0, 0.22, 0.34);
  g.add(body, head, snout);

  // pointed ears
  for (const sx of [-0.05, 0.05]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 4), white);
    ear.position.set(sx, 0.33, 0.22);
    g.add(ear);
  }
  // four short legs
  const legGeo = new THREE.CylinderGeometry(0.017, 0.017, 0.16, 4);
  for (const [lx, lz] of [[-0.06, 0.16], [0.06, 0.16], [-0.06, -0.08], [0.06, -0.08]]) {
    const leg = new THREE.Mesh(legGeo, white);
    leg.position.set(lx, 0.08, lz);
    g.add(leg);
  }
  // two tails sweeping up and back, each with an ember-lit tip
  for (const yaw of [-0.28, 0.28]) {
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.34, 5), white);
    tail.position.set(Math.sin(yaw) * 0.08, 0.28, -0.22);
    tail.rotation.set(-0.7, yaw, 0); // sweeps back and up
    tail.castShadow = true;
    const tip = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), mat(COLORS.ember));
    tip.position.set(Math.sin(yaw) * 0.14, 0.42, -0.36);
    g.add(tail, tip);
  }
  return g;
}

function buildTraveler(kind) {
  if (kind === "fox") return buildFox();

  const g = new THREE.Group();
  const robe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.22, 0.52, 6),
    mat(ROBES[Math.floor(Math.random() * ROBES.length)])
  );
  robe.position.y = 0.26;
  robe.castShadow = true;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), mat(COLORS.skin));
  head.position.y = 0.62;
  head.castShadow = true;
  g.add(robe, head);

  if (kind === "monk") {
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.85, 5), mat(COLORS.trunk));
    staff.position.set(0.16, 0.42, 0.05);
    g.add(staff);
  } else if (kind === "farmer") {
    const hat = strawHat();
    hat.position.y = 0.72;
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.16, 6), mat(0xb59a5e));
    basket.position.set(0, 0.5, -0.17);
    g.add(hat, basket);
  } else if (kind === "merchant") {
    const hat = strawHat();
    hat.position.y = 0.72;
    g.add(hat);
    const cart = new THREE.Group();
    const bed = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.26), mat(COLORS.trunk));
    bed.position.y = 0.18;
    bed.castShadow = true;
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.16), mat(0xb59a5e));
    cargo.position.y = 0.29;
    const wheelGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.03, 8);
    for (const side of [-0.15, 0.15]) {
      const w = new THREE.Mesh(wheelGeo, mat(0x4a3b2c));
      w.rotation.z = Math.PI / 2;
      w.position.set(side, 0.09, 0);
      cart.add(w);
    }
    cart.add(bed, cargo);
    cart.position.set(0, 0, -0.42); // pulled behind
    g.add(cart);
    g.userData.cart = cart;
  } else if (kind === "ronin") {
    robe.material = mat(0x32384a);
    const sword = hipSword();
    sword.position.set(-0.12, 0.34, 0);
    sword.rotation.z = 1.25;
    g.add(sword);
  } else if (kind === "pilgrim") {
    const hat = strawHat(0.26, 0.12); // oversized sedge hat
    hat.position.y = 0.74;
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 5), mat(COLORS.trunk));
    staff.position.set(0.17, 0.44, 0.07);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.12), mat(0x8a6a4a));
    pack.position.set(0, 0.44, -0.18);
    pack.castShadow = true;
    g.add(hat, staff, pack);
  } else if (kind === "fisherman") {
    const hat = strawHat();
    hat.position.y = 0.72;
    // bamboo pole slung over the shoulder at a slight angle
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.98, 5), mat(0x8a9a5b));
    pole.position.set(0.06, 0.6, -0.02);
    pole.rotation.set(0.25, 0, -0.5);
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.14, 6), mat(0xb59a5e));
    basket.position.set(0.15, 0.4, -0.12);
    basket.castShadow = true;
    g.add(hat, pole, basket);
  } else if (kind === "noblewoman") {
    robe.material = mat(0x6a4a6e); // deep plum
    // a parasol held up on a thin stick
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.55, 5), mat(COLORS.trunk));
    stick.position.set(0.22, 0.56, 0.04);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.12, 10), mat(COLORS.sakura));
    canopy.position.set(0.22, 0.86, 0.04);
    canopy.castShadow = true;
    g.add(stick, canopy);
  } else if (kind === "samurai") {
    robe.material = mat(0x2a2f38); // dark armor
    // layered shoulder plates
    for (const sx of [-0.16, 0.16]) {
      const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.18), mat(0x1c2333));
      pauldron.position.set(sx, 0.5, 0);
      pauldron.castShadow = true;
      g.add(pauldron);
    }
    // a low kabuto helmet
    const kabuto = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2.4),
      mat(0x1c2333)
    );
    kabuto.position.y = 0.66;
    kabuto.castShadow = true;
    g.add(kabuto);
    // the daishō — two swords worn at the hip
    const katana = hipSword(0x1c2333, 0.52);
    katana.position.set(-0.13, 0.34, -0.02);
    katana.rotation.z = 1.2;
    const wakizashi = hipSword(0x1c2333, 0.34);
    wakizashi.position.set(-0.11, 0.4, 0.05);
    wakizashi.rotation.z = 1.3;
    g.add(katana, wakizashi);
  } else if (kind === "shogun") {
    robe.material = mat(0x2b303c);
    const gold = mat(0xc9a84c);
    // gold sash across the robe
    const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.07, 6), gold);
    sash.position.y = 0.34;
    g.add(sash);
    // horned kabuto: dark helmet with a gold crescent crest
    const kabuto = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2.4),
      mat(0x1c2333)
    );
    kabuto.position.y = 0.66;
    kabuto.castShadow = true;
    const crest = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.014, 6, 14, Math.PI), gold);
    crest.position.set(0, 0.72, 0.08); // crescent opening down, horns up
    g.add(kabuto, crest);
    // sashimono: a banner pole rising from the back
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 5), mat(COLORS.trunk));
    pole.position.set(-0.02, 0.62, -0.2);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.28), mat(COLORS.vermillion, { side: THREE.DoubleSide }));
    banner.position.set(0.09, 0.86, -0.2);
    g.add(pole, banner);
    // one sword at the hip
    const katana = hipSword(0x1c2333, 0.52);
    katana.position.set(-0.13, 0.34, -0.02);
    katana.rotation.z = 1.2;
    g.add(katana);
  }

  g.scale.setScalar(1.3); // sized to stand alongside Musashi
  return g;
}

// Weighted cast: rarer figures (samurai, shogun, fox) surface only occasionally.
// Weights sum to 100 — tune a single number to shift how often a kind appears.
const KINDS = [
  ["monk", 16], ["farmer", 16], ["merchant", 14], ["ronin", 14],
  ["pilgrim", 12], ["fisherman", 10], ["noblewoman", 8],
  ["fox", 5], ["samurai", 4], ["shogun", 1],
];

function pickKind() {
  let r = Math.random() * 100;
  for (const [kind, w] of KINDS) if ((r -= w) < 0) return kind;
  return KINDS[0][0];
}

export class Travelers {
  constructor(parent, curve, camera) {
    this.parent = parent;
    this.curve = curve;
    this.camera = camera;
    this.drawLink = makeLinkDeck();
    this.bubbleLayer = document.getElementById("bubbles");
    this.active = null;
    this.nextSpawnAt = 7 + Math.random() * 5; // first visitor comes early
    this.elapsed = 0;
    this._v = new THREE.Vector3();

    // Catmull-Rom hands each segment an equal param range regardless of its
    // physical length, so walking in param units races through the expanse
    // road's long end segments. Cache the arc length and step in world units.
    this.curveLength = curve.getLength();
    // Spawn just inside the fog: scan for where |x| first drops below 13 from
    // each end. Island's curve never reaches |x|=13, so it stays 0..1.
    this.uStart = 0;
    this.uEnd = 1;
    const SAMPLES = 200;
    for (let i = 0; i <= SAMPLES; i++) {
      if (Math.abs(curve.getPointAt(i / SAMPLES).x) < 13) { this.uStart = i / SAMPLES; break; }
    }
    for (let i = SAMPLES; i >= 0; i--) {
      if (Math.abs(curve.getPointAt(i / SAMPLES).x) < 13) { this.uEnd = i / SAMPLES; break; }
    }
    this.uStart = THREE.MathUtils.clamp(this.uStart, 0, 1);
    this.uEnd = THREE.MathUtils.clamp(this.uEnd, 0, 1);
  }

  spawn() {
    const kind = pickKind();
    const mesh = buildTraveler(kind);
    const reverse = Math.random() < 0.5;
    this.parent.add(mesh);
    this.active = {
      kind,
      mesh,
      u: reverse ? this.uEnd : this.uStart,
      dir: reverse ? -1 : 1,
      speed: 0.36 + Math.random() * 0.08, // world-units per second
      spoke: false,
      paused: false,
      bubble: null,
      bubbleTimer: 0,
      bubbleY: kind === "fox" ? 0.6 : 1.25, // anchor above the head; the fox sits lower
    };
  }

  makeBubble(traveler) {
    const link = this.drawLink();
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    const a = document.createElement("a");
    a.href = link.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = link.label;
    bubble.appendChild(a);
    bubble.addEventListener("mouseenter", () => (traveler.paused = true));
    bubble.addEventListener("mouseleave", () => {
      traveler.paused = false;
      traveler.bubbleTimer = Math.max(traveler.bubbleTimer, 10); // linger a bit after hover
    });
    a.addEventListener("focus", () => (traveler.paused = true));
    a.addEventListener("blur", () => (traveler.paused = false));
    this.bubbleLayer.appendChild(bubble);
    traveler.bubble = bubble;
    traveler.bubbleTimer = 14;
  }

  positionBubble(traveler) {
    if (!traveler.bubble) return;
    this._v.copy(traveler.mesh.position);
    this._v.y += traveler.bubbleY;
    this._v.project(this.camera);
    const x = (this._v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-this._v.y * 0.5 + 0.5) * window.innerHeight;
    traveler.bubble.style.left = `${x}px`;
    traveler.bubble.style.top = `${y}px`;
  }

  dismissBubble(traveler) {
    const b = traveler.bubble;
    if (!b) return;
    traveler.bubble = null;
    b.classList.add("leaving");
    setTimeout(() => b.remove(), 750);
  }

  update(dt, t) {
    this.elapsed += dt;

    if (!this.active && this.elapsed >= this.nextSpawnAt) this.spawn();
    if (!this.active) return;

    const tr = this.active;

    // step in world units so speed is uniform along the whole arc
    if (!tr.paused) tr.u += tr.dir * (tr.speed / this.curveLength) * dt;

    // walk pose: position on curve, face along it, bob
    const clamped = THREE.MathUtils.clamp(tr.u, this.uStart, this.uEnd);
    const p = this.curve.getPointAt(clamped);
    const tangent = this.curve.getTangentAt(clamped);
    // rise over the bridge's arch (crown ~0.17) instead of clipping through it
    const bd = Math.hypot(p.x - (-4.2), p.z - 2.6);
    const lift = bd < 0.85 ? Math.cos((bd / 0.85) * Math.PI / 2) * 0.17 : 0;
    tr.mesh.position.set(p.x, p.y + Math.abs(Math.sin(t * 7)) * 0.03 + lift, p.z);
    tr.mesh.rotation.y = Math.atan2(tangent.x * tr.dir, tangent.z * tr.dir);
    tr.mesh.rotation.z = Math.sin(t * 7) * 0.04;
    if (tr.mesh.userData.cart) {
      tr.mesh.userData.cart.rotation.x = Math.sin(t * 9) * 0.02;
    }

    // speak once, near the clearing (mode-independent: keyed off world x)
    if (!tr.spoke && Math.abs(p.x) < 1.6) {
      tr.spoke = true;
      this.makeBubble(tr);
    }

    if (tr.bubble) {
      this.positionBubble(tr);
      if (!tr.paused) {
        tr.bubbleTimer -= dt;
        if (tr.bubbleTimer <= 0) {
          this.dismissBubble(tr);
        }
      }
    }

    // departed
    if (tr.u < this.uStart - 0.02 || tr.u > this.uEnd + 0.02) {
      this.dismissBubble(tr);
      this.parent.remove(tr.mesh);
      tr.mesh.traverse((o) => {
        if (o.isMesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      this.active = null;
      this.nextSpawnAt = this.elapsed + 20 + Math.random() * 25;
    }
  }
}
