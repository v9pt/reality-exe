import { describe, expect, it } from "vitest";
import { AVATAR_RADIUS, KART_RADIUS, Terrain, blinkTarget, findAnchor, stepAir, stepGround, stepKart, stepSwing, type Body, type Kart } from "./motion";
import { CITY_RANGE, POND, SOLIDS, generateBuildings, obstacleGrid } from "./world-map";

/**
 * Powers must never carry you inside a building, a landmark, the highway deck
 * or the pond. These drive the pure physics on the real city, with no safety
 * net, and check that no step ends overlapping something solid.
 */
const buildings = generateBuildings(CITY_RANGE.high);
const t = new Terrain(obstacleGrid(buildings), buildings);

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** A free spot: on the ground, or on whatever roof is there. */
function freeBody(rand: () => number, r: number): Body | null {
  for (let i = 0; i < 50; i++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * 200;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const y = t.support(x, z, 200, r);
    if (!t.blocked(x, z, y, r)) return { x, y, z, vx: 0, vy: 0, vz: 0, grounded: true };
  }
  return null;
}

const where = (b: Body) => `(${b.x.toFixed(2)}, ${b.y.toFixed(2)}, ${b.z.toFixed(2)})`;

describe("no phasing", () => {
  it("swinging, leaping, slamming and running never end inside anything", () => {
    const rand = rng(7);
    const dt = 1 / 60;
    let runs = 0;
    for (let run = 0; run < 160; run++) {
      const b = freeBody(rand, AVATAR_RADIUS);
      if (!b) continue;
      runs++;
      const a = rand() * Math.PI * 2;
      const fx = Math.sin(a);
      const fz = Math.cos(a);
      const kind = run % 4;
      if (kind === 0) {
        // Grapple: yank toward an anchor ahead, reel hard, push forward.
        const { point } = findAnchor(t, b.x, b.y, b.z, fx, fz);
        let len = Math.hypot(point[0] - b.x, point[1] - b.y - 1.6, point[2] - b.z);
        b.vx = fx * 15;
        b.vz = fz * 15;
        b.vy = 9;
        b.grounded = false;
        for (let f = 0; f < 240; f++) {
          len = stepSwing(t, b, point, len, fx, fz, dt, f < 60 ? 16 : 3);
          expect(t.blocked(b.x, b.z, b.y, AVATAR_RADIUS), `swing run ${run} frame ${f} ${where(b)}`).toBe(false);
        }
      } else if (kind === 1) {
        // Sky leap or elastic sling at overdrive speed, then a slam.
        b.vx = fx * 34;
        b.vz = fz * 34;
        b.vy = 15.5;
        b.grounded = false;
        for (let f = 0; f < 240 && !b.grounded; f++) {
          if (f === 40) b.vy = -34;
          stepAir(t, b, fx, fz, dt, { control: 12 });
          expect(t.blocked(b.x, b.z, b.y, AVATAR_RADIUS), `air run ${run} frame ${f} ${where(b)}`).toBe(false);
        }
      } else if (kind === 2) {
        // Overdrive running into whatever is ahead.
        for (let f = 0; f < 180; f++) {
          stepGround(t, b, fx * 34, fz * 34, dt);
          if (!b.grounded) stepAir(t, b, 0, 0, dt);
          expect(t.blocked(b.x, b.z, b.y, AVATAR_RADIUS), `run ${run} frame ${f} ${where(b)}`).toBe(false);
        }
      } else {
        // Blink chains.
        for (let f = 0; f < 8; f++) {
          const [x, z] = blinkTarget(t, b, fx, fz, 12);
          b.x = x;
          b.z = z;
          expect(t.blocked(b.x, b.z, b.y, AVATAR_RADIUS), `blink run ${run} hop ${f} ${where(b)}`).toBe(false);
        }
      }
    }
    expect(runs).toBeGreaterThan(120);
  });

  it("the kart at full boost, jumping and blinking, never ends inside anything", () => {
    const rand = rng(11);
    const dt = 1 / 60;
    for (let run = 0; run < 60; run++) {
      const b = freeBody(rand, KART_RADIUS);
      if (!b) continue;
      const k: Kart = { ...b, heading: rand() * Math.PI * 2, steer: 0, drifting: false };
      for (let f = 0; f < 240; f++) {
        if (f % 60 === 30 && k.grounded) {
          k.vy = 11;
          k.grounded = false;
        }
        if (f % 80 === 50) {
          const [x, z] = blinkTarget(t, k, Math.sin(k.heading), Math.cos(k.heading), 12, KART_RADIUS);
          k.x = x;
          k.z = z;
        }
        stepKart(t, k, 1, Math.sin(f / 20), f % 3 === 0, dt, 1.45);
        expect(t.blocked(k.x, k.z, k.y, KART_RADIUS), `kart run ${run} frame ${f} ${where(k)}`).toBe(false);
      }
    }
  });

  it("you land on top of a landmark instead of inside it", () => {
    for (const s of SOLIDS.filter((s) => s.stand && s.r >= 1)) {
      const b: Body = { x: s.x, y: s.y0 + s.h + 6, z: s.z, vx: 0, vy: 0, vz: 0, grounded: false };
      for (let f = 0; f < 240 && !b.grounded; f++) stepAir(t, b, 0, 0, 1 / 60);
      expect(b.y).toBeCloseTo(s.y0 + s.h, 5);
      expect(t.blocked(b.x, b.z, b.y, AVATAR_RADIUS)).toBe(false);
    }
  });

  it("a body that drops into the pond is moved to its edge", () => {
    const out = t.escape(POND.x, POND.z, 0, AVATAR_RADIUS, 6);
    expect(out).not.toBeNull();
    expect(Math.hypot(out![0] - POND.x, out![1] - POND.z)).toBeGreaterThanOrEqual(POND.r - 0.01);
  });
});
