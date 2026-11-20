/**
 * The shape of District V9 as data. Rendering (ground texture, buildings,
 * minimap, flat map), avatar collision and the camera all read this module,
 * so what you see and where you can walk can never disagree.
 *
 * Pure: no three.js, no DOM. Unit-tested in world-map.test.ts.
 */
import { BACKROOM_AT, SECTIONS } from "./sections";

export type Vec2 = [number, number];

export type Shape =
  | { kind: "circle"; x: number; z: number; r: number }
  | { kind: "rect"; x0: number; x1: number; z0: number; z1: number }
  | { kind: "ring"; r0: number; r1: number }
  | { kind: "segment"; a: Vec2; b: Vec2; half: number };

/** Height of a zone's surface: flat, or a linear ramp along one axis. */
export type Surface = { y: number } | { ramp: { axis: "x" | "z"; from: number; to: number; y0: number; y1: number } };

export type Zone = { id: string; shape: Shape; surface?: Surface };

/* ───────────────────────── Layout ───────────────────────── */

export const PLAZA_R = 16.2;
export const AVENUE_HALF = 3.2;
export const RING_R0 = 38;
export const RING_R1 = 44;
export const HIGHWAY_R = 52;
export const HIGHWAY_HALF = 3.5;
export const HIGHWAY_Y = 9;
export const OVERLOOK_Y = 6;

export const ALLEY_FROM: Vec2 = [-10.8, -11.6];
export const ALLEY_TO: Vec2 = BACKROOM_AT;
export const ALLEY_HALF_WIDTH = 1.5;
export const BACKROOM_R = 3.6;

export const ARCADE_RECT = { x0: 56, x1: 78, z0: -13, z1: 13 };
export const GARDEN = { x: -66, z: 0, r: 14 };
export const POND = { x: -69, z: 3.5, r: 4 };
export const RAMP_RECT = { x0: -AVENUE_HALF, x1: AVENUE_HALF, z0: -64, z1: -52 };
export const OVERLOOK_RECT = { x0: -11, x1: 11, z0: -80, z1: -64 };

export const ZONES: Zone[] = [
  { id: "plaza", shape: { kind: "circle", x: 0, z: 0, r: PLAZA_R } },
  { id: "ring", shape: { kind: "ring", r0: RING_R0, r1: RING_R1 } },
  { id: "avenue-e", shape: { kind: "rect", x0: 14, x1: ARCADE_RECT.x0 + 0.5, z0: -AVENUE_HALF, z1: AVENUE_HALF } },
  { id: "avenue-w", shape: { kind: "rect", x0: GARDEN.x + GARDEN.r - 1, x1: -14, z0: -AVENUE_HALF, z1: AVENUE_HALF } },
  { id: "avenue-s", shape: { kind: "rect", x0: -AVENUE_HALF, x1: AVENUE_HALF, z0: 14, z1: 50 } },
  { id: "avenue-n", shape: { kind: "rect", x0: -AVENUE_HALF, x1: AVENUE_HALF, z0: RAMP_RECT.z1, z1: -14 } },
  {
    id: "ramp",
    shape: { kind: "rect", ...RAMP_RECT },
    surface: { ramp: { axis: "z", from: RAMP_RECT.z1, to: RAMP_RECT.z0, y0: 0, y1: OVERLOOK_Y } },
  },
  { id: "overlook", shape: { kind: "rect", ...OVERLOOK_RECT }, surface: { y: OVERLOOK_Y } },
  { id: "arcade", shape: { kind: "rect", ...ARCADE_RECT } },
  { id: "garden", shape: { kind: "circle", ...GARDEN } },
  { id: "alley", shape: { kind: "segment", a: ALLEY_FROM, b: ALLEY_TO, half: ALLEY_HALF_WIDTH } },
  { id: "backroom", shape: { kind: "circle", x: BACKROOM_AT[0], z: BACKROOM_AT[1], r: BACKROOM_R } },
];

/** Overall extent the maps draw (world units, square, centred on the plaza). */
export const MAP_HALF = 96;

/* ───────────────────────── Geometry helpers ───────────────────────── */

export function distToSegment(px: number, pz: number, a: Vec2, b: Vec2) {
  const abx = b[0] - a[0];
  const abz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * abx + (pz - a[1]) * abz) / (abx * abx + abz * abz)));
  return Math.hypot(px - (a[0] + abx * t), pz - (a[1] + abz * t));
}

/** Signed distance from a point to a shape: negative inside, positive outside. */
export function sdShape(s: Shape, x: number, z: number): number {
  switch (s.kind) {
    case "circle":
      return Math.hypot(x - s.x, z - s.z) - s.r;
    case "ring": {
      const r = Math.hypot(x, z);
      const mid = (s.r0 + s.r1) / 2;
      return Math.abs(r - mid) - (s.r1 - s.r0) / 2;
    }
    case "segment":
      return distToSegment(x, z, s.a, s.b) - s.half;
    case "rect": {
      const cx = (s.x0 + s.x1) / 2;
      const cz = (s.z0 + s.z1) / 2;
      const dx = Math.abs(x - cx) - (s.x1 - s.x0) / 2;
      const dz = Math.abs(z - cz) - (s.z1 - s.z0) / 2;
      const ox = Math.max(dx, 0);
      const oz = Math.max(dz, 0);
      return Math.hypot(ox, oz) + Math.min(Math.max(dx, dz), 0);
    }
  }
}

/** Distance to the nearest walkable zone (negative when inside one). */
export function sdWalk(x: number, z: number) {
  let d = Infinity;
  for (const zone of ZONES) d = Math.min(d, sdShape(zone.shape, x, z));
  return d;
}

function surfaceY(s: Surface | undefined, x: number, z: number) {
  if (!s) return 0;
  if ("y" in s) return s.y;
  const { axis, from, to, y0, y1 } = s.ramp;
  const v = axis === "x" ? x : z;
  const t = Math.max(0, Math.min(1, (v - from) / (to - from)));
  return y0 + (y1 - y0) * t;
}

/** Height of the walkable surface under a point (0 off the map). */
export function groundHeight(x: number, z: number) {
  let y = 0;
  for (const zone of ZONES) {
    if (zone.surface && sdShape(zone.shape, x, z) <= 0) y = Math.max(y, surfaceY(zone.surface, x, z));
  }
  return y;
}

/* ───────────────────────── Solids ───────────────────────── */

/** Building blocks that frame the back alley. Placed clear of the alley path; solid to the avatar. */
export const ALLEY_WALLS: { x: number; z: number; half: number; h: number }[] = [
  [-4.8, 0.6, 11],
  [0.4, -4.8, 14],
  [-3.6, -3.6, 16],
  [-1.6, 4.6, 10],
  [3.4, -3.4, 12],
].map(([ox, oz, h]) => ({ x: BACKROOM_AT[0] + ox, z: BACKROOM_AT[1] + oz, half: 1.6, h }));

/** Arcade cabinets along the back of the strip, facing the entrance. */
export const CABINET_X = ARCADE_RECT.x1 - 3.4;
export const CABINET_Z = [-7.5, -2.5, 2.5, 7.5];

/** Trees in the garden: a ring around the pond, leaving the avenue entrance open. */
export const TREES: Vec2[] = (() => {
  const out: Vec2[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.2;
    // The avenue enters from +x: keep that side clear.
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.45) continue;
    const r = 10.2 + (i % 3) * 0.9;
    out.push([GARDEN.x + Math.cos(a) * r, GARDEN.z + Math.sin(a) * r]);
  }
  return out;
})();

/** The plaza jukebox, between the light shrine and the record tower. */
export const JUKEBOX_AT: Vec2 = [12.8, 1.2];

/** Gate posts at the garden entrance. */
export const GATE_POSTS: Vec2[] = [
  [GARDEN.x + GARDEN.r - 1.5, -2.6],
  [GARDEN.x + GARDEN.r - 1.5, 2.6],
];

/** Round obstacles the avatar is pushed out of. */
export const SOLIDS: { x: number; z: number; r: number }[] = [
  ...SECTIONS.map((s) => ({ x: s.at[0], z: s.at[1], r: 1.5 })),
  ...CABINET_Z.map((z) => ({ x: CABINET_X, z, r: 1.0 })),
  { x: POND.x, z: POND.z, r: POND.r },
  ...TREES.map(([x, z]) => ({ x, z, r: 0.45 })),
  ...GATE_POSTS.map(([x, z]) => ({ x, z, r: 0.35 })),
  { x: JUKEBOX_AT[0], z: JUKEBOX_AT[1], r: 0.8 },
  // Telescope on the overlook.
  { x: 0, z: OVERLOOK_RECT.z0 + 3, r: 0.7 },
];

function inWall(x: number, z: number) {
  const r = 0.35; // avatar radius
  return ALLEY_WALLS.some((w) => Math.abs(x - w.x) < w.half + r && Math.abs(z - w.z) < w.half + r);
}

export function inBackroom(x: number, z: number) {
  return Math.hypot(x - BACKROOM_AT[0], z - BACKROOM_AT[1]) < BACKROOM_R;
}

export function walkable(x: number, z: number) {
  if (inWall(x, z)) return false;
  return sdWalk(x, z) <= 0;
}

/** Collision for one step: push out of solids, then slide along whichever axis is still walkable. */
export function resolve(x: number, z: number, px: number, pz: number): Vec2 {
  let nx = x;
  let nz = z;
  for (const s of SOLIDS) {
    const dx = nx - s.x;
    const dz = nz - s.z;
    const d = Math.hypot(dx, dz);
    if (d < s.r && d > 0.0001) {
      nx = s.x + (dx / d) * s.r;
      nz = s.z + (dz / d) * s.r;
    }
  }
  if (walkable(nx, nz)) return [nx, nz];
  if (walkable(nx, pz)) return [nx, pz];
  if (walkable(px, nz)) return [px, nz];
  return [px, pz];
}

/* ───────────────────────── Buildings ───────────────────────── */

export type Building = { x: number; z: number; w: number; d: number; h: number; rot: number; seed: number };

export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Half-diagonal of a footprint: the radius that bounds it at any rotation. */
export const footprintRadius = (b: Pick<Building, "w" | "d">) => Math.hypot(b.w, b.d) / 2;

/** Building ranges per quality tier. Beyond the range, a sparse skyline ring keeps the horizon full. */
export const CITY_RANGE = { low: 90, medium: 120, high: 150 } as const;
export const SKYLINE_DEPTH = 70;

function clearForBuilding(x: number, z: number, radius: number) {
  if (sdWalk(x, z) < radius + 1.2) return false;
  if (Math.abs(Math.hypot(x, z) - HIGHWAY_R) < HIGHWAY_HALF + radius + 1) return false;
  if (Math.hypot(x - BACKROOM_AT[0], z - BACKROOM_AT[1]) < 7.5) return false;
  if (ALLEY_WALLS.some((w) => Math.hypot(x - w.x, z - w.z) < radius + w.half * 1.5)) return false;
  return true;
}

/**
 * Deterministic city blocks for a given range. Same seed, same city, on
 * every device and in every test.
 */
export function generateBuildings(range: number): Building[] {
  const rand = mulberry32(9);
  const out: Building[] = [];
  const step = 7.2;
  for (let gx = -range; gx <= range; gx += step) {
    for (let gz = -range; gz <= range; gz += step) {
      const x = gx + (rand() - 0.5) * 2.4;
      const z = gz + (rand() - 0.5) * 2.4;
      const near = Math.hypot(x, z) < 32;
      const h = near ? 7 + rand() * 16 : 14 + rand() * rand() * 70;
      const w = 3.8 + rand() * 2.6;
      const d = 3.8 + rand() * 2.6;
      const rot = near ? Math.atan2(x, z) : rand() < 0.3 ? rand() * 0.6 : 0;
      const seed = rand();
      const r = Math.hypot(x, z);
      if (r < 21 || r > range) continue;
      if (!clearForBuilding(x, z, footprintRadius({ w, d }))) continue;
      out.push({ x, z, w, d, h, rot, seed });
    }
  }
  // Skyline: fewer, larger towers past the detailed city.
  const far = mulberry32(31);
  const fstep = 13;
  const outer = range + SKYLINE_DEPTH;
  for (let gx = -outer; gx <= outer; gx += fstep) {
    for (let gz = -outer; gz <= outer; gz += fstep) {
      const x = gx + (far() - 0.5) * 5;
      const z = gz + (far() - 0.5) * 5;
      const r = Math.hypot(x, z);
      const h = 30 + far() * far() * 120;
      const w = 7 + far() * 5;
      const d = 7 + far() * 5;
      const seed = far();
      if (r <= range + 6 || r > outer) continue;
      out.push({ x, z, w, d, h, rot: 0, seed });
    }
  }
  // Alley walls are buildings too (shared with collision).
  const wallRand = mulberry32(42);
  for (const w of ALLEY_WALLS) out.push({ x: w.x, z: w.z, w: w.half * 2, d: w.half * 2, h: w.h, rot: 0, seed: wallRand() });
  return out;
}

/* ───────────────────────── Camera obstacles ───────────────────────── */

type Box = { x: number; z: number; hw: number; hd: number; h: number; cos: number; sin: number; y0: number };

/** A coarse grid of boxes the camera must not enter. */
export class ObstacleGrid {
  private cells = new Map<number, Box[]>();
  constructor(private cell = 10) {}

  private key(ix: number, iz: number) {
    return (ix + 512) * 1024 + (iz + 512);
  }

  add(x: number, z: number, w: number, d: number, h: number, rot = 0, y0 = 0) {
    const box: Box = { x, z, hw: w / 2, hd: d / 2, h, cos: Math.cos(rot), sin: Math.sin(rot), y0 };
    const r = Math.hypot(w, d) / 2;
    const c = this.cell;
    for (let ix = Math.floor((x - r) / c); ix <= Math.floor((x + r) / c); ix++) {
      for (let iz = Math.floor((z - r) / c); iz <= Math.floor((z + r) / c); iz++) {
        const k = this.key(ix, iz);
        const list = this.cells.get(k);
        if (list) list.push(box);
        else this.cells.set(k, [box]);
      }
    }
  }

  /** Is the point inside any box (grown by `pad`)? */
  hit(x: number, y: number, z: number, pad = 0.4) {
    const list = this.cells.get(this.key(Math.floor(x / this.cell), Math.floor(z / this.cell)));
    if (!list) return false;
    for (const b of list) {
      if (y > b.h + pad || y < b.y0 - pad) continue;
      // Rotate into the box's frame (three.js Y rotation).
      const dx = x - b.x;
      const dz = z - b.z;
      const lx = dx * b.cos - dz * b.sin;
      const lz = dx * b.sin + dz * b.cos;
      if (Math.abs(lx) < b.hw + pad && Math.abs(lz) < b.hd + pad) return true;
    }
    return false;
  }

  /**
   * Spring arm: how far along target → camera the camera can sit before it
   * would enter a box. Returns a fraction in [0, 1].
   */
  arm(tx: number, ty: number, tz: number, cx: number, cy: number, cz: number, steps = 18) {
    let safe = 1;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = tx + (cx - tx) * t;
      const y = ty + (cy - ty) * t;
      const z = tz + (cz - tz) * t;
      if (y < groundHeight(x, z) + 0.5 || this.hit(x, y, z)) {
        safe = Math.max(0.08, (i - 1) / steps);
        break;
      }
    }
    return safe;
  }
}

export function obstacleGrid(buildings: Building[]) {
  const g = new ObstacleGrid();
  for (const b of buildings) g.add(b.x, b.z, b.w, b.d, b.h, b.rot);
  // The overlook platform is solid below its deck.
  const o = OVERLOOK_RECT;
  g.add((o.x0 + o.x1) / 2, (o.z0 + o.z1) / 2, o.x1 - o.x0, o.z1 - o.z0, OVERLOOK_Y - 0.6);
  return g;
}

/* ───────────────────────── Drawing (2D canvas) ───────────────────────── */

type Ctx = Pick<
  CanvasRenderingContext2D,
  "beginPath" | "arc" | "rect" | "moveTo" | "lineTo" | "fill" | "stroke" | "closePath" | "save" | "restore" | "translate" | "rotate"
> & { lineWidth: number; lineCap: CanvasLineCap; fillStyle: string | CanvasGradient | CanvasPattern; strokeStyle: string | CanvasGradient | CanvasPattern; globalCompositeOperation: GlobalCompositeOperation };

/** Paints every walkable zone filled with the current fill style, in world units. */
export function fillZones(g: Ctx) {
  for (const zone of ZONES) {
    const s = zone.shape;
    g.beginPath();
    if (s.kind === "circle") g.arc(s.x, s.z, s.r, 0, Math.PI * 2);
    else if (s.kind === "rect") g.rect(s.x0, s.z0, s.x1 - s.x0, s.z1 - s.z0);
    else if (s.kind === "ring") {
      g.arc(0, 0, s.r1, 0, Math.PI * 2);
      g.moveTo(s.r0, 0);
      g.arc(0, 0, s.r0, 0, Math.PI * 2, true);
    } else {
      // Capsule along the segment.
      const [ax, az] = s.a;
      const [bx, bz] = s.b;
      const ang = Math.atan2(bz - az, bx - ax);
      g.arc(ax, az, s.half, ang + Math.PI / 2, ang - Math.PI / 2);
      g.arc(bx, bz, s.half, ang - Math.PI / 2, ang + Math.PI / 2);
      g.closePath();
    }
    g.fill();
  }
}
