// The wind: mostly a calm breath, broken by an occasional gust. One scalar
// strength 0..1 that the world sways to, weather drifts on, and sound swells
// with — everything windy reads this, nothing keeps its own gust clock.
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const BASE = 0.04; // the resting breath between gusts
const RISE = 1.5, RELEASE = 2.5; // envelope ramp durations (seconds)
const easeInOut = (x) => x * x * (3 - 2 * x);

export class Wind {
  constructor() {
    this.timer = this._nextGap();
    this.gust = null; // { peak, hold, elapsed } while a gust is running
  }

  _nextGap() {
    return 18 + Math.random() * 32; // 18–50s of calm before the next gust
  }

  update(dt, t) {
    if (reducedMotion) return 0;
    // a gentle sinuous breath under everything, so "calm" isn't dead-flat
    const breath = BASE * (0.7 + 0.3 * Math.sin(t * 0.5));

    if (this.gust) {
      const g = this.gust;
      g.elapsed += dt;
      const hold = g.hold;
      let env;
      if (g.elapsed < RISE) {
        env = easeInOut(g.elapsed / RISE);
      } else if (g.elapsed < RISE + hold) {
        env = 1;
      } else {
        const r = (g.elapsed - RISE - hold) / RELEASE;
        env = r >= 1 ? 0 : easeInOut(1 - r);
      }
      if (g.elapsed >= RISE + hold + RELEASE) {
        this.gust = null;
        this.timer = this._nextGap();
        return breath;
      }
      return breath + env * (g.peak - breath);
    }

    this.timer -= dt;
    if (this.timer <= 0) {
      this.gust = { peak: 0.5 + Math.random() * 0.5, hold: 1 + Math.random(), elapsed: 0 };
    }
    return breath;
  }
}
