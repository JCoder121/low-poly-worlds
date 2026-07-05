// markers.js — the two clickable diorama pins. Each is a small low-poly map
// pin (cone + faceted head) with a pulsing base ring; musashi's sits fixed on
// the "Japan" archipelago, sparrow's wake's drifts back and forth across an
// open-water lane (it's a ship, not a place). Hover shows a DOM label
// (matching the mono small-caps UI grammar); click navigates to the diorama,
// landing in expanse mode by default.
import * as THREE from "three";
import { mat, unlit } from "./palette.js";

const RING_GEO = new THREE.RingGeometry(0.22, 0.3, 20);

function buildPin(color) {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), mat(color));
  head.position.y = 0.62;
  head.castShadow = true;
  const neck = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 6), mat(color));
  neck.position.y = 0.25;
  neck.castShadow = true;
  const ring = new THREE.Mesh(RING_GEO, unlit(color, { transparent: true, opacity: 0.5, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  g.add(head, neck, ring);
  g.userData.ring = ring;
  g.userData.head = head;
  return g;
}

export function buildMarkers(scene) {
  const markers = [];

  const musashi = buildPin(0xf2b8c6);
  musashi.position.set(15.5, 0.4, -1.5);
  musashi.userData.baseY = 0.4;
  scene.add(musashi);
  markers.push({
    group: musashi,
    label: "musashi's hill ↗",
    href: "musashi-homepage/",
    phase: 0,
    drift: null,
  });

  const sparrows = buildPin(0x241c14);
  sparrows.position.set(-6, 0, 3);
  scene.add(sparrows);
  markers.push({
    group: sparrows,
    label: "sparrow's wake ↗",
    href: "sparrows-wake/",
    phase: 1.7,
    // slow back-and-forth across an open-water lane, since the brig has no
    // fixed home port
    drift: { from: [-6, 3], to: [5.5, 6.5], period: 46 },
  });

  return markers;
}

export function updateMarkers(markers, t) {
  for (const m of markers) {
    const bob = Math.sin(t * 1.1 + m.phase) * 0.06;
    if (m.drift) {
      const { from, to, period } = m.drift;
      // ease back and forth (0..1..0) rather than snapping at the ends
      const u = (Math.sin((t / period) * Math.PI * 2) + 1) / 2;
      m.group.position.x = from[0] + (to[0] - from[0]) * u;
      m.group.position.z = from[1] + (to[1] - from[1]) * u;
    }
    m.group.position.y = (m.drift ? 0 : m.group.userData.baseY) + bob;
    m.group.rotation.y = t * 0.4 + m.phase;
    const ringScale = 1 + Math.sin(t * 1.1 + m.phase) * 0.12;
    m.group.userData.ring.scale.set(ringScale, ringScale, ringScale);
  }
}
