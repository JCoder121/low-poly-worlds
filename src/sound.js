// Ambient sound: a brook, a wind bed, and an occasional temple bell — all
// synthesized in WebAudio, no assets. Off by default; the toggle click is the
// user gesture that unlocks the AudioContext (autoplay policy), so the context
// is built lazily inside start().
const PENTATONIC = [523, 587, 659, 784, 880]; // a soft C-major pentatonic

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
    const noise = noiseBuffer(ctx);

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

  stop() {
    if (!this._enabled) return;
    this._enabled = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    const ctx = this.ctx;
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setValueAtTime(this.master.gain.value, ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
    setTimeout(() => { ctx.close(); this.ctx = null; }, 1100);
  }
}
