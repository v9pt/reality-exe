import { describe, expect, it } from "vitest";
import { CAT_NAMES, CafeSim, catFree } from "./cats";
import { CAFE_FLOOR, CAFE_PATH, CAFE_RECT, CAFE_SOLIDS, CITY_RANGE, HIGHWAY_PILLARS, generateBuildings, segmentDistance, walkable } from "./world-map";

describe("café cats", () => {
  it("six cats, all starting somewhere free", () => {
    const sim = new CafeSim(1);
    expect(sim.cats.map((c) => c.name)).toEqual(CAT_NAMES);
    expect(CAT_NAMES).toHaveLength(6);
    for (const c of sim.cats) expect(catFree(c.x, c.z)).toBe(true);
  });

  it("never leave the café or walk into furniture, and do get around", () => {
    const sim = new CafeSim(3);
    const start = sim.cats.map((c) => [c.x, c.z]);
    const player = { x: 48, z: -46 };
    let moved = 0;
    for (let i = 0; i < 10_000; i++) {
      sim.step(1 / 30, player);
      for (const c of sim.cats) {
        expect(c.x).toBeGreaterThanOrEqual(CAFE_FLOOR.x0);
        expect(c.x).toBeLessThanOrEqual(CAFE_FLOOR.x1);
        expect(catFree(c.x, c.z), `${c.name} at ${c.x.toFixed(2)}, ${c.z.toFixed(2)}`).toBe(true);
      }
    }
    sim.cats.forEach((c, i) => (moved += Math.hypot(c.x - start[i][0], c.z - start[i][1]) > 1 ? 1 : 0));
    expect(moved).toBeGreaterThanOrEqual(3);
  });

  it("a petted cat stops, faces you and purrs, then settles", () => {
    const sim = new CafeSim(5);
    const c = sim.cats[2];
    const player = { x: c.x + 1, z: c.z };
    sim.pet(2);
    const x = c.x;
    for (let i = 0; i < 60; i++) sim.step(1 / 30, player);
    expect(c.mood).toBe("petted");
    expect(c.x).toBe(x);
    expect(c.purr).toBeGreaterThan(0);
    expect(Math.abs(Math.atan2(Math.sin(c.heading - Math.PI / 2), Math.cos(c.heading - Math.PI / 2)))).toBeLessThan(0.3);
    for (let i = 0; i < 150; i++) sim.step(1 / 30, player);
    expect(c.purr).toBe(0);
    expect(c.mood).not.toBe("petted");
  });

  it("is the same on every device", () => {
    const a = new CafeSim(9);
    const b = new CafeSim(9);
    for (let i = 0; i < 500; i++) {
      a.step(1 / 30, { x: 50, z: -50 });
      b.step(1 / 30, { x: 50, z: -50 });
    }
    expect(a.cats.map((c) => [c.x, c.z])).toEqual(b.cats.map((c) => [c.x, c.z]));
  });

  it("finds the nearest cat in reach", () => {
    const sim = new CafeSim(2);
    const c = sim.cats[4];
    expect(sim.nearest(c.x + 0.5, c.z, 1.6)).toBe(4);
    expect(sim.nearest(0, 0, 1.6)).toBe(-1);
  });
});

describe("café on the map", () => {
  it("the café floor, its doorway and the path from the ring are walkable", () => {
    expect(walkable(48, -50)).toBe(true);
    expect(walkable(48, -43)).toBe(true);
    expect(walkable(36, -36)).toBe(true);
    expect(walkable(40, -41)).toBe(true);
  });

  it("everything inside fits within the walls", () => {
    for (const s of CAFE_SOLIDS) {
      expect(s.x - s.w / 2).toBeGreaterThanOrEqual(CAFE_RECT.x0 - 0.31);
      expect(s.x + s.w / 2).toBeLessThanOrEqual(CAFE_RECT.x1 + 0.31);
    }
  });

  it("no building or highway pillar stands in the café or on its path", () => {
    const pad = 1;
    for (const b of generateBuildings(CITY_RANGE.high)) {
      const r = Math.hypot(b.w, b.d) / 2;
      const inCafe = b.x + r > CAFE_RECT.x0 - pad && b.x - r < CAFE_RECT.x1 + pad && b.z + r > CAFE_RECT.z0 - pad && b.z - r < CAFE_RECT.z1 + pad;
      expect(inCafe, `building at ${b.x.toFixed(1)}, ${b.z.toFixed(1)}`).toBe(false);
      expect(segmentDistance(b.x, b.z, CAFE_PATH.a, CAFE_PATH.b)).toBeGreaterThan(CAFE_PATH.half);
    }
    for (const [x, z] of HIGHWAY_PILLARS) expect(segmentDistance(x, z, CAFE_PATH.a, CAFE_PATH.b)).toBeGreaterThan(CAFE_PATH.half + 1);
  });
});
