import { describe, expect, it } from "vitest";
import { GRAVITY, KART_RADIUS, Terrain, WORLD_RADIUS, blinkTarget, findAnchor, forwardSpeed, launchVelocity, stepAir, stepGround, stepKart, stepSwing, type Body, type Kart } from "./motion";
import { ObstacleGrid, type Building } from "./world-map";

/** A small test city far from the plaza's landmarks: one 5 m block and one 0.4 m kerb. */
const X0 = 120;
function terrain() {
  const buildings: Building[] = [
    { x: X0, z: 0, w: 4, d: 4, h: 5, rot: 0, seed: 0 },
    { x: X0, z: 10, w: 4, d: 4, h: 0.4, rot: 0, seed: 0 },
  ];
  const g = new ObstacleGrid();
  for (const b of buildings) g.add(b.x, b.z, b.w, b.d, b.h, b.rot);
  return new Terrain(g, buildings);
}
const body = (x: number, y: number, z: number): Body => ({ x, y, z, vx: 0, vy: 0, vz: 0, grounded: true });

describe("motion", () => {
  it("a wall stops you walking into a building", () => {
    const t = terrain();
    const b = body(X0 - 6, 0, 0);
    for (let i = 0; i < 120; i++) stepGround(t, b, 5, 0, 1 / 60);
    expect(b.x).toBeLessThan(X0 - 2);
  });

  it("low kerbs are stepped onto without jumping", () => {
    const t = terrain();
    const b = body(X0 - 6, 0, 10);
    for (let i = 0; i < 120; i++) stepGround(t, b, 5, 0, 1 / 60);
    expect(b.x).toBeGreaterThan(X0);
    expect(b.grounded).toBe(true);
  });

  it("you can land on a roof, walk on it and fall off its edge", () => {
    const t = terrain();
    const b = body(X0, 9, 0);
    b.grounded = false;
    for (let i = 0; i < 120 && !b.grounded; i++) stepAir(t, b, 0, 0, 1 / 60);
    expect(b.grounded).toBe(true);
    expect(b.y).toBe(5);
    for (let i = 0; i < 60 && b.grounded; i++) stepGround(t, b, 5, 0, 1 / 60);
    expect(b.grounded).toBe(false);
    for (let i = 0; i < 200 && !b.grounded; i++) stepAir(t, b, 0, 0, 1 / 60);
    expect(b.y).toBe(0);
  });

  it("gliding caps the fall speed", () => {
    const t = terrain();
    const b = body(X0 + 40, 30, 0);
    b.grounded = false;
    for (let i = 0; i < 120; i++) stepAir(t, b, 0, 0, 1 / 60, { glide: true });
    expect(b.vy).toBeGreaterThanOrEqual(-2.5);
  });

  it("the grapple rope never stretches", () => {
    const t = terrain();
    const anchor: [number, number, number] = [X0 + 40, 20, 0];
    const b = body(X0 + 30, 8, 0);
    b.grounded = false;
    let len = 12;
    for (let i = 0; i < 240; i++) {
      len = stepSwing(t, b, anchor, len, 1, 0, 1 / 60);
      expect(Math.hypot(b.x - anchor[0], b.y + 1.6 - anchor[1], b.z - anchor[2])).toBeLessThanOrEqual(len + 1e-6);
    }
  });

  it("a launch lands on its target", () => {
    const from: [number, number, number] = [0, 0, 0];
    const to: [number, number, number] = [20, 6, -8];
    const time = 0.9;
    const [vx, vy0, vz] = launchVelocity(from, to, time);
    let vy = vy0;
    const p = [...from];
    const dt = 1 / 600;
    for (let s = 0; s < time; s += dt) {
      vy -= GRAVITY * dt;
      p[0] += vx * dt;
      p[1] += vy * dt;
      p[2] += vz * dt;
    }
    expect(p[0]).toBeCloseTo(20, 0);
    expect(p[1]).toBeCloseTo(6, 0);
    expect(p[2]).toBeCloseTo(-8, 0);
  });

  it("finds a rooftop ahead, or a drone in open sky", () => {
    const t = terrain();
    const ahead = findAnchor(t, X0 - 15, 0, 0, 1, 0);
    expect(ahead.drone).toBe(false);
    expect(ahead.point[1]).toBe(5);
    const behind = findAnchor(t, X0 - 15, 0, 0, -1, 0);
    expect(behind.drone).toBe(true);
  });

  it("the kart accelerates, turns, and stops at walls", () => {
    const t = terrain();
    const k: Kart = { ...body(X0 + 30, 0, 30), heading: 0, steer: 0, drifting: false };
    for (let i = 0; i < 120; i++) stepKart(t, k, 1, 0, false, 1 / 60);
    expect(forwardSpeed(k)).toBeGreaterThan(15);
    const h0 = k.heading;
    const x0 = k.x;
    for (let i = 0; i < 30; i++) stepKart(t, k, 1, 1, false, 1 / 60);
    // Steering right (D) from heading 0 (facing +z, camera behind): heading drops and the kart moves toward −x, screen right.
    expect(k.heading).toBeLessThan(h0);
    expect(k.x).toBeLessThan(x0);
    const wall: Kart = { ...body(X0 - 10, 0, 0), heading: Math.PI / 2, steer: 0, drifting: false };
    for (let i = 0; i < 300; i++) stepKart(t, wall, 1, 0, false, 1 / 60);
    expect(wall.x).toBeLessThan(X0 - 2);
  });

  it("powers aim inside the city even at its edge", () => {
    const t = terrain();
    const edge = findAnchor(t, WORLD_RADIUS - 4, 0, 0, 1, 0);
    expect(Math.hypot(edge.point[0], edge.point[2])).toBeLessThanOrEqual(WORLD_RADIUS - 2 + 1e-9);
  });

  it("blink stops short of a wall, further back for the kart", () => {
    const t = terrain();
    const b = body(X0 - 10, 0, 0);
    const [ax] = blinkTarget(t, b, 1, 0, 12);
    const [kx] = blinkTarget(t, b, 1, 0, 12, KART_RADIUS);
    expect(ax).toBeLessThan(X0 - 2);
    expect(kx).toBeLessThan(ax);
  });
});
