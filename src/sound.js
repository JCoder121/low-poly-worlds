// Ambient sound: a brook, a wind bed, and an occasional temple bell — all
// synthesized in WebAudio, no assets. Off by default; the toggle click is the
// user gesture that unlocks the AudioContext (autoplay policy), so the context
// is built lazily inside start().
const PENTATONIC = [523, 587, 659, 784, 880]; // a soft C-major pentatonic

// shinobue melody: a minyo-ish pentatonic dropped an octave (÷2) for warmth —
// D4 E4 G4 A4 B4. Unhurried phrases are drawn from these, with rests.
const FLUTE_SCALE = [587.33, 659.25, 783.99, 880, 987.77].map((f) => f / 2);

// one second of white noise, looped — the raw material for brook and wind
function noiseBuffer(ctx) {
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export class Ambience {
  constructor() {
    this.ctx = null;
    this._enabled = false;
    this.wind = 0; // smoothed wind strength driving the wind bed
    this.windTarget = 0;
    this.bellTimer = 0;
    this._raf = null;
    this._last = 0;
    this._flute = false; // desired flute state; main sets it every frame
    this._fluteScheduler = null; // setInterval id for the phrase scheduler
    this._fluteNextNote = 0; // ctx.currentTime the next note may begin at
    this._fluteLastFreq = FLUTE_SCALE[0]; // for portamento between notes
  }

  get enabled() {
    return this._enabled;
  }

  setWind(g) {
    this.windTarget = g;
  }

  start() {
    if (this._enabled) return;
    this._enabled = true;
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    const noise = (this._noise = noiseBuffer(ctx));

    const master = (this.master = ctx.createGain());
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 2);
    master.connect(ctx.destination);

    // ---- brook: noise → two bandpasses, each with a slow gain LFO ----
    const brookSrc = ctx.createBufferSource();
    brookSrc.buffer = noise;
    brookSrc.loop = true;
    const brookGain = ctx.createGain();
    brookGain.gain.value = 0.12;
    brookGain.connect(master);
    const bands = [
      { freq: 750, q: 0.9, lfo: 0.13 },
      { freq: 2200, q: 1.2, lfo: 0.18 },
    ];
    for (const b of bands) {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = b.freq;
      bp.Q.value = b.q;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = b.lfo;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.3 * 0.5; // ±30% of the 0.5 base
      lfo.connect(lfoGain).connect(g.gain);
      lfo.start();
      brookSrc.connect(bp).connect(g).connect(brookGain);
    }
    brookSrc.start();

    // ---- wind bed: noise → lowpass, gain tracks setWind() ----
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = noise;
    windSrc.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 380;
    const windGain = (this.windGain = ctx.createGain());
    windGain.gain.value = 0.15;
    windSrc.connect(lp).connect(windGain).connect(master);
    windSrc.start();

    // ---- flute bus: silent until setFlute(true) ramps it up. Individual notes
    // (built per phrase in _flutePlay) plus a continuous breath layer of the
    // noise buffer band-passed high and kept very quiet hang off this gain, so
    // the whole shinobue voice fades in/out as one. ≈0.5 of master when open. ----
    const fluteBus = (this.fluteBus = ctx.createGain());
    fluteBus.gain.value = 0;
    fluteBus.connect(master);
    const breathSrc = ctx.createBufferSource();
    breathSrc.buffer = noise;
    breathSrc.loop = true;
    const breathBp = ctx.createBiquadFilter();
    breathBp.type = "bandpass";
    breathBp.frequency.value = 2500;
    breathBp.Q.value = 0.8;
    const breathGain = ctx.createGain();
    breathGain.gain.value = 0.02; // a whisper under the tone
    breathSrc.connect(breathBp).connect(breathGain).connect(fluteBus);
    breathSrc.start();

    this.bellTimer = 50 + Math.random() * 70;
    this._last = performance.now();
    this._tick();
  }

  // smooth the wind bed toward the target and count down to the next bell
  _tick() {
    if (!this._enabled) return;
    const now = performance.now();
    const dt = Math.min((now - this._last) / 1000, 0.1);
    this._last = now;

    // ~1s time constant so gusts audibly swell and settle
    this.wind += (this.windTarget - this.wind) * (1 - Math.exp(-dt / 1.0));
    this.windGain.gain.setTargetAtTime(0.15 + this.wind, this.ctx.currentTime, 0.1);

    this.bellTimer -= dt;
    if (this.bellTimer <= 0) {
      this._strike();
      this.bellTimer = 50 + Math.random() * 70;
    }
    this._raf = requestAnimationFrame(() => this._tick());
  }

  // one soft bell: fundamental + a high inharmonic partial, exponential decay
  _strike() {
    const ctx = this.ctx;
    const f = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 4);
    g.connect(this.master);
    for (const [mult, amp] of [[1, 1], [2.7, 0.35]]) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f * mult;
      const og = ctx.createGain();
      og.gain.value = amp;
      o.connect(og).connect(g);
      o.start();
      o.stop(ctx.currentTime + 4.2);
    }
  }

  // enable/disable the shinobue. Called every frame with the live state, so it
  // gates on the stored bool and no-ops when the ambience isn't running.
  setFlute(active) {
    if (!this._enabled) return;
    if (active === this._flute) return;
    this._flute = active;
    const ctx = this.ctx, now = ctx.currentTime;
    this.fluteBus.gain.cancelScheduledValues(now);
    this.fluteBus.gain.setValueAtTime(this.fluteBus.gain.value, now);
    if (active) {
      this.fluteBus.gain.linearRampToValueAtTime(0.5, now + 1.5); // fade in
      this._fluteNextNote = now + 0.3;
      this._fluteScheduler = setInterval(() => this._fluteSchedule(), 500);
      this._fluteSchedule();
    } else {
      this.fluteBus.gain.linearRampToValueAtTime(0, now + 2); // fade out
      clearInterval(this._fluteScheduler); // let ringing notes decay
      this._fluteScheduler = null;
    }
  }

  // phrase scheduler: lookahead ~0.6s so no per-frame work. Each slot is either
  // a note (drawn from FLUTE_SCALE, 1.2–3.0s) or, 25% of the time, a rest.
  _fluteSchedule() {
    if (!this._flute) return;
    const ctx = this.ctx;
    while (this._fluteNextNote < ctx.currentTime + 0.6) {
      if (Math.random() < 0.25) {
        this._fluteNextNote += 0.6 + Math.random() * 0.9; // a breath of silence
        continue;
      }
      const dur = 1.2 + Math.random() * 1.8;
      const freq = FLUTE_SCALE[Math.floor(Math.random() * FLUTE_SCALE.length)];
      this._flutePlay(freq, this._fluteNextNote, dur);
      this._fluteNextNote += dur;
    }
  }

  // one flute note: triangle → lowpass → its own attack/release envelope, with
  // portamento in from the previous pitch and a vibrato LFO that grows over the
  // note. Everything feeds the flute bus so setFlute governs the overall level.
  _flutePlay(freq, start, dur) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(0.6, start + 0.25); // gentle attack
    g.gain.setValueAtTime(0.6, Math.max(start + 0.25, start + dur - 0.5));
    g.gain.linearRampToValueAtTime(0.0001, start + dur); // soft release

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2200;
    lp.connect(g).connect(this.fluteBus);

    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(this._fluteLastFreq, start);
    o.frequency.linearRampToValueAtTime(freq, start + 0.08); // portamento
    this._fluteLastFreq = freq;

    // vibrato: 4.5–5.5 Hz, depth ±6 cents (~0.35% of freq) swelling in over the
    // note's length so held tones bloom rather than wobbling from the attack
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 4.5 + Math.random();
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.0001, start);
    lfoGain.gain.linearRampToValueAtTime(freq * 0.0035, start + dur);
    lfo.connect(lfoGain).connect(o.frequency);

    o.connect(lp);
    o.start(start);
    lfo.start(start);
    o.stop(start + dur + 0.1);
    lfo.stop(start + dur + 0.1);
  }

  stop() {
    if (!this._enabled) return;
    this._enabled = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._fluteScheduler) { clearInterval(this._fluteScheduler); this._fluteScheduler = null; }
    this._flute = false;
    const ctx = this.ctx;
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setValueAtTime(this.master.gain.value, ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
    setTimeout(() => { ctx.close(); this.ctx = null; }, 1100);
  }
}
