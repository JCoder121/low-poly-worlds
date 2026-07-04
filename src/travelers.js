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
  constructor(parent, curve, camera, statusFn) {
    this.parent = parent;
    this.curve = curve;
    this.camera = camera;
    this.statusFn = statusFn; // (text|null) → narrate arrivals
    this.drawLink = makeLinkDeck();
    this.bubbleLayer = document.getElementById("bubbles");
    this.active = null;
    this.nextSpawnAt = 7 + Math.random() * 5; // first visitor comes early
    this.elapsed = 0;
    this._v = new THREE.Vector3();
  }

  spawn() {
    const kind = KINDS[Math.floor(Math.random() * KINDS.length)];
    const mesh = buildTraveler(kind);
    const reverse = Math.random() < 0.5;
    this.parent.add(mesh);
    this.active = {
      kind,
      mesh,
      u: reverse ? 1 : 0,
      dir: reverse ? -1 : 1,
      speed: 0.022 + Math.random() * 0.006, // curve-param units per second
      spoke: false,
      paused: false,
      bubble: null,
      bubbleTimer: 0,
    };
    this.statusFn(`a ${kind} approaches on the road`);
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
      traveler.bubbleTimer = Math.max(traveler.bubbleTimer, 6); // linger a bit after hover
    });
    a.addEventListener("focus", () => (traveler.paused = true));
    a.addEventListener("blur", () => (traveler.paused = false));
    this.bubbleLayer.appendChild(bubble);
    traveler.bubble = bubble;
    traveler.bubbleTimer = 8;
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
    setTimeout(() => b.remove(), 400);
  }

  update(dt, t) {
    this.elapsed += dt;

    if (!this.active && this.elapsed >= this.nextSpawnAt) this.spawn();
    if (!this.active) return;

    const tr = this.active;

    if (!tr.paused) tr.u += tr.dir * tr.speed * dt;

    // walk pose: position on curve, face along it, bob
    const clamped = THREE.MathUtils.clamp(tr.u, 0, 1);
    const p = this.curve.getPoint(clamped);
    const tangent = this.curve.getTangent(clamped);
    tr.mesh.position.set(p.x, p.y + Math.abs(Math.sin(t * 7)) * 0.03, p.z);
    tr.mesh.rotation.y = Math.atan2(tangent.x * tr.dir, tangent.z * tr.dir);
    tr.mesh.rotation.z = Math.sin(t * 7) * 0.04;
    if (tr.mesh.userData.cart) {
      tr.mesh.userData.cart.rotation.x = Math.sin(t * 9) * 0.02;
    }

    // speak once, near the middle of the road
    if (!tr.spoke && clamped > 0.42 && clamped < 0.62) {
      tr.spoke = true;
      this.makeBubble(tr);
      this.statusFn(`the ${tr.kind} knows a story`);
    }

    if (tr.bubble) {
      this.positionBubble(tr);
      if (!tr.paused) {
        tr.bubbleTimer -= dt;
        if (tr.bubbleTimer <= 0) {
          this.dismissBubble(tr);
          this.statusFn(null); // hand the status line back to musashi
        }
      }
    }

    // departed
    if (tr.u < -0.02 || tr.u > 1.02) {
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
      this.statusFn(null);
    }
  }
}
