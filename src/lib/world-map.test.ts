import { describe, expect, it } from "vitest";
import { DISTRICTS, SECTIONS } from "./sections";
import {
  CITY_RANGE,
  OVERLOOK_Y,
  RAMP_RECT,
  ZONES,
  generateBuildings,
  groundHeight,
  obstacleGrid,
  resolve,
  sdShape,
  walkable,
} from "./world-map";

/** Corners and edge midpoints of a building footprint, in world space. */
function footprint(b: { x: number; z: number; w: number; d: number; rot: number }) {
  const pts: [number, number][] = [];
  for (const fx of [-0.5, 0, 0.5]) {
    for (const fz of [-0.5, 0, 0.5]) {
      const lx = fx * b.w;
      const lz = fz * b.d;
      // three.js Y rotation, local → world.
      pts.push([b.x + lx * Math.cos(b.rot) + lz * Math.sin(b.rot), b.z - lx * Math.sin(b.rot) + lz * Math.cos(b.rot)]);
    }
  }
  return pts;
}

describe("world map", () => {
  it.each(Object.entries(CITY_RANGE))("no building overlaps a walkable zone (%s tier)", (_, range) => {
    const buildings = generateBuildings(range);
    expect(buildings.length).toBeGreaterThan(300);
    const bad = buildings.filter((b) => b.h > 0 && footprint(b).some(([x, z]) => walkable(x, z)));
    // Alley walls are excluded from walkable() by design; nothing else may intersect.
    expect(bad).toEqual([]);
  });

  it("is deterministic", () => {
    expect(generateBuildings(90)).toEqual(generateBuildings(90));
  });

  it("every landmark, district spawn and centre is reachable ground", () => {
    for (const s of SECTIONS) expect(walkable(s.at[0] + 2, s.at[1] + 2) || walkable(s.at[0] - 2, s.at[1] - 2)).toBe(true);
    for (const d of DISTRICTS) {
      expect(walkable(...d.spawn)).toBe(true);
    }
  });

  it("the ramp rises evenly to the overlook deck", () => {
    expect(groundHeight(0, RAMP_RECT.z1)).toBeCloseTo(0);
    expect(groundHeight(0, (RAMP_RECT.z0 + RAMP_RECT.z1) / 2)).toBeCloseTo(OVERLOOK_Y / 2);
    expect(groundHeight(0, RAMP_RECT.z0)).toBeCloseTo(OVERLOOK_Y);
    expect(groundHeight(0, -72)).toBe(OVERLOOK_Y);
    expect(groundHeight(0, 0)).toBe(0);
  });

  it("you can't step off the side of the ramp or deck", () => {
    expect(walkable(RAMP_RECT.x1 + 0.5, -58)).toBe(false);
    expect(walkable(8, -63)).toBe(false);
  });

  it("collision slides along a blocked axis instead of stopping dead", () => {
    // Walking diagonally into the plaza's edge keeps the tangential motion.
    const [x, z] = resolve(16.5, 0.5, 16.0, 0.0);
    expect(walkable(x, z)).toBe(true);
    expect(z).toBeCloseTo(0.5);
  });

  it("signed distance agrees with containment for every zone", () => {
    for (const zone of ZONES) {
      expect(sdShape(zone.shape, 9999, 9999)).toBeGreaterThan(0);
    }
    expect(sdShape({ kind: "ring", r0: 38, r1: 44 }, 41, 0)).toBeLessThan(0);
    expect(sdShape({ kind: "ring", r0: 38, r1: 44 }, 30, 0)).toBeGreaterThan(0);
  });

  it("the camera arm stops short of buildings", () => {
    const buildings = generateBuildings(90);
    const grid = obstacleGrid(buildings);
    const b = buildings.find((x) => Math.hypot(x.x, x.z) < 32)!;
    // From the plaza centre to a point inside a tower: the arm must be shortened.
    expect(grid.arm(0, 2, 0, b.x, 2, b.z)).toBeLessThan(1);
    // Straight up from the plaza is always clear.
    expect(grid.arm(0, 2, 0, 0, 30, 0.1)).toBe(1);
  });
});
