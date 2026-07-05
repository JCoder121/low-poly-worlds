// The four bandana'd hands, one per crew role — first mate, lookout, cook,
// deckhand (the captain is the fifth role, in captain.js). Each runs its own
// role-flavoured task loop, staggered so the deck never pulses in sync. All are
// children of ship.group so they ride the swell for free; plank.js borrows one
// via requestEscort().
//
// crew.js also OWNS the shared deck systems the whole cast plugs into:
//   • DeckRegistry — occupancy claims (never two figures to one spot), rank-
//     based right-of-way, tiny DOM speech bubbles + the global ambient bark
//     rate-limit, and the ~30% paired exchanges when two settle face to face.
// The registry is attached to `events.registry` at construction; the captain
// (built BEFORE crew) picks it up lazily, and plank.js reads it for prisoner
// barks. Bubbles project through `events.camera` (main sets it before the loop);
// with no camera present the bubble layer simply stays quiet — never crashes.
import * as THREE from "three";
import { COLORS, mat, unlit } from "./palette.js";
import { makeFigure, breathe, walkPose, restPose } from "./figures.js";

// module-scope scratch — no per-frame allocations in the loops below
const _p = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _proj = new THREE.Vector3();

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

// rank ladder for right-of-way: the junior yields to the senior.
export const RANK = { deckhand: 1, cook: 2, lookout: 3, mate: 4, captain: 5 };

// ---------------------------------------------------------------------------
// DeckRegistry — the shared deck brain. One instance, on events.registry.
// ---------------------------------------------------------------------------
export class DeckRegistry {
  constructor(events) {
    this.events = events;
    this.claims = new Map();   // spotKey -> ownerId (occupancy)
    this.byId = new Map();     // id -> record
    this.list = [];            // records, iterated per frame (no alloc)
    this.layer = typeof document !== "undefined" ? document.getElementById("bubbles") : null;
    this.reduced = typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;
    this.ambientCd = 7 + Math.random() * 6; // seconds until the next ambient bark
    this.exchangeCd = 8;                     // gate on the paired-exchange scan
  }

  // ---- membership ----
  register(id, rank, fig, lines = null, replies = null) {
    let rec = this.byId.get(id);
    if (!rec) {
      rec = { id, rank, fig, lines, replies,
        lx: 0, lz: 0, facing: 0, walking: false, settled: false,
        el: null, life: 0, fading: 0, fadeT: 0, reply: null };
      this.byId.set(id, rec);
      this.list.push(rec);
    } else {
      rec.rank = rank; rec.fig = fig; rec.lines = lines; rec.replies = replies;
    }
    return rec;
  }
  unregister(id) {
    const rec = this.byId.get(id);
    if (!rec) return;
    this._removeEl(rec);
    this.release(id);
    this.byId.delete(id);
    const i = this.list.indexOf(rec);
    if (i >= 0) this.list.splice(i, 1);
  }

  // ---- occupancy: at most one figure heading for / holding any named spot ----
  taken(key, id) { const o = this.claims.get(key); return o != null && o !== id; }
  claim(key, id) {
    if (!key) return true;
    const o = this.claims.get(key);
    if (o != null && o !== id) return false;
    // a figure holds one spot at a time: drop its others
    for (const [k, v] of this.claims) if (v === id && k !== key) this.claims.delete(k);
    this.claims.set(key, id);
    return true;
  }
  release(id) { for (const [k, v] of this.claims) if (v === id) this.claims.delete(k); }

  // nearest higher-ranked figure within `within` deck-units (local space), or
  // null. Used by a walker to decide whether to yield + sidestep.
  senior(rec, within) {
    let best = null, bd = within * within;
    for (const o of this.list) {
      if (o === rec || o.rank <= rec.rank) continue;
      const dx = o.lx - rec.lx, dz = o.lz - rec.lz;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  // ---- speech bubbles ----------------------------------------------------
  // force=true skips the global rate-limit (plank phases, exchange replies).
  bark(rec, text, force = false) {
    if (!rec || !text || !this.layer) return false;
    const cam = this.events && this.events.camera;
    if (!cam) return false;
    if (!force) {
      if (this.ambientCd > 0) return false;
      this.ambientCd = 9 + Math.random() * 6;
    }
    this._removeEl(rec);
    const el = document.createElement("div");
    el.className = "bubble small";
    el.textContent = text;
    this.layer.appendChild(el);
    rec.el = el;
    rec.fading = 0;
    rec.life = this.reduced ? 1.6 : 2.6;
    this._place(rec);
    return true;
  }

  _place(rec) {
    const cam = this.events && this.events.camera;
    if (!cam || !rec.el || !rec.fig) return;
    const f = rec.fig;
    const hy = (f.head && f.head.position ? f.head.position.y : 0.8) + 0.45;
    _proj.set(0, hy, 0);
    f.group.localToWorld(_proj); // world head, correct under ship/figure scale
    _proj.project(cam);
    rec.el.style.left = `${(_proj.x * 0.5 + 0.5) * window.innerWidth}px`;
    rec.el.style.top = `${(-_proj.y * 0.5 + 0.5) * window.innerHeight}px`;
  }

  _removeEl(rec) {
    if (rec.el) { rec.el.remove(); rec.el = null; }
    rec.fading = 0;
  }

  // called once per frame by Crew.update — advances bubbles, ambient barks,
  // pending exchange replies, and the exchange scan.
  update(dt) {
    if (this.ambientCd > 0) this.ambientCd -= dt;
    if (this.exchangeCd > 0) this.exchangeCd -= dt;

    for (const rec of this.list) {
      if (rec.el) {
        this._place(rec);
        if (rec.fading) {
          rec.fadeT -= dt;
          if (rec.fadeT <= 0) this._removeEl(rec);
        } else {
          rec.life -= dt;
          if (rec.life <= 0) { rec.el.classList.add("out"); rec.fading = 1; rec.fadeT = 0.35; }
        }
      }
      if (rec.reply) {
        rec.reply.t -= dt;
        if (rec.reply.t <= 0) { this.bark(rec, rec.reply.text, true); rec.reply = null; }
      }
    }

    this._ambient();
    this._exchange();
  }

  // one ambient bark per 9–15s across the whole cast; reservoir-pick a settled,
  // quiet figure (zero-alloc single pass).
  _ambient() {
    if (this.ambientCd > 0) return;
    let chosen = null, n = 0;
    for (const rec of this.list) {
      if (!rec.lines || rec.el || rec.reply || rec.walking || !rec.settled) continue;
      n++;
      if (Math.random() < 1 / n) chosen = rec;
    }
    if (chosen) { this.bark(chosen, pick(chosen.lines), true); this.ambientCd = 9 + Math.random() * 6; }
    else this.ambientCd = 2; // nobody free to speak — check again shortly
  }

  // two settled figures within 1.6u, roughly facing each other → 30% a short
  // A-barks / B-replies exchange (both hold the beat where they stand).
  _exchange() {
    if (this.exchangeCd > 0) return;
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      if (!a.settled || a.walking || a.el || a.reply || !a.lines) continue;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j];
        if (!b.settled || b.walking || b.el || b.reply || !b.lines) continue;
        const dx = b.lx - a.lx, dz = b.lz - a.lz;
        const d2 = dx * dx + dz * dz;
        if (d2 > 2.56 || d2 < 0.09) continue; // 1.6u .. 0.3u
        if (!this._faces(a, dx, dz) || !this._faces(b, -dx, -dz)) continue;
        if (Math.random() < 0.30) {
          this.bark(a, pick(a.lines), true);
          b.reply = { t: 1.2, text: pick(b.replies || b.lines) };
          this.exchangeCd = 14;
        } else {
          this.exchangeCd = 6;
        }
        return;
      }
    }
  }

  // does rec face roughly toward (dx,dz)? figure forward = (sin f, cos f).
  _faces(rec, dx, dz) {
    const inv = 1 / (Math.hypot(dx, dz) || 1e-6);
    const fx = Math.sin(rec.facing), fz = Math.cos(rec.facing);
    return (dx * inv * fx + dz * inv * fz) > 0.25;
  }
}

// ---------------------------------------------------------------------------
// role definitions
// ---------------------------------------------------------------------------
const LINES = {
  mate:     ["logged it, cap'n", "heading holds", "two points aport", "aye, noted",
             "the charts agree", "wind's backing", "all squared", "by my reckoning"],
  lookout:  ["sail, far off", "clear to the line", "just a gull", "nothing yet",
             "weather building", "all quiet", "eyes open", "no land yet"],
  cook:     ["stew's on", "who ate the pork", "needs more grog", "mind the pot",
             "biscuits again", "supper soon", "stir, don't stop", "tastes of bilge"],
  deckhand: ["back's achin'", "this deck again", "aye aye", "nearly done",
             "pass the tar", "knots holdin'", "swabbin' forever", "reckon it's noon"],
};
const REPLIES = {
  mate:     ["aye", "noted", "as you say", "hm"],
  lookout:  ["keep watch", "aye", "where away?", "good"],
  cook:     ["smells fine", "save me some", "hah", "aye"],
  deckhand: ["haul away", "aye", "same here", "keep at it"],
};

// { id, rank, colorway, task pool, first task }. Deckhand/cook doze at night.
const ROLES = [
  { id: "mate", rank: RANK.mate,
    fig: { shirt: COLORS.crewStripe, bandana: COLORS.brass, pants: COLORS.boots },
    pool: ["fm_map", "fm_compass", "fm_helm", "fm_pace"], init: "fm_pace", nightDoze: false },
  { id: "lookout", rank: RANK.lookout,
    fig: { shirt: COLORS.crewShirt, bandana: COLORS.crimson, pants: COLORS.crewPants },
    pool: ["lk_bow", "lk_nest", "lk_gull"], init: "lk_bow", nightDoze: false },
  { id: "cook", rank: RANK.cook,
    fig: { shirt: COLORS.crewShirt, bandana: COLORS.crewStripe, pants: COLORS.boots, apron: true },
    pool: ["ck_stew", "ck_barrel"], init: "ck_stew", nightDoze: true },
  { id: "deckhand", rank: RANK.deckhand,
    fig: { shirt: COLORS.crewStripe, bandana: COLORS.rope, pants: COLORS.crewPants },
    pool: ["dh_swab", "dh_rope", "dh_coil", "dh_cannon"], init: "dh_swab", nightDoze: true },
];

// task -> the ship/role spot name it happens at (also the occupancy claim key).
// fm_pace claims "pace" (shared with the captain's pacing corridor).
const TASK_SPOT = {
  fm_map: "mapBarrel", fm_compass: "compass", fm_helm: "helm", fm_pace: "pace",
  lk_bow: "bow", lk_nest: "crowsNest", lk_gull: "gullRail",
  ck_stew: "cookStew", ck_barrel: "cookBarrel",
  dh_swab: null /* per-hand swab spot */, dh_rope: "ropeSpot", dh_coil: "ropeSpot", dh_cannon: "cannon",
  doze: "hatch",
};

// a swab mop: pole + cone of strands, parented to the right hand
function makeMop() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5), mat(COLORS.mast));
  pole.castShadow = true;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.15, 6), mat(COLORS.sail));
  head.position.y = -0.28;
  head.castShadow = true;
  g.add(pole, head);
  return g;
}

// a ladle: thin handle down the arm with a small bowl at the tip
function makeLadle() {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.34, 5), mat(COLORS.mast));
  handle.castShadow = true;
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(COLORS.brass));
  bowl.rotation.x = Math.PI; // cup opening up
  bowl.position.y = -0.18;
  g.add(handle, bowl);
  return g;
}

export class Crew {
  constructor(ship, events) {
    this.ship = ship;
    this.events = events;
    this.escortBusy = false;
    this._escort = null;
    this.ws = null;

    const deckY = ship && ship.deckY != null ? ship.deckY : 1.05;
    this.deckY = deckY;
    this.keepouts = (ship && ship.keepouts) || [];
    this.bounds = (ship && ship.deckBounds) || { minX: -2.4, maxX: 2.4, minZ: -1.0, maxZ: 1.0 };
    this._fallback = { position: new THREE.Vector3(0, deckY, 0), facing: 0 };

    // shared deck brain — published for captain + plank (they read events.registry)
    this.registry = new DeckRegistry(events);
    events.registry = this.registry;

    // pacing corridor endpoints (first mate walks between them, like the captain)
    this._pace1 = this._shipSpot("pace1").position;
    this._pace2 = this._shipSpot("pace2").position;

    // computed role spots not carried by ship.js. cook's galley sits just off
    // the amidships hatch (camera side); the provisions barrel a little aft.
    this.roleSpots = {
      cookStew: { position: new THREE.Vector3(0.5, deckY, 1.15), facing: 0 },
      cookBarrel: { position: new THREE.Vector3(-1.2, deckY, 0.9), facing: 0 },
    };

    // the stew-pot prop (cook's, but a sibling on the deck so it rides the bob).
    // a squat cauldron on three legs at the galley, with two lazy steam wisps.
    this._buildGalley(ship, deckY);

    this.hands = [];
    for (let i = 0; i < ROLES.length; i++) {
      const R = ROLES[i];
      const fig = makeFigure({
        hat: "bandana", bandanaColor: R.fig.bandana,
        shirt: R.fig.shirt, pants: R.fig.pants, scale: 0.96,
      });
      // cook wears a pale apron over the shirt
      if (R.fig.apron) {
        const apron = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.06), mat(COLORS.sailShadow));
        apron.position.set(0, 0.5, 0.11);
        apron.castShadow = true;
        fig.group.add(apron);
      }

      const mop = makeMop();
      mop.visible = false;
      mop.position.set(0, -0.3, 0.02);
      mop.rotation.x = 0.4;
      fig.armR.add(mop);

      let ladle = null;
      if (R.id === "cook") {
        ladle = makeLadle();
        ladle.visible = false;
        ladle.position.set(0, -0.28, 0.04);
        ladle.rotation.x = 0.5;
        fig.armR.add(ladle);
      }

      ship.group.add(fig.group);

      const h = {
        id: R.id, rank: R.rank, pool: R.pool, nightDoze: R.nightDoze,
        fig, mop, ladle,
        task: R.init, swabSpot: i % 2 === 0 ? "swabB" : "swabC", baseY: deckY,
        phase: "settled", walk: null,
        taskTime: 0, taskDuration: 40 + Math.random() * 20,
        phaseOffset: i * 1.7,
        yieldT: 0,
        escorting: false, escortPhase: null, escortFacing: 0,
        climbT: 0, topY: deckY, scanFacing: 0,
        paceStep: 0,
      };
      h.rec = this.registry.register(R.id, R.rank, fig, LINES[R.id], REPLIES[R.id]);
      this.hands.push(h);
      this.applyTask(h, R.init);
      h.taskTime = Math.random() * 25; // re-stagger (applyTask zeroed it)
    }
  }

  _buildGalley(ship, deckY) {
    const s = this.roleSpots.cookStew.position;
    const g = new THREE.Group();
    g.position.set(s.x, deckY, s.z + 0.55); // pot sits in front of where the cook stands
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.2, 8), mat(COLORS.cannon));
    body.position.y = 0.14;
    body.castShadow = true;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 5, 8), mat(COLORS.brass));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.24;
    const stew = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.02, 8), mat(COLORS.turtle));
    stew.position.y = 0.235;
    for (let k = 0; k < 3; k++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 4), mat(COLORS.hullDark));
      const a = (k / 3) * Math.PI * 2;
      leg.position.set(Math.cos(a) * 0.11, 0.02, Math.sin(a) * 0.11);
      g.add(leg);
    }
    g.add(body, rim, stew);
    // two steam wisps (unlit, animated in update)
    this.steam = [];
    for (let k = 0; k < 2; k++) {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4, 3), unlit(COLORS.foam, { transparent: true, opacity: 0.5 }));
      w.position.set((k - 0.5) * 0.06, 0.3, 0);
      g.add(w);
      this.steam.push(w);
    }
    this.galley = g;
    ship.group.add(g);
  }

  _shipSpot(name) {
    const sp = this.ship && this.ship.spots && this.ship.spots[name];
    return sp && sp.position ? sp : this._fallback;
  }
  _getSpot(name) {
    if (this.roleSpots[name]) return this.roleSpots[name];
    return this._shipSpot(name);
  }

  spotName(h, task) {
    if (task === "dh_swab") return h.swabSpot;
    const s = TASK_SPOT[task];
    if (s === "pace") return "pace1"; // walk to the aft end, then pace the corridor
    return s || "ropeSpot";
  }

  // occupancy claim key for a task (shared corridor spots collapse to one key)
  claimKey(h, task) {
    if (task === "dh_swab") return h.swabSpot;
    return TASK_SPOT[task] || null;
  }

  pickTask(ws, h) {
    const night = ws && ws.blend > 0.5;
    // build a weighted pool, skipping the current task and any spot already
    // claimed by someone else; try a few times before giving up on contention.
    for (let attempt = 0; attempt < 6; attempt++) {
      const pool = [];
      for (const task of h.pool) {
        if (task === h.task) continue;
        let w = 4;
        if (task === "lk_nest") w = 2;       // the climb is a treat, not constant
        if (task === "ck_stew") w = 5;       // the cook loves the pot
        for (let k = 0; k < w; k++) pool.push(task);
      }
      if (h.nightDoze) { const w = night ? 10 : 1; for (let k = 0; k < w; k++) pool.push("doze"); }
      const task = pool[(Math.random() * pool.length) | 0] || h.pool[0];
      if (!this.registry.taken(this.claimKey(h, task), h.id)) return task;
    }
    return h.pool[0];
  }

  // hard-set a hand into a task's base pose at its spot (no walk)
  applyTask(h, task) {
    const s = this._getSpot(this.spotName(h, task));
    h.fig.group.position.set(s.position.x, h.baseY, s.position.z);
    h.fig.group.rotation.set(0, s.facing ?? 0, 0);
    restPose(h.fig);
    h.mop.visible = task === "dh_swab";
    if (h.ladle) h.ladle.visible = task === "ck_stew";
    h.task = task;
    h.taskTime = 0;
    h.taskDuration = 40 + Math.random() * 20;
    this.registry.claim(this.claimKey(h, task), h.id);
  }

  // keep-out-aware planar curve between two deck points (arc-length walked)
  buildCurve(fx, fz, tx, tz) {
    const from = new THREE.Vector3(fx, 0, fz);
    const to = new THREE.Vector3(tx, 0, tz);
    const delta = to.clone().sub(from);
    const side = delta.lengthSq() > 1e-6
      ? new THREE.Vector3(-delta.z, 0, delta.x).normalize()
      : new THREE.Vector3(1, 0, 0);
    const pts = [from];
    for (const k of [0.4, 0.72]) {
      const p = from.clone().lerp(to, k).add(side.clone().multiplyScalar((Math.random() - 0.5) * 0.8));
      this._pushKeepouts(p);
      this._clampBounds(p);
      pts.push(p);
    }
    pts.push(to);
    const curve = new THREE.CatmullRomCurve3(pts);
    return { curve, length: curve.getLength(), dist: 0, target: null };
  }

  _pushKeepouts(p) {
    for (const o of this.keepouts) {
      const dx = p.x - o.x, dz = p.z - o.z;
      const d = Math.hypot(dx, dz);
      if (d < o.r) {
        const s = o.r / (d || 1e-6);
        p.x = o.x + dx * s;
        p.z = o.z + dz * s;
      }
    }
  }

  _clampBounds(p) {
    const b = this.bounds;
    p.x = clamp(p.x, b.minX + 0.25, b.maxX - 0.25);
    p.z = clamp(p.z, b.minZ + 0.25, b.maxZ - 0.25);
  }

  startWalk(h, task) {
    // reserve the destination up front so nobody else heads for it
    this.registry.claim(this.claimKey(h, task), h.id);
    const s = this._getSpot(this.spotName(h, task));
    const cx = h.fig.group.position.x, cz = h.fig.group.position.z;
    const tx = s.position.x, tz = s.position.z;
    h.mop.visible = false;
    if (h.ladle) h.ladle.visible = false;
    if (Math.hypot(tx - cx, tz - cz) < 0.35) {
      // nowhere to visibly walk — settle (or climb) in place
      if (task === "lk_nest") {
        h.fig.group.position.set(tx, h.baseY, tz);
        h.topY = s.position.y ?? h.baseY;
        h.scanFacing = s.facing ?? 0;
        h.phase = "climbing";
        h.climbT = 0;
      } else {
        this.applyTask(h, task);
        h.phase = "settled";
      }
      h.walk = null;
      return;
    }
    h.walk = this.buildCurve(cx, cz, tx, tz);
    h.walk.target = task;
    h.phase = "walking";
    h.yieldT = 0;
  }

  // advance a walk one frame; returns true on arrival. Yields to any senior that
  // strays within 0.8u: pause forward progress and sidestep a touch.
  stepWalk(h, dt, t) {
    const w = h.walk;
    const sr = this.registry.senior(h.rec, 0.8);
    if (sr && h.yieldT <= 0) h.yieldT = 0.5; // hold for a beat when cut off
    if (h.yieldT > 0) {
      h.yieldT -= dt;
      // sidestep away from the senior, staying on the deck
      if (sr) {
        let ox = h.fig.group.position.x - sr.lx, oz = h.fig.group.position.z - sr.lz;
        const ol = Math.hypot(ox, oz) || 1e-6;
        _p.set(clamp(h.fig.group.position.x + (ox / ol) * dt * 0.5, this.bounds.minX + 0.25, this.bounds.maxX - 0.25),
          h.baseY, clamp(h.fig.group.position.z + (oz / ol) * dt * 0.5, this.bounds.minZ + 0.25, this.bounds.maxZ - 0.25));
        h.fig.group.position.copy(_p);
      }
      breathe(h.fig, t, h.phaseOffset);
      return false;
    }
    w.dist = Math.min(w.length, w.dist + dt * 0.75); // bigger deck, same stroll feel
    const u = w.length > 1e-4 ? w.dist / w.length : 1;
    w.curve.getPointAt(Math.min(1, u), _p);
    w.curve.getTangentAt(Math.min(1, u), _tan);
    h.fig.group.position.set(_p.x, h.baseY + Math.abs(Math.sin(t * 6)) * 0.02, _p.z);
    h.fig.group.rotation.set(0, Math.atan2(_tan.x, _tan.z), Math.sin(t * 6) * 0.03);
    walkPose(h.fig, w.dist * 5, 0.6);
    return u >= 1;
  }

  arrive(h) {
    const task = h.walk.target;
    h.walk = null;
    if (task === "lk_nest") {
      const s = this._getSpot("crowsNest");
      h.fig.group.position.set(s.position.x, h.baseY, s.position.z);
      h.topY = s.position.y ?? h.baseY;
      h.scanFacing = s.facing ?? 0;
      h.phase = "climbing";
      h.climbT = 0;
    } else {
      this.applyTask(h, task);
      h.phase = "settled";
    }
  }

  // plank.js calls this at muster; nearest free deck hand peels off to escort
  requestEscort() {
    if (this.escortBusy) return;
    const base = this._shipSpot("plankBase");
    const tip = this._shipSpot("plankTip");
    let best = null, bd = Infinity;
    for (const h of this.hands) {
      if (h.escorting) continue;
      if (h.phase === "climbing" || h.phase === "descending" || h.task === "lk_nest") continue;
      const dx = h.fig.group.position.x - base.position.x;
      const dz = h.fig.group.position.z - base.position.z;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = h; }
    }
    if (!best) {
      for (const h of this.hands) if (!h.escorting) { best = h; break; }
    }
    if (!best) return;

    this.escortBusy = true;
    this._escort = best;
    best.escorting = true;
    best.escortPhase = "toBase";
    best.mop.visible = false;
    if (best.ladle) best.ladle.visible = false;
    best.fig.group.position.y = best.baseY; // in case it was climbing
    this.registry.release(best.id);         // gives up its task spot to march

    const b = this.bounds;
    const tx = clamp(base.position.x - 0.3, b.minX + 0.25, b.maxX - 0.25);
    const tz = clamp(base.position.z - 0.55, b.minZ + 0.25, b.maxZ - 0.25);
    best.walk = this.buildCurve(best.fig.group.position.x, best.fig.group.position.z, tx, tz);
    best.escortFacing = Math.atan2(tip.position.x - tx, tip.position.z - tz);
  }

  // plank.js asks the current escort to speak ("this way, mate")
  escortBark(text) {
    if (this._escort) this.registry.bark(this._escort.rec, text, true);
  }

  updateEscort(h, dt, t) {
    // event's over (or ended early) — rejoin the routine
    if (this.events.plank.phase === "idle") {
      h.escorting = false;
      this.escortBusy = false;
      this._escort = null;
      this.startWalk(h, this.pickTask(this.ws, h));
      return;
    }
    if (h.escortPhase === "toBase") {
      if (this.stepWalk(h, dt, t)) h.escortPhase = "wait";
    } else {
      // stand behind the plank, watching — arms half-raised, a grim witness
      h.fig.group.rotation.set(0, h.escortFacing, 0);
      h.fig.group.position.y = h.baseY;
      restPose(h.fig);
      h.fig.armL.rotation.x = 0.18;
      h.fig.armR.rotation.x = 0.18;
    }
    breathe(h.fig, t, h.phaseOffset);
  }

  idle(h, t, amp) {
    const f = h.fig;
    switch (h.task) {
      // ---- first mate ----
      case "fm_map":
        f.group.rotation.set(0.42 + Math.sin(t * 0.5) * 0.02, f.group.rotation.y, 0);
        f.armL.rotation.set(-0.5, 0, 0.22);
        f.armR.rotation.set(-0.5, 0, -0.22);
        f.head.rotation.y = Math.sin(t * 0.28) * 0.25;
        f.group.position.y = h.baseY;
        break;
      case "fm_compass":
        f.body.rotation.z = Math.sin(t * 0.5) * 0.05 * amp;
        f.head.rotation.set(0.4, Math.sin(t * 0.35) * 0.3, 0);
        f.armL.rotation.set(-0.9, 0, 0.3);
        f.armR.rotation.set(-0.9, 0, -0.3);
        f.group.position.y = h.baseY;
        break;
      case "fm_helm":
        f.group.rotation.z = Math.sin(t * 0.4) * 0.03 * amp;
        f.armL.rotation.set(-1.15 + Math.sin(t * 0.6) * 0.08, 0, 0.28);
        f.armR.rotation.set(-1.15 - Math.sin(t * 0.6) * 0.08, 0, -0.28);
        f.head.rotation.x = 0.1;
        f.group.position.y = h.baseY;
        break;
      case "fm_pace": {
        // pace the quarterdeck corridor, hands clasped behind (like the captain)
        const period = 9;
        const ph = (t % period) / period;
        const tri = ph < 0.5 ? ph * 2 : (1 - ph) * 2;
        const u = easeInOut(tri);
        const ax = this._pace1.x, az = this._pace1.z;
        const bx = this._pace2.x, bz = this._pace2.z;
        const dir = ph < 0.5 ? 1 : -1;
        h.paceStep += 0.75 * 0.6 * 5 * (this.reducedDt || 0.016);
        f.group.position.set(ax + (bx - ax) * u, h.baseY, az + (bz - az) * u);
        f.group.rotation.set(0, Math.atan2((bx - ax) * dir, (bz - az) * dir), Math.sin(h.paceStep) * 0.04 * amp);
        f.legL.rotation.x = Math.sin(h.paceStep) * 0.4;
        f.legR.rotation.x = -Math.sin(h.paceStep) * 0.4;
        f.armL.rotation.set(-0.5, 0, 0.12);
        f.armR.rotation.set(-0.5, 0, -0.12);
        break;
      }
      // ---- lookout ----
      case "lk_bow":
        // hand shading the eyes, slow horizon sweep
        f.group.rotation.y = (this._getSpot("bow").facing ?? 0) + Math.sin(t * 0.22) * 0.35 * amp;
        f.armR.rotation.set(-1.4, 0, -0.1);
        f.armL.rotation.set(-0.2, 0, 0.2);
        f.head.rotation.x = -0.1 + Math.sin(t * 0.5) * 0.03;
        f.group.position.y = h.baseY;
        break;
      case "lk_nest":
        f.group.rotation.y = h.scanFacing + Math.sin(t * 0.5) * 0.6 * amp;
        f.group.position.y = h.topY + Math.sin(t * 1.2) * 0.02 * amp;
        f.armL.rotation.x = 0.4;
        f.armR.rotation.x = 0.4;
        break;
      case "lk_gull":
        f.group.rotation.set(0.22, (this._getSpot("gullRail").facing ?? 0), Math.sin(t * 0.3) * 0.04 * amp);
        f.head.rotation.y = Math.sin(t * 0.18) * 0.3;
        f.armL.rotation.set(-0.35, 0, 0.32);
        f.armR.rotation.set(-0.35, 0, -0.32);
        f.group.position.y = h.baseY;
        break;
      // ---- cook ----
      case "ck_stew": {
        // stir the pot: circular right-arm sweep, slight lean over the cauldron
        f.group.rotation.set(0.14, (this._getSpot("cookStew").facing ?? 0), 0);
        f.armR.rotation.x = -0.7 + Math.sin(t * 2) * 0.25 * amp;
        f.armR.rotation.z = -0.2 + Math.cos(t * 2) * 0.3 * amp;
        f.armL.rotation.set(-0.2, 0, 0.2);
        f.head.rotation.x = 0.25;
        f.group.position.y = h.baseY;
        break;
      }
      case "ck_barrel":
        // crouched at the provisions barrel, lifting the lid to check
        f.group.position.y = h.baseY - 0.12;
        f.group.rotation.x = 0.2;
        f.legL.rotation.x = 0.6;
        f.legR.rotation.x = 0.6;
        f.armL.rotation.set(-0.4 + Math.sin(t * 1.5) * 0.2 * amp, 0, 0.24);
        f.armR.rotation.set(-0.4 - Math.sin(t * 1.5) * 0.2 * amp, 0, -0.24);
        f.head.rotation.x = 0.3;
        break;
      // ---- deckhand ----
      case "dh_swab":
        f.armR.rotation.x = 0.8 + Math.sin(t * 3) * 0.4 * amp;
        f.armR.rotation.z = Math.cos(t * 3) * 0.3 * amp;
        f.armL.rotation.x = 0.5 + Math.sin(t * 3 + 1) * 0.2 * amp;
        f.group.rotation.z = Math.sin(t * 1.5) * 0.05 * amp;
        f.group.position.y = h.baseY;
        break;
      case "dh_rope": {
        const pull = Math.sin(t * 2);
        f.armL.rotation.x = 0.5 - pull * 0.8 * amp;
        f.armR.rotation.x = 0.5 - pull * 0.8 * amp;
        f.legL.rotation.x = 0.3;
        f.legR.rotation.x = -0.2;
        f.group.position.y = h.baseY + Math.max(0, pull) * 0.02 * amp;
        break;
      }
      case "dh_coil":
        f.group.position.y = h.baseY - 0.14 + Math.sin(t * 2) * 0.03 * amp;
        f.legL.rotation.x = 0.5;
        f.legR.rotation.x = 0.5;
        f.armL.rotation.x = 1.1 + Math.sin(t * 2) * 0.2 * amp;
        f.armR.rotation.x = 1.1 + Math.sin(t * 2 + 0.6) * 0.2 * amp;
        break;
      case "dh_cannon":
        f.group.position.y = h.baseY - 0.1;
        f.legL.rotation.x = 0.45;
        f.legR.rotation.x = 0.45;
        f.armR.rotation.x = 0.9 + Math.sin(t * 3) * 0.2 * amp;
        f.armR.rotation.z = Math.cos(t * 3) * 0.25 * amp;
        f.armL.rotation.x = 0.6;
        break;
      // ---- shared ----
      case "doze":
        f.group.position.y = h.baseY - 0.22;
        f.legL.rotation.x = 1.3;
        f.legR.rotation.x = 1.3;
        f.armL.rotation.x = 0.25;
        f.armR.rotation.x = 0.25;
        f.group.rotation.z = 0.12; // slumped against the hatch coaming
        break;
    }
  }

  update(ws, dt) {
    this.ws = ws;
    this.reducedDt = dt;
    const t = ws.time;
    const amp = ws.reduced ? 0.35 : 1;

    // gentle steam off the pot, always
    if (this.steam) {
      for (let k = 0; k < this.steam.length; k++) {
        const w = this.steam[k];
        const ph = (t * 0.6 + k * 0.5) % 1;
        w.position.y = 0.28 + ph * 0.22;
        w.material.opacity = 0.5 * (1 - ph) * (ws.blend > 0.5 ? 0.6 : 1);
      }
    }

    for (const h of this.hands) {
      if (h.escorting) {
        this.updateEscort(h, dt, t);
        this._sync(h);
        continue;
      }

      switch (h.phase) {
        case "walking":
          if (this.stepWalk(h, dt, t)) this.arrive(h);
          break;

        case "climbing": {
          h.climbT += dt;
          const fr = Math.min(1, h.climbT / 3.2); // taller mainmast → longer glide up
          h.fig.group.position.y = h.baseY + (h.topY - h.baseY) * easeInOut(fr);
          h.fig.armL.rotation.x = 1.4;
          h.fig.armR.rotation.x = 1.4;
          h.fig.legL.rotation.x = 0.1;
          h.fig.legR.rotation.x = 0.1;
          if (fr >= 1) {
            h.phase = "settled";
            h.task = "lk_nest";
            h.taskTime = 0;
            h.taskDuration = 40 + Math.random() * 20;
          }
          break;
        }

        case "descending": {
          h.climbT += dt;
          const fr = Math.min(1, h.climbT / 2.8);
          h.fig.group.position.y = h.topY + (h.baseY - h.topY) * easeInOut(fr);
          h.fig.group.rotation.y = h.scanFacing;
          h.fig.armL.rotation.x = 1.4;
          h.fig.armR.rotation.x = 1.4;
          if (fr >= 1) this.startWalk(h, this.pickTask(ws, h));
          break;
        }

        case "settled":
        default:
          h.taskTime += dt;
          this.idle(h, t, amp);
          if (h.taskTime > h.taskDuration) {
            if (h.task === "lk_nest") {
              h.phase = "descending";
              h.climbT = 0;
            } else {
              this.startWalk(h, this.pickTask(ws, h));
            }
          }
          break;
      }

      breathe(h.fig, t, h.phaseOffset);
      this._sync(h);
    }

    // advance the shared deck brain once per frame (bubbles, barks, exchanges)
    this.registry.update(dt);
  }

  // publish a hand's local position/heading + state into its registry record
  _sync(h) {
    const r = h.rec;
    r.lx = h.fig.group.position.x;
    r.lz = h.fig.group.position.z;
    r.facing = h.fig.group.rotation.y;
    r.walking = h.phase === "walking" || (h.escorting && h.escortPhase === "toBase");
    r.settled = h.phase === "settled" && !h.escorting;
  }
}
