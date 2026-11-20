/**
 * The V9 kart circuit as data, plus the lap timer. Pure: the 3D track mesh,
 * the map and the timing HUD are all built from this.
 */
import type { Vec2 } from "./world-map";

/** Control points of the circuit's centre line (a closed loop), in driving order from the start line. */
export const START: Vec2 = [20, 64];
const CONTROL: Vec2[] = [
  START,
  [32, 67],
  [37, 77],
  [31, 86],
  [19, 84],
  [10, 90],
  [14, 99],
  [4, 105],
  [-16, 105],
  [-31, 100],
  [-37, 89],
  [-31, 79],
  [-37, 69],
  [-25, 63.5],
  [-11, 64],
  [4, 64],
];

export const TRACK_HALF_WIDTH = 4;
/** How far past the kerb a kart can stray before the lap is ruled invalid. */
export const TRACK_LIMIT = TRACK_HALF_WIDTH + 2.4;

function catmull(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
}

/** The centre line, sampled evenly enough for meshes and lap tracking. */
export const TRACK: Vec2[] = (() => {
  const out: Vec2[] = [];
  const n = CONTROL.length;
  const per = 24;
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < per; k++) {
      out.push(catmull(CONTROL[(i - 1 + n) % n], CONTROL[i], CONTROL[(i + 1) % n], CONTROL[(i + 2) % n], k / per));
    }
  }
  return out;
})();

/** Length of the lap in metres. */
export const TRACK_LENGTH = TRACK.reduce((sum, p, i) => sum + Math.hypot(p[0] - TRACK[(i + 1) % TRACK.length][0], p[1] - TRACK[(i + 1) % TRACK.length][1]), 0);

/** Unit tangent at each sample (direction of travel). */
export const TANGENTS: Vec2[] = TRACK.map((p, i) => {
  const a = TRACK[(i - 1 + TRACK.length) % TRACK.length];
  const b = TRACK[(i + 1) % TRACK.length];
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
});

/** Checkpoints as fractions of the lap; all must be passed, in order, for a lap to count. */
export const CHECKPOINTS = [0.25, 0.5, 0.75];

/** Nearest centre-line sample to a point; searches near `hint` when given, else everywhere. */
export function nearestSample(x: number, z: number, hint = -1) {
  const n = TRACK.length;
  let best = -1;
  let bestD = Infinity;
  const scan = (i: number) => {
    const p = TRACK[((i % n) + n) % n];
    const d = (p[0] - x) ** 2 + (p[1] - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = ((i % n) + n) % n;
    }
  };
  if (hint >= 0) for (let i = hint - 25; i <= hint + 25; i++) scan(i);
  if (hint < 0 || bestD > 64) for (let i = 0; i < n; i++) scan(i);
  return { index: best, dist: Math.sqrt(bestD) };
}

/* ───────────────────────── Barriers ───────────────────────── */

/** Distance of the barrier line from the centre line: a short run-off past the kerb, inside TRACK_LIMIT. */
export const BARRIER_OFFSET = TRACK_HALF_WIDTH + 1.6;
export const BARRIER_HEIGHT = 0.85;
export const BARRIER_THICK = 0.5;
/**
 * Half-width of the opening left in the outer barrier where the south avenue
 * meets the start straight, so you can walk or drive in from the city. Wider
 * than the avenue (world-map AVENUE_HALF, 3.2 m); kept as a number here so
 * this module stays free of runtime imports.
 */
export const ENTRY_HALF = 4.8;

export type Barrier = { x: number; z: number; rot: number; len: number; side: -1 | 1 };

/**
 * Low walls along both edges of the track, as short straight segments of
 * about two metres. A segment is left out where the edge would cross another
 * part of the course (tight bends and hairpins) and at the avenue entrance.
 * `rot` matches three.js `rotation.y` with the segment's length on local x.
 */
export const BARRIERS: Barrier[] = (() => {
  const out: Barrier[] = [];
  const n = TRACK.length;
  const minClear = BARRIER_OFFSET - 0.3;
  const clear = (p: Vec2) => nearestSample(p[0], p[1]).dist >= minClear;
  for (const side of [-1, 1] as const) {
    const edge: Vec2[] = TRACK.map((p, i) => [p[0] - TANGENTS[i][1] * BARRIER_OFFSET * side, p[1] + TANGENTS[i][0] * BARRIER_OFFSET * side]);
    let i = 0;
    while (i < n) {
      const a = edge[i];
      let j = i;
      let len = 0;
      while (len < 2 && j < i + 8 && j < n) {
        const q = edge[j % n];
        const r = edge[(j + 1) % n];
        len += Math.hypot(r[0] - q[0], r[1] - q[1]);
        j++;
      }
      const b = edge[j % n];
      i = j;
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const l = Math.hypot(dx, dz);
      if (l < 0.3) continue;
      const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (!clear(a) || !clear(b) || !clear(mid)) continue;
      // The avenue mouth: north of the start straight, around x = 0.
      if (Math.abs(mid[0]) < ENTRY_HALF + l / 2 && mid[1] < START[1] - TRACK_HALF_WIDTH) continue;
      // A little overlap closes the gaps between segments on the outside of bends.
      out.push({ x: mid[0], z: mid[1], rot: Math.atan2(-dz, dx), len: l + 0.15, side });
    }
    // Inside tight bends the offset edge folds over itself and gets skipped above;
    // close each such gap with one segment at the apex, pushed out to the barrier line.
    const covered = (p: Vec2) => out.some((w) => w.side === side && Math.hypot(w.x - p[0], w.z - p[1]) < 1.8);
    let run: Vec2[] = [];
    const flush = () => {
      if (run.length >= 3) {
        const cx = run.reduce((a, p) => a + p[0], 0) / run.length;
        const cz = run.reduce((a, p) => a + p[1], 0) / run.length;
        const c = TRACK[nearestSample(cx, cz).index];
        const ox = cx - c[0];
        const oz = cz - c[1];
        const ol = Math.hypot(ox, oz) || 1;
        const x = c[0] + (ox / ol) * BARRIER_OFFSET;
        const z = c[1] + (oz / ol) * BARRIER_OFFSET;
        const entry = Math.abs(x) < ENTRY_HALF + 1 && z < START[1] - TRACK_HALF_WIDTH;
        if (!entry && nearestSample(x, z).dist >= minClear) out.push({ x, z, rot: Math.atan2(ox / ol, oz / ol), len: 3.2, side });
      }
      run = [];
    };
    for (let i = 0; i < n; i++) {
      if (covered(edge[i])) flush();
      else run.push(edge[i]);
    }
    flush();
  }
  return out;
})();

export type LapEvent =
  | { type: "start" }
  | { type: "checkpoint"; n: number }
  | { type: "lap"; ms: number; valid: boolean }
  | { type: "invalid"; reason: string };

/**
 * Tracks progress round the circuit and times laps. Crossing the start line
 * forwards starts the clock; crossing it again after every checkpoint, without
 * leaving the track, completes a lap. Driving backwards over the line or
 * cutting the course voids the lap.
 */
export class LapTimer {
  running = false;
  valid = true;
  startedAt = 0;
  passed = 0;
  index = -1;
  lastMs: number | null = null;
  bestMs: number | null = null;

  update(x: number, z: number, now: number): LapEvent[] {
    const events: LapEvent[] = [];
    const { index, dist } = nearestSample(x, z, this.index);
    const n = TRACK.length;
    if (this.index < 0) {
      this.index = index;
      return events;
    }
    const prev = this.index / n;
    const cur = index / n;
    this.index = index;

    if (this.running && dist > TRACK_LIMIT && this.valid) {
      this.valid = false;
      events.push({ type: "invalid", reason: "Left the track" });
    }

    const forwardCross = prev > 0.85 && cur < 0.15;
    const backwardCross = prev < 0.15 && cur > 0.85;
    if (backwardCross && this.running) {
      this.running = false;
      events.push({ type: "invalid", reason: "Wrong way" });
      return events;
    }

    if (this.running) {
      const next = CHECKPOINTS[this.passed];
      if (next !== undefined && prev < next && cur >= next && cur - prev < 0.2) {
        this.passed++;
        events.push({ type: "checkpoint", n: this.passed });
      }
    }

    if (forwardCross && dist <= TRACK_LIMIT) {
      if (this.running) {
        const ms = now - this.startedAt;
        const valid = this.valid && this.passed === CHECKPOINTS.length;
        events.push({ type: "lap", ms, valid });
        if (valid) {
          this.lastMs = ms;
          if (this.bestMs === null || ms < this.bestMs) this.bestMs = ms;
        }
      } else {
        events.push({ type: "start" });
      }
      this.running = true;
      this.valid = true;
      this.passed = 0;
      this.startedAt = now;
    }
    return events;
  }

  /** Stop timing (left the kart). */
  reset() {
    this.running = false;
    this.valid = true;
    this.passed = 0;
    this.index = -1;
  }
}

export function formatLap(ms: number) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
