// Shared low-poly person builder — captain, crew, prisoner, paddler all come
// from here so the cast reads as one species. Chunky boxes, musashi-style.
import * as THREE from "three";
import { COLORS, mat } from "./palette.js";

// opts: { skin, shirt, pants, boots, hat: 'tricorn'|'bandana'|'none',
//         hatColor, bandanaColor, coat (color|null), scale }
// Returns { group, head, body, armL, armR, legL, legR, hat }
// Pivots: legs/arms pivot at hip/shoulder (rotate .rotation.x to swing).
// group origin is at the FEET; total height ≈ 1.0 * scale.
export function makeFigure(opts = {}) {
  const s = opts.scale ?? 1;
  const skin = opts.skin ?? COLORS.skin;
  const group = new THREE.Group();

  const legH = 0.34, bodyH = 0.34, headS = 0.20;

  const mkLimb = (w, h, d, color, x, y) => {
    const pivot = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.y = -h / 2;
    m.castShadow = true;
    pivot.add(m);
    pivot.position.set(x, y, 0);
    return pivot;
  };

  const legL = mkLimb(0.11, legH, 0.13, opts.pants ?? COLORS.crewPants, -0.08, legH);
  const legR = mkLimb(0.11, legH, 0.13, opts.pants ?? COLORS.crewPants, 0.08, legH);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, bodyH, 0.2),
    mat(opts.shirt ?? COLORS.crewShirt)
  );
  body.position.y = legH + bodyH / 2;
  body.castShadow = true;

  let coat = null;
  if (opts.coat) {
    coat = new THREE.Mesh(new THREE.BoxGeometry(0.36, bodyH + 0.1, 0.24), mat(opts.coat));
    coat.position.y = legH + bodyH / 2 - 0.05;
    coat.castShadow = true;
  }

  const shoulderY = legH + bodyH - 0.03;
  const armL = mkLimb(0.09, 0.3, 0.11, opts.shirt ?? COLORS.crewShirt, -0.2, shoulderY);
  const armR = mkLimb(0.09, 0.3, 0.11, opts.shirt ?? COLORS.crewShirt, 0.2, shoulderY);

  const head = new THREE.Mesh(new THREE.BoxGeometry(headS, headS, headS), mat(skin));
  head.position.y = legH + bodyH + headS / 2 + 0.02;
  head.castShadow = true;

  let hat = null;
  if (opts.hat === "tricorn") {
    hat = new THREE.Group();
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.17, 0.03, 6),
      mat(opts.hatColor ?? COLORS.captainHat)
    );
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.11, 0.1, 6),
      mat(opts.hatColor ?? COLORS.captainHat)
    );
    crown.position.y = 0.06;
    hat.add(brim, crown);
    hat.position.y = head.position.y + headS / 2 + 0.01;
  } else if (opts.hat === "bandana") {
    hat = new THREE.Mesh(
      new THREE.BoxGeometry(headS + 0.03, 0.08, headS + 0.03),
      mat(opts.bandanaColor ?? COLORS.crimson)
    );
    hat.position.y = head.position.y + headS / 2;
  }

  group.add(legL, legR, body, head);
  if (coat) group.add(coat);
  if (hat) group.add(hat);
  group.add(armL, armR);
  group.scale.setScalar(s);
  return { group, head, body, armL, armR, legL, legR, hat };
}

// Idle breath — call every frame with world time (+ optional phase offset).
export function breathe(fig, t, phase = 0) {
  fig.body.scale.y = 1 + Math.sin(t * 1.6 + phase) * 0.02;
  fig.head.position.y = fig._headY ?? (fig._headY = fig.head.position.y);
  fig.head.position.y = fig._headY + Math.sin(t * 1.6 + phase) * 0.006;
}

// Walk pose — call every frame while moving; u advances with distance
// (arc-length!), not time. swing ≈ 0.6 for a stroll, 0.9 for a swagger.
export function walkPose(fig, u, swing = 0.6) {
  fig.legL.rotation.x = Math.sin(u) * swing;
  fig.legR.rotation.x = -Math.sin(u) * swing;
  fig.armL.rotation.x = -Math.sin(u) * swing * 0.7;
  fig.armR.rotation.x = Math.sin(u) * swing * 0.7;
}

export function restPose(fig) {
  fig.legL.rotation.x = fig.legR.rotation.x = 0;
  fig.armL.rotation.x = fig.armR.rotation.x = 0;
}
