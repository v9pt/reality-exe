import { describe, expect, it } from "vitest";
import { BARRIERS, BARRIER_OFFSET, CHECKPOINTS, ENTRY_HALF, LapTimer, START, TANGENTS, TRACK, TRACK_LENGTH, TRACK_LIMIT, formatLap, nearestSample } from "./circuit";
import { KART, Terrain, stepKart, type Kart } from "./motion";
import { AVENUE_HALF, CIRCUIT_RECT, CITY_RANGE, generateBuildings, obstacleGrid, walkable } from "./world-map";

/** Drive the centre line from sample `from` for `count` samples, 50 ms apart. */
function drive(timer: LapTimer, from: number, count: number, t0: number) {
  const events = [];
  let t = t0;
  for (let i = 0; i <= count; i++) {
    const p = TRACK[(from + i) % TRACK.length];
    events.push(...timer.update(p[0], p[1], t));
    t += 50;
  }
  return { events, t };
}

describe("kart circuit", () => {
  it("is a sensible size and sits inside its clear area", () => {
    expect(TRACK_LENGTH).toBeGreaterThan(200);
    for (const [x, z] of TRACK) {
      expect(x).toBeGreaterThan(CIRCUIT_RECT.x0 + 4);
      expect(x).toBeLessThan(CIRCUIT_RECT.x1 - 4);
      expect(z).toBeGreaterThan(CIRCUIT_RECT.z0 + 2);
      expect(z).toBeLessThan(CIRCUIT_RECT.z1 - 2);
      expect(walkable(x, z)).toBe(true);
    }
  });

  it("no building stands on the track", () => {
    const bs = generateBuildings(150);
    for (const [x, z] of TRACK) for (const b of bs) expect(Math.hypot(b.x - x, b.z - z)).toBeGreaterThan(5);
  });

  it("times a clean lap", () => {
    const timer = new LapTimer();
    const n = TRACK.length;
    // Approach the line from behind, cross it, go round, cross it again.
    let { events, t } = drive(timer, n - 5, 10, 0);
    expect(events.some((e) => e.type === "start")).toBe(true);
    ({ events, t } = drive(timer, 5, n, t));
    const lap = events.find((e) => e.type === "lap");
    expect(lap).toMatchObject({ type: "lap", valid: true });
    expect(events.filter((e) => e.type === "checkpoint")).toHaveLength(CHECKPOINTS.length);
    expect(timer.bestMs).toBeGreaterThan(0);
  });

  it("voids a lap that cuts the course", () => {
    const timer = new LapTimer();
    const n = TRACK.length;
    let { t } = drive(timer, n - 5, 10, 0);
    // Leave the track by 20 m, then rejoin and finish.
    timer.update(TRACK[30][0] + 20, TRACK[30][1] + 20, t);
    ({ t } = drive(timer, 31, n - 31 + 5, t + 50));
    expect(timer.bestMs).toBeNull();
  });

  it("finds the nearest point on the line", () => {
    const [x, z] = TRACK[40];
    expect(nearestSample(x, z).index).toBe(40);
  });

  it("formats lap times", () => {
    expect(formatLap(83456)).toBe("1:23.45");
  });

  it("barriers line both edges, clear of the track everywhere", () => {
    expect(BARRIERS.filter((b) => b.side === 1).length).toBeGreaterThan(60);
    expect(BARRIERS.filter((b) => b.side === -1).length).toBeGreaterThan(60);
    for (const b of BARRIERS) expect(nearestSample(b.x, b.z).dist).toBeGreaterThanOrEqual(BARRIER_OFFSET - 0.3);
  });

  it("leaves an opening where the south avenue meets the track", () => {
    expect(ENTRY_HALF).toBeGreaterThan(AVENUE_HALF + 1);
    const inMouth = BARRIERS.filter((b) => Math.abs(b.x) < AVENUE_HALF + 0.5 && b.z < START[1]);
    expect(inMouth).toHaveLength(0);
  });

  it("a kart steered off the track is stopped by the barrier before the track limit", () => {
    const buildings = generateBuildings(CITY_RANGE.high);
    const t = new Terrain(obstacleGrid(buildings), buildings);
    // Several spots round the lap, driving straight out of either side at full throttle.
    for (const i of [30, 100, 170, 250, 330]) {
      for (const side of [-1, 1]) {
        const p = TRACK[i];
        const [tx, tz] = TANGENTS[i];
        const nx = -tz * side;
        const nz = tx * side;
        const k: Kart = { x: p[0], y: 0, z: p[1], vx: nx * KART.maxSpeed, vy: 0, vz: nz * KART.maxSpeed, grounded: true, heading: Math.atan2(nx, nz), steer: 0, drifting: false };
        let worst = 0;
        for (let f = 0; f < 120; f++) {
          stepKart(t, k, 1, 0, false, 1 / 60);
          worst = Math.max(worst, nearestSample(k.x, k.z).dist);
        }
        expect(worst, `sample ${i} side ${side}`).toBeLessThan(TRACK_LIMIT);
      }
    }
  });
});
