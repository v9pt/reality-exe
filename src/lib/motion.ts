/**
 * Movement physics for the avatar and the kart. Pure (no three.js), so it is
 * unit-tested and shared by the frame loop. The city is free roam: anything
 * that isn't a solid box is ground. Rooftops, the overlook ramp and deck and
 * the elevated highway are all surfaces you can land on.
 */
import { HIGHWAY_HALF, HIGHWAY_R, HIGHWAY_Y, SOLIDS, groundHeight, type Building, type ObstacleGrid } from "./world-map";

export const GRAVITY = 19;
/** Ledges lower than this are stepped up onto without jumping. */
export const STEP_UP = 0.6;
export const BODY_HEIGHT = 1.9;
export const AVATAR_RADIUS = 0.35;
export const KART_RADIUS = 0.95;
/** Beyond this distance from the plaza the city ends. */
export const WORLD_RADIUS = 230;

export type Body = { x: number; y: number; z: number; vx: number; vy: number; vz: number; grounded: boolean };

export class Terrain {
  constructor(
    readonly grid: ObstacleGrid,
    readonly buildings: Building[],
  ) {}

  /** Highest surface under (x, z) that a body with feet at `feet` can stand on. */
  support(x: number, z: number, feet: number) {
    const limit = feet + STEP_UP;
    let top = 0;
    const zone = groundHeight(x, z);
    if (zone <= limit) top = zone;
    const box = this.grid.topAt(x, z, limit, 0.15);
    if (box > top) top = box;
    const r = Math.hypot(x, z);
    if (Math.abs(r - HIGHWAY_R) <= HIGHWAY_HALF && HIGHWAY_Y <= limit && HIGHWAY_Y > top) top = HIGHWAY_Y;
    return top;
  }

  /** Is (x, z) blocked for a body of radius r with feet at `feet`? */
  blocked(x: number, z: number, feet: number, r: number) {
    if (Math.hypot(x, z) > WORLD_RADIUS) return true;
    if (groundHeight(x, z) > feet + STEP_UP) return true;
    if (this.grid.wallAt(x, z, feet, r, STEP_UP, BODY_HEIGHT)) return true;
    if (feet < 2.5) {
      for (const s of SOLIDS) if (Math.hypot(x - s.x, z - s.z) < s.r + r - AVATAR_RADIUS) return true;
    }
    return false;
  }

  /**
   * Move horizontally by (dx, dz) in small steps, sliding along walls.
   * Returns which axes were stopped so callers can kill that velocity.
   */
  slide(b: Body, dx: number, dz: number, r: number) {
    const dist = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(dist / 0.3));
    const sx = dx / steps;
    const sz = dz / steps;
    let hitX = false;
    let hitZ = false;
    for (let i = 0; i < steps; i++) {
      if (!hitX && !this.blocked(b.x + sx, b.z, b.y, r)) b.x += sx;
      else hitX = true;
      if (!hitZ && !this.blocked(b.x, b.z + sz, b.y, r)) b.z += sz;
      else hitZ = true;
    }
    return { hitX, hitZ };
  }
}

/** Walking or running on the ground at a target horizontal velocity. */
export function stepGround(t: Terrain, b: Body, wantVx: number, wantVz: number, dt: number, r = AVATAR_RADIUS) {
  b.vx = wantVx;
  b.vz = wantVz;
  t.slide(b, b.vx * dt, b.vz * dt, r);
  const top = t.support(b.x, b.z, b.y);
  if (top < b.y - STEP_UP) {
    // Walked off a ledge: fall.
    b.grounded = false;
    b.vy = 0;
  } else {
    // Small drops (kerbs, ramps) are stepped down onto.
    b.y = top;
    b.vy = 0;
  }
}

/**
 * Airborne: gravity, a little steering, optional gliding. Lands on whatever
 * surface is underneath. Returns the landing speed (0 when still in the air).
 */
export function stepAir(t: Terrain, b: Body, steerX: number, steerZ: number, dt: number, opts: { glide?: boolean; r?: number; control?: number } = {}) {
  const r = opts.r ?? AVATAR_RADIUS;
  const control = opts.control ?? 6;
  b.vx += steerX * control * dt;
  b.vz += steerZ * control * dt;
  b.vy -= GRAVITY * dt;
  if (opts.glide && b.vy < -2.5) b.vy = -2.5;
  const hit = t.slide(b, b.vx * dt, b.vz * dt, r);
  if (hit.hitX) b.vx = 0;
  if (hit.hitZ) b.vz = 0;
  const top = t.support(b.x, b.z, b.y);
  const next = b.y + b.vy * dt;
  if (b.vy <= 0 && next <= top) {
    const impact = -b.vy;
    b.y = top;
    b.vy = 0;
    b.grounded = true;
    return impact;
  }
  // Rising into a solid box from below stops the climb.
  if (b.vy > 0 && t.grid.wallAt(b.x, b.z, next, r, 0, BODY_HEIGHT)) b.vy = 0;
  else b.y = next;
  return 0;
}

/**
 * Grapple swing: a pendulum on a rope of length `len` from `anchor`. `push`
 * is the visitor's input in world space; the rope reels in slowly so each
 * swing gains height. Returns the new rope length.
 */
export function stepSwing(t: Terrain, b: Body, anchor: [number, number, number], len: number, pushX: number, pushZ: number, dt: number, reel = 3) {
  b.vy -= GRAVITY * dt;
  b.vx += pushX * 14 * dt;
  b.vz += pushZ * 14 * dt;
  // Gentle air drag keeps it controllable.
  const drag = Math.exp(-0.15 * dt);
  b.vx *= drag;
  b.vz *= drag;
  const hit = t.slide(b, b.vx * dt, b.vz * dt, AVATAR_RADIUS);
  if (hit.hitX) b.vx *= -0.2;
  if (hit.hitZ) b.vz *= -0.2;
  b.y += b.vy * dt;
  // Rope constraint, measured from the hands (about 1.6 m above the feet).
  const dx = b.x - anchor[0];
  const dy = b.y + 1.6 - anchor[1];
  const dz = b.z - anchor[2];
  const d = Math.hypot(dx, dy, dz);
  const L = Math.max(4, len - reel * dt);
  if (d > L) {
    const nx = dx / d;
    const ny = dy / d;
    const nz = dz / d;
    b.x = anchor[0] + nx * L;
    b.y = anchor[1] + ny * L - 1.6;
    b.z = anchor[2] + nz * L;
    const radial = b.vx * nx + b.vy * ny + b.vz * nz;
    if (radial > 0) {
      b.vx -= radial * nx;
      b.vy -= radial * ny;
      b.vz -= radial * nz;
    }
  }
  const top = t.support(b.x, b.z, b.y);
  if (b.y < top) {
    b.y = top;
    if (b.vy < 0) b.vy = 0;
  }
  return L;
}

/** Velocity that carries a body from `from` to `to` in `time` seconds under gravity. */
export function launchVelocity(from: [number, number, number], to: [number, number, number], time: number): [number, number, number] {
  return [(to[0] - from[0]) / time, (to[1] - from[1]) / time + 0.5 * GRAVITY * time, (to[2] - from[2]) / time];
}

/**
 * A grapple anchor ahead of the avatar: the nearest rooftop edge to an ideal
 * point up and in front. With no building in reach, a hovering courier drone
 * catches the line in open sky (`drone: true`).
 */
export function findAnchor(t: Terrain, x: number, feet: number, z: number, fx: number, fz: number, opts: { reach?: number; minRise?: number; lift?: number } = {}) {
  const reach = opts.reach ?? 18;
  const lift = opts.lift ?? 13;
  const minRise = opts.minRise ?? 4;
  const ideal: [number, number, number] = clampToWorld([x + fx * reach, feet + lift, z + fz * reach]);
  let best: { p: [number, number, number]; score: number } | null = null;
  for (const b of t.buildings) {
    const ddx = b.x - x;
    const ddz = b.z - z;
    const dist = Math.hypot(ddx, ddz);
    if (dist < 6 || dist > reach * 2.2) continue;
    if ((ddx * fx + ddz * fz) / dist < 0.35) continue; // must be ahead
    if (b.h < feet + minRise) continue;
    // Closest point of the roof to the avatar, so the line catches the near edge.
    const c = Math.cos(b.rot);
    const s = Math.sin(b.rot);
    const lx = Math.max(-b.w / 2, Math.min(b.w / 2, -ddx * c + ddz * s));
    const lz = Math.max(-b.d / 2, Math.min(b.d / 2, -ddx * s - ddz * c));
    const px = b.x + lx * c + lz * s;
    const pz = b.z - lx * s + lz * c;
    const py = Math.min(b.h, feet + lift + 10);
    const score = Math.hypot(px - ideal[0], py - ideal[1], pz - ideal[2]);
    if (Math.hypot(px, pz) > WORLD_RADIUS - 2) continue;
    if (!best || score < best.score) best = { p: [px, py, pz], score };
  }
  if (best && best.score < reach * 1.4) return { point: best.p, drone: false };
  return { point: ideal, drone: true };
}

/** Keep a target point inside the city, so powers behave the same at its edge. */
export function clampToWorld(p: [number, number, number]): [number, number, number] {
  const r = Math.hypot(p[0], p[2]);
  const max = WORLD_RADIUS - 2;
  if (r <= max) return p;
  return [(p[0] / r) * max, p[1], (p[2] / r) * max];
}

/** The farthest free spot up to `dist` along a direction (for the blink dash). */
export function blinkTarget(t: Terrain, b: Body, fx: number, fz: number, dist: number, r = AVATAR_RADIUS): [number, number] {
  let ok: [number, number] = [b.x, b.z];
  for (let d = 0.25; d <= dist; d += 0.25) {
    const x = b.x + fx * d;
    const z = b.z + fz * d;
    if (t.blocked(x, z, b.y, r)) break;
    ok = [x, z];
  }
  return ok;
}

/* ───────────────────────── Kart ───────────────────────── */

export type Kart = Body & { heading: number; steer: number; drifting: boolean };

export const KART = { maxSpeed: 30, reverse: 9, accel: 20, brake: 34, drag: 0.6, grip: 9, driftGrip: 1.6, turn: 2.5 };

/** Speed along the kart's nose (negative when reversing). */
export const forwardSpeed = (k: Kart) => k.vx * Math.sin(k.heading) + k.vz * Math.cos(k.heading);

/**
 * Arcade kart handling: throttle and brake along the nose, steering that
 * scales with speed, and side grip that lets go while drifting.
 */
export function stepKart(t: Terrain, k: Kart, throttle: number, steer: number, drift: boolean, dt: number, boost = 1) {
  const fx = Math.sin(k.heading);
  const fz = Math.cos(k.heading);
  let v = k.vx * fx + k.vz * fz;
  const latX = k.vx - fx * v;
  const latZ = k.vz - fz * v;

  if (k.grounded) {
    if (throttle > 0) v += (v < 0 ? KART.brake : KART.accel * boost) * throttle * dt;
    else if (throttle < 0) v += (v > 0 ? -KART.brake : -KART.accel * 0.6) * -throttle * dt;
    v -= v * KART.drag * dt;
    v = Math.max(-KART.reverse, Math.min(KART.maxSpeed * boost, v));
    // Steering: none at a standstill, sharpest at mid speed, reversed when backing up.
    k.steer += (steer - k.steer) * Math.min(1, dt * 10);
    const speedFactor = Math.min(1, Math.abs(v) / 6) * (1 - Math.min(0.45, Math.abs(v) / 80));
    // Forward is (sin h, cos h), so steering right (+1) lowers the heading.
    k.heading -= k.steer * KART.turn * speedFactor * Math.sign(v || 1) * (drift ? 1.35 : 1) * dt;
    k.drifting = drift && Math.abs(v) > 8;
    const grip = Math.exp(-(k.drifting ? KART.driftGrip : KART.grip) * dt);
    const nfx = Math.sin(k.heading);
    const nfz = Math.cos(k.heading);
    k.vx = nfx * v + latX * grip;
    k.vz = nfz * v + latZ * grip;
    const hit = t.slide(k, k.vx * dt, k.vz * dt, KART_RADIUS);
    if (hit.hitX) k.vx *= -0.3;
    if (hit.hitZ) k.vz *= -0.3;
    const top = t.support(k.x, k.z, k.y);
    if (top < k.y - STEP_UP) {
      k.grounded = false;
      k.vy = 0;
    } else k.y = top;
    return 0;
  }
  return stepAir(t, k, 0, 0, dt, { r: KART_RADIUS, control: 0 });
}
