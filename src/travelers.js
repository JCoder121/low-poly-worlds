// Travelers walk the path below the clearing. Near the middle they offer
// a doorway — a speech bubble with one world-history link.
import * as THREE from "three";
import { COLORS, mat } from "./world.js";
import { makeLinkDeck } from "./links.js";

const ROBES = [0x7a6a8f, 0x5f7d6e, 0x8f6a5a, 0x4e5d78, 0x86755b];

function strawHat() {
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.09, 7), mat(0xd9c07f));
  hat.position.y = 0.1;
  return hat;
}

function buildTraveler(kind) {
  const g = new THREE.Group();
  const robeColor = ROBES[Math.floor(Math.random() * ROBES.length)];

  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 0.52, 6), mat(robeColor));
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
    const sword = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.5, 5), mat(0x1c2333));
    sword.position.set(-0.12, 0.34, 0);
    sword.rotation.z = 1.25;
    g.add(sword);
  }
  return g;
}

const KINDS = ["monk", "farmer", "merchant", "ronin"];

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
    const kind = KINDS[Math.floor(Math.random() * KINDS.length)];
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
    this._v.y += 0.95;
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
    tr.mesh.position.set(p.x, p.y + Math.abs(Math.sin(t * 7)) * 0.03, p.z);
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
