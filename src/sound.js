// sparrow's wake — ambient sea, all synthesized in WebAudio, no assets. OFF
// until toggle(); the toggle click (or a stored-preference pointerdown) is the
// user gesture that unlocks the AudioContext, so the context is built lazily.
// The graph is built once and then suspended/resumed on toggle rather than torn
// down, so the ocean never has to re-fill its noise buffers.
//
// Layer graph (all → master gain 0.5 → destination):
//   ocean bed  : looped brown-noise → lowpass (~420Hz day, ~300Hz night)
//                → bed gain, itself swelled by a 0.05Hz gain LFO (±30%)
//   wash accent: white-noise burst → sweeping bandpass swell   every 6–14s
//   timber creak: 80→140Hz sawtooth sweep → narrow bandpass    every 9–20s
//   gull cry   : two descending vibrato'd sines (CLEAR DAY ONLY) every 25–60s
//   ship's bell: two detuned + one inharmonic decaying sine     every 90–150s
//   rain bed   : white noise → bandpass hiss, gain = weather.rainAmount
//   thunder    : low filtered-noise roll, 0.8–2s after each storm flash
// Event timing accumulates dt inside update() (no setInterval → scrub-safe).

function rand(a, b) {
  return a + Math.random() * (b - a);
}

// a few seconds of brown noise (integrated white) — the deep roller bed
function brownNoiseBuffer(ctx, seconds = 4) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    d[i] = last * 3.5; // back up to roughly unity
  }
  return buf;
}

// one second of white noise, looped — raw material for wash accents
function whiteNoiseBuffer(ctx) {
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export class Ambience {
  constructor() {
    this.ctx = null;
    this._enabled = false;
    this._suspendTimer = null; // pending suspend after a fade-out

    // event countdowns (seconds), seeded in _build()
    this._washT = 0;
    this._creakT = 0;
    this._gullT = 0;
    this._bellT = 0;
    this._prevFlash = 0; // rising-edge detector for storm-flash → thunder

    // honor a stored preference, but only after the first user gesture so the
    // AudioContext is allowed to start (autoplay policy).
    if (typeof window !== "undefined" && localStorage.getItem("sw-sound") === "1") {
      const arm = () => {
        window.removeEventListener("pointerdown", arm);
        if (!this._enabled) this._setEnabled(true);
      };
      window.addEventListener("pointerdown", arm, { once: true });
    }
  }

  get enabled() {
    return this._enabled;
  }

  toggle() {
    this._setEnabled(!this._enabled);
  }

  _setEnabled(on) {
    if (on) {
      if (!this.ctx) this._build();
      if (this._suspendTimer) {
        clearTimeout(this._suspendTimer);
        this._suspendTimer = null;
      }
      this.ctx.resume();
      this._enabled = true;
      localStorage.setItem("sw-sound", "1");
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(this.master.gain.value, t);
      this.master.gain.linearRampToValueAtTime(0.5, t + 2); // 2s fade in
    } else {
      this._enabled = false;
      localStorage.setItem("sw-sound", "0");
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(this.master.gain.value, t);
      this.master.gain.linearRampToValueAtTime(0, t + 2); // 2s fade out
      // suspend once silent so the bed stops burning cycles; keep the graph.
      this._suspendTimer = setTimeout(() => {
        this._suspendTimer = null;
        if (!this._enabled && this.ctx) this.ctx.suspend();
      }, 2100);
    }
  }

  // build the persistent graph once, on first enable (a user gesture)
  _build() {
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this._brown = brownNoiseBuffer(ctx);
    this._white = whiteNoiseBuffer(ctx);

    const master = (this.master = ctx.createGain());
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.connect(ctx.destination);

    // ---- ocean bed: brown noise → lowpass → bed gain (swelled by a slow LFO) ----
    const bedSrc = ctx.createBufferSource();
    bedSrc.buffer = this._brown;
    bedSrc.loop = true;
    const bedLP = (this.bedLP = ctx.createBiquadFilter());
    bedLP.type = "lowpass";
    bedLP.frequency.value = 420;
    bedLP.Q.value = 0.4;
    const bedGain = ctx.createGain();
    const BED_BASE = 0.32;
    bedGain.gain.value = BED_BASE;
    // 0.05Hz LFO, ±30% of the base level → the bed breathes like long rollers
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = BED_BASE * 0.3;
    lfo.connect(lfoGain).connect(bedGain.gain);
    lfo.start();
    bedSrc.connect(bedLP).connect(bedGain).connect(master);
    bedSrc.start();

    // ---- rain bed: white noise → bandpass + highpass hiss → gain (weather) ----
    // gain is silent until rainAmount rises, tracked smoothly each frame.
    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = this._white;
    rainSrc.loop = true;
    const rainBP = ctx.createBiquadFilter();
    rainBP.type = "bandpass";
    rainBP.frequency.value = 1600;
    rainBP.Q.value = 0.5;
    const rainHP = ctx.createBiquadFilter();
    rainHP.type = "highpass";
    rainHP.frequency.value = 800;
    const rainGain = (this.rainGain = ctx.createGain());
    rainGain.gain.value = 0;
    rainSrc.connect(rainBP).connect(rainHP).connect(rainGain).connect(master);
    rainSrc.start();

    // seed the event clocks so nothing fires on the very first frames
    this._washT = rand(3, 8);
    this._creakT = rand(6, 14);
    this._gullT = rand(12, 30);
    this._bellT = rand(30, 90);
  }

  // per-frame: track the day/night filter and count real seconds toward events.
  // No allocations here beyond the occasional scheduled voice.
  update(ws, dt) {
    if (!this._enabled || !this.ctx) return;
    const ctx = this.ctx;
    const blend = ws ? ws.blend : 0;
    const wx = ws && ws.weather ? ws.weather : null;

    // bed opens up in daylight (~420Hz), closes toward night (~300Hz)
    const cut = 300 + 120 * (1 - blend);
    this.bedLP.frequency.setTargetAtTime(cut, ctx.currentTime, 0.6);

    // rain bed follows weather.rainAmount; thunder rolls after each flash spike
    if (this.rainGain) {
      const ra = wx ? wx.rainAmount : 0;
      this.rainGain.gain.setTargetAtTime(ra * 0.13, ctx.currentTime, 0.6);
    }
    const flash = wx ? wx.flash : 0;
    if (flash > 0.6 && this._prevFlash <= 0.6) this._thunder(rand(0.8, 2));
    this._prevFlash = flash;

    // reduced-motion → longer, calmer gaps between accents
    const slow = ws && ws.reduced ? 1.6 : 1;

    this._washT -= dt;
    if (this._washT <= 0) {
      this._wash();
      this._washT = rand(6, 14) * slow;
    }

    this._creakT -= dt;
    if (this._creakT <= 0) {
      this._creak();
      this._creakT = rand(9, 20) * slow;
    }

    this._gullT -= dt;
    if (this._gullT <= 0) {
      // clear daylight only; still reschedule under night/rain/fog
      if (blend < 0.5 && (!wx || wx.kind === "clear")) this._gull();
      this._gullT = rand(25, 60) * slow;
    }

    this._bellT -= dt;
    if (this._bellT <= 0) {
      this._bell(blend);
      this._bellT = rand(90, 150);
    }
  }

  // a breaking crest: white noise through a bandpass that sweeps down as it swells
  _wash() {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._white;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.7;
    bp.frequency.setValueAtTime(rand(620, 780), t);
    bp.frequency.exponentialRampToValueAtTime(280, t + 2.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.13, t + rand(0.7, 1.1));
    g.gain.linearRampToValueAtTime(0.0001, t + 2.2);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 2.3);
  }

  // a soft thunder roll after a lightning flash: brown noise swelled through a
  // downward-sweeping lowpass, quiet and distant. `delay` = seconds after strike.
  _thunder(delay) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this._brown;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 0.6;
    lp.frequency.setValueAtTime(180, t);
    lp.frequency.exponentialRampToValueAtTime(70, t + 2.2);
    const g = ctx.createGain();
    const dur = rand(1.2, 2.2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.5); // swell
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.1);
  }

  // a timber creak: quiet sawtooth sweep pushed through a narrow bandpass
  _creak() {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(rand(80, 95), t);
    o.frequency.linearRampToValueAtTime(rand(120, 140), t + 0.4);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 110;
    bp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.045, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(bp).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.5);
  }

  // a distant gull: two descending sine notes, each with a touch of vibrato
  _gull() {
    const ctx = this.ctx, t = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.value = 0.05; // distant
    bus.connect(this.master);
    // [start freq, end freq, time offset, duration]
    const notes = [
      [980, 880, 0, 0.2],
      [780, 680, 0.24, 0.32],
    ];
    for (const [f0, f1, off, dur] of notes) {
      const s = t + off;
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(f0, s);
      o.frequency.linearRampToValueAtTime(f1, s + dur);
      const eg = ctx.createGain();
      eg.gain.setValueAtTime(0.0001, s);
      eg.gain.linearRampToValueAtTime(1, s + 0.04);
      eg.gain.exponentialRampToValueAtTime(0.0001, s + dur);
      // vibrato
      const vib = ctx.createOscillator();
      vib.frequency.value = 11;
      const vg = ctx.createGain();
      vg.gain.value = f0 * 0.012;
      vib.connect(vg).connect(o.frequency);
      vib.start(s);
      vib.stop(s + dur + 0.05);
      o.connect(eg).connect(bus);
      o.start(s);
      o.stop(s + dur + 0.05);
    }
  }

  // the ship's bell: two slightly detuned fundamentals + an inharmonic partial,
  // all decaying exponentially. Softer after dark.
  _bell(blend) {
    const ctx = this.ctx, t = ctx.currentTime;
    const soft = 1 - 0.55 * blend;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12 * soft, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4);
    g.connect(this.master);
    const base = 440;
    for (const [mult, amp] of [[1, 1], [1.006, 0.9], [2.76, 0.35]]) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = base * mult;
      const og = ctx.createGain();
      og.gain.value = amp;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + 4.2);
    }
  }
}
