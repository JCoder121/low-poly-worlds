// The world clock: one continuous day — dawn → midday → dusk → night and round
// again. Everything time-varying reads this module's precomputed `ws` each
// frame; nothing else keeps its own clock. v2: continuous dayPos (was two
// discrete modes), a moon phase, a rise/set disc position, and a weather block
// (numbers written by weather.js, dimming applied here before publishing).
import * as THREE from "three";
import { COLORS } from "./palette.js";

export const DAY_LENGTH = 360; // seconds per full day

// day-position anchors (musashi convention). The page opens anywhere on this
// wheel; ?time= / ?mode= / live mode pin the opening position.
const DAWN = 0.0, MIDDAY = 0.25, DUSK = 0.55, NIGHT = 0.8;
const SUNSET = 0.68; // dayPos where the sun hands the sky to the moon (≈ blend 0.5)

// synodic moon, for live mode: a new moon at this epoch, one every 29.53 days
const SYNODIC = 29.530588853; // days
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14, 0);

const smooth = (x) => x * x * (3 - 2 * x);
const wrap01 = (x) => ((x % 1) + 1) % 1;
const lerp = THREE.MathUtils.lerp;

function synodicPhase(now) {
  const days = (now.getTime() - NEW_MOON_EPOCH) / 86400000;
  return wrap01(days / SYNODIC);
}

// Four lighting anchors, ring-lerped (smoothstep between the two that bracket
// dayPos, wrapping dawn back on at 1.0). Light + disc colors are tuned hexes
// (lights aren't palette materials); bg + midday/night water ramps come straight
// from palette COLORS, dawn/dusk water ramps are rose/gold tints of them.
function K(pos, colors, nums) {
  const c = {};
  for (const key in colors) c[key] = new THREE.Color(colors[key]);
  return { pos, c, n: nums };
}

const KEYS = [
  K(DAWN, {
    bg: 0xf6e3d8, sun: 0xffd8c2, sunColor: 0xffcfa8,
    hemiSky: 0xffe6dc, hemiGround: 0xcabfae,
    trough: 0x2a5f79, mid: 0x4e88a0, crest: 0xc7a7a0, // rose-tinted crests
  }, { sunIntensity: 1.1, hemiIntensity: 0.75, fillIntensity: 0.38, starAlpha: 0, lampIntensity: 0, nightness: 0 }),

  K(MIDDAY, {
    bg: COLORS.parchment, sun: 0xffe8c0, sunColor: 0xfff2d8,
    hemiSky: 0xfff2d9, hemiGround: 0xcdc9b4,
    trough: COLORS.troughDay, mid: COLORS.midDay, crest: COLORS.crestDay,
  }, { sunIntensity: 1.8, hemiIntensity: 0.9, fillIntensity: 0.42, starAlpha: 0, lampIntensity: 0, nightness: 0 }),

  K(DUSK, {
    bg: 0xf3e0c6, sun: 0xffcf9a, sunColor: 0xff9d5c,
    hemiSky: 0xffe2b8, hemiGround: 0xc9b291,
    trough: 0x1c5f76, mid: 0x2f86a0, crest: 0xe8b878, // gold crests — the golden hour
  }, { sunIntensity: 1.5, hemiIntensity: 0.82, fillIntensity: 0.4, starAlpha: 0, lampIntensity: 0.2, nightness: 0.1 }),

  K(NIGHT, {
    bg: COLORS.nightBg, sun: 0xbfd4ec, sunColor: 0xe8e4d4,
    hemiSky: 0x35436a, hemiGround: 0x1a2233,
    trough: COLORS.troughNight, mid: COLORS.midNight, crest: COLORS.crestNight, // slate
  }, { sunIntensity: 0.9, hemiIntensity: 0.6, fillIntensity: 0.16, starAlpha: 1, lampIntensity: 1, nightness: 1 }),
];
// Hold plateaus — without them each state exists for one instant and the sky
// spends the whole day mid-fade (deep night at 0.87 was already half dawn).
// Day holds 0.25→0.45, golden hour 0.55→0.62, night arrives 0.72 and holds
// to 0.93 before the pre-dawn fade.
KEYS.splice(2, 0, { ...KEYS[1], pos: 0.45 }); // day hold
KEYS.splice(4, 0, { ...KEYS[3], pos: 0.62 }); // golden-hour hold
KEYS[5] = { ...KEYS[5], pos: 0.72 }; // night begins earlier
KEYS.push({ ...KEYS[5], pos: 0.93 }); // night hold through the small hours
const PTS = [...KEYS, { ...KEYS[0], pos: KEYS[0].pos + 1 }]; // wrap dawn onto 1.0

// rise→set progress (0..1) of whichever disc is up: sun until SUNSET (apex at
// midday → discPos 0.5), then moon (apex at deep night → 0.5, sets at dawn).
function computeDiscPos(dp) {
  if (dp < SUNSET) {
    return dp <= MIDDAY
      ? (dp / MIDDAY) * 0.5
      : 0.5 + ((dp - MIDDAY) / (SUNSET - MIDDAY)) * 0.5;
  }
  return dp <= NIGHT
    ? ((dp - SUNSET) / (NIGHT - SUNSET)) * 0.5
    : 0.5 + ((dp - NIGHT) / (1 - NIGHT)) * 0.5;
}

function bandLabel(dp) {
  if (dp >= 0.12 && dp < 0.42) return "day";
  if (dp >= 0.42 && dp < 0.66) return "dusk";
  if (dp >= 0.66 && dp < 0.9) return "night";
  return "dawn";
}

export class Cycle {
  constructor() {
    const q = new URLSearchParams(location.search);

    // live mode: the diorama's clock tracks the visitor's real local time (and
    // the real moon phase). An explicit ?time= / ?mode= always wins → live off.
    this.live = (q.get("real") === "1" || localStorage.getItem("sw-live") === "1")
      && !q.has("time") && !q.has("mode");

    // ?speed multiplies the clock; ?speed=0 freezes dayPos AND ws.time.
    this.speed = q.has("speed") ? Math.max(0, Number(q.get("speed")) || 0) : 1;

    // opening day-position: ?time=0..1, else ?mode=day|night aliases, else the
    // real clock (live), else a random moment.
    if (q.has("time")) {
      const t = Number(q.get("time"));
      this.dayPos = isNaN(t) ? Math.random() : wrap01(t);
    } else if (q.get("mode") === "day") {
      this.dayPos = MIDDAY;
    } else if (q.get("mode") === "night") {
      this.dayPos = NIGHT;
    } else {
      this.dayPos = Math.random(); // set from the clock below if live
    }

    // moon phase: ?phase= pins it, live computes the real synodic phase, else
    // it's random per load.
    const pq = q.get("phase");
    this._phasePinned = pq != null && !isNaN(Number(pq));
    if (this._phasePinned) this.moonPhase = wrap01(Number(pq));
    else if (this.live) this.moonPhase = synodicPhase(new Date());
    else this.moonPhase = Math.random();

    // weather.js owns the machine; cycle exposes the pin (from ?weather=) and
    // constructs the ws.weather block with safe defaults so consumers — and this
    // module's own dimming — never read undefined before the first weather tick.
    const w = q.get("weather");
    this.weatherPin = ["clear", "fog", "rain", "storm"].includes(w) ? w : null;

    this.time = 0; // world clock (drives waves + all animation; scrub-safe)
    this.mode = "day";

    this.ws = {
      dayPos: this.dayPos,
      blend: 0, // nightness 0..1 (captain/crew/ship read this unchanged)
      mode: "day",
      moonPhase: this.moonPhase,
      time: 0,
      reduced: typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false,
      lighting: {
        bg: new THREE.Color(), sun: new THREE.Color(), sunColor: new THREE.Color(),
        hemiSky: new THREE.Color(), hemiGround: new THREE.Color(),
        trough: new THREE.Color(), mid: new THREE.Color(), crest: new THREE.Color(),
        sunIntensity: 0, hemiIntensity: 0, fillIntensity: 0,
        starAlpha: 0, lampIntensity: 0, discPos: 0,
      },
      weather: { kind: "clear", blend: 1, fogFactor: 1, dim: 1, rainAmount: 0, flash: 0 },
    };

    if (this.live) this._deriveLive();
    this._apply();
  }

  // Back-compat convenience for a day/night toggle: jump to the opposite half.
  // (v2 removes the UI toggle — time flows — but this keeps the API harmless.)
  toggle() {
    this.dayPos = this.ws.blend > 0.5 ? MIDDAY : NIGHT;
    this._apply();
  }

  update(dt) {
    const step = dt * this.speed;
    this.time += step;
    if (this.live) this._deriveLive();
    else this.dayPos = wrap01(this.dayPos + step / DAY_LENGTH);
    this._apply();
  }

  // Map the visitor's wall-clock hour onto the day wheel: 7am dawn, 12 midday,
  // 19 dusk, midnight deep night; the pre-dawn hours climb back toward dawn.
  _deriveLive() {
    const now = new Date();
    let hh = now.getHours() + now.getMinutes() / 60;
    if (hh < 7) hh += 24; // fold pre-dawn onto the far end of the wheel
    const A = [[7, 0.0], [12, 0.25], [19, 0.55], [24, 0.8], [31, 1.0]];
    let dp = 0;
    for (let i = 0; i < A.length - 1; i++) {
      if (hh >= A[i][0] && hh <= A[i + 1][0]) {
        const k = (hh - A[i][0]) / (A[i + 1][0] - A[i][0]);
        dp = A[i][1] + (A[i + 1][1] - A[i][1]) * k;
        break;
      }
    }
    this.dayPos = wrap01(dp);
    if (!this._phasePinned) this.moonPhase = synodicPhase(now);
  }

  _apply() {
    const dp = this.dayPos;
    let a = PTS[0], b = PTS[1];
    for (let i = 0; i < PTS.length - 1; i++) {
      if (dp >= PTS[i].pos && dp <= PTS[i + 1].pos) { a = PTS[i]; b = PTS[i + 1]; break; }
    }
    const span = b.pos - a.pos;
    const k = span === 0 ? 0 : smooth((dp - a.pos) / span);
    const L = this.ws.lighting;

    // copy+lerp mutate the existing Colors in place → zero per-frame allocation
    L.bg.copy(a.c.bg).lerp(b.c.bg, k);
    L.sun.copy(a.c.sun).lerp(b.c.sun, k);
    L.sunColor.copy(a.c.sunColor).lerp(b.c.sunColor, k);
    L.hemiSky.copy(a.c.hemiSky).lerp(b.c.hemiSky, k);
    L.hemiGround.copy(a.c.hemiGround).lerp(b.c.hemiGround, k);
    L.trough.copy(a.c.trough).lerp(b.c.trough, k);
    L.mid.copy(a.c.mid).lerp(b.c.mid, k);
    L.crest.copy(a.c.crest).lerp(b.c.crest, k);

    // weather dims sun + hemi (weather.js wrote .dim last frame; 1 by default)
    const dim = this.ws.weather.dim;
    L.sunIntensity = lerp(a.n.sunIntensity, b.n.sunIntensity, k) * dim;
    L.hemiIntensity = lerp(a.n.hemiIntensity, b.n.hemiIntensity, k) * dim;
    L.fillIntensity = lerp(a.n.fillIntensity, b.n.fillIntensity, k);
    L.starAlpha = lerp(a.n.starAlpha, b.n.starAlpha, k);
    L.lampIntensity = lerp(a.n.lampIntensity, b.n.lampIntensity, k);
    L.discPos = computeDiscPos(dp);

    this.ws.blend = lerp(a.n.nightness, b.n.nightness, k);
    this.mode = bandLabel(dp);
    this.ws.mode = this.mode;
    this.ws.dayPos = dp;
    this.ws.moonPhase = this.moonPhase;
    this.ws.time = this.time;
  }
}
