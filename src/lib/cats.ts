/**
 * The café's six cats, as a small simulation: each wanders to a free spot on
 * the café floor, then sits, grooms, naps or watches you for a while. Petting
 * one stops it, turns it toward you and sets it purring. Pure and seeded, so
 * it's tested and the same on every device.
 */
import { CAFE_FLOOR, CAFE_SOLIDS, mulberry32 } from "./world-map";

export type CatMood = "walk" | "sit" | "groom" | "sleep" | "watch" | "petted";

export type CatLook = { fur: string; accent: string; eye: string; pattern: "solid" | "tabby" | "patches" | "mask" };

export type CafeCat = {
  name: string;
  look: CatLook;
  x: number;
  z: number;
  heading: number;
  mood: CatMood;
  /** Seconds left in the current mood. */
  t: number;
  tx: number;
  tz: number;
  speed: number;
  /** Seconds of purring and of hearts left. */
  purr: number;
  hearts: number;
};

export const CAT_RADIUS = 0.32;

/** Original cats with their own looks. */
const CATS: { name: string; look: CatLook }[] = [
  { name: "Mochi", look: { fur: "#e9e2d6", accent: "#c9b9a2", eye: "#7fd0ff", pattern: "mask" } },
  { name: "Tofu", look: { fur: "#f4f1ea", accent: "#f4f1ea", eye: "#ffc94a", pattern: "solid" } },
  { name: "Nori", look: { fur: "#15151b", accent: "#15151b", eye: "#ffb547", pattern: "solid" } },
  { name: "Pixel", look: { fur: "#d9822b", accent: "#9a4f12", eye: "#9be35b", pattern: "tabby" } },
  { name: "Kumo", look: { fur: "#8d929c", accent: "#5d626c", eye: "#ffd36a", pattern: "tabby" } },
  { name: "Byte", look: { fur: "#f2ece2", accent: "#2a2420", eye: "#6ad1a8", pattern: "patches" } },
];
export const CAT_NAMES = CATS.map((c) => c.name);

/** Is (x, z) a free spot on the café floor for a cat? */
export function catFree(x: number, z: number) {
  const f = CAFE_FLOOR;
  if (x < f.x0 || x > f.x1 || z < f.z0 || z > f.z1) return false;
  for (const s of CAFE_SOLIDS) {
    if ((s.y0 ?? 0) > 0.5) continue; // the roof
    if (Math.abs(x - s.x) < s.w / 2 + CAT_RADIUS && Math.abs(z - s.z) < s.d / 2 + CAT_RADIUS) return false;
  }
  return true;
}

export class CafeSim {
  cats: CafeCat[];
  private rand: () => number;

  constructor(seed = 21) {
    this.rand = mulberry32(seed);
    this.cats = CATS.map((c) => {
      const [x, z] = this.freeSpot();
      return { ...c, x, z, heading: this.rand() * Math.PI * 2, mood: "sit" as CatMood, t: 1 + this.rand() * 4, tx: x, tz: z, speed: 0.55 + this.rand() * 0.45, purr: 0, hearts: 0 };
    });
  }

  private freeSpot(): [number, number] {
    const f = CAFE_FLOOR;
    for (let i = 0; i < 200; i++) {
      const x = f.x0 + this.rand() * (f.x1 - f.x0);
      const z = f.z0 + this.rand() * (f.z1 - f.z0);
      if (catFree(x, z)) return [x, z];
    }
    return [(f.x0 + f.x1) / 2, (f.z0 + f.z1) / 2];
  }

  /** Pick what the cat does next. */
  private next(c: CafeCat, player: { x: number; z: number }) {
    const near = Math.hypot(player.x - c.x, player.z - c.z) < 6;
    const r = this.rand();
    if (r < 0.42) {
      const [x, z] = this.freeSpot();
      c.mood = "walk";
      c.tx = x;
      c.tz = z;
      c.t = 20;
    } else if (r < 0.6) {
      c.mood = "sit";
      c.t = 3 + this.rand() * 5;
    } else if (r < 0.72) {
      c.mood = "groom";
      c.t = 3 + this.rand() * 3;
    } else if (r < 0.86 || !near) {
      c.mood = "sleep";
      c.t = 8 + this.rand() * 12;
    } else {
      c.mood = "watch";
      c.t = 3 + this.rand() * 3;
    }
  }

  /** Advance every cat by dt seconds. `player` is the avatar's position (cats glance at it). */
  step(dt: number, player: { x: number; z: number }) {
    for (const c of this.cats) {
      c.purr = Math.max(0, c.purr - dt);
      c.hearts = Math.max(0, c.hearts - dt);
      c.t -= dt;
      if (c.mood === "walk") {
        const dx = c.tx - c.x;
        const dz = c.tz - c.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.15 || c.t <= 0) {
          this.next(c, player);
          continue;
        }
        const s = Math.min(d, c.speed * dt);
        const nx = c.x + (dx / d) * s;
        const nz = c.z + (dz / d) * s;
        // Turn smoothly toward the way it's walking.
        const want = Math.atan2(dx, dz);
        c.heading += Math.atan2(Math.sin(want - c.heading), Math.cos(want - c.heading)) * Math.min(1, dt * 6);
        if (catFree(nx, nz)) {
          c.x = nx;
          c.z = nz;
        } else this.next(c, player); // something in the way: do something else
        continue;
      }
      if (c.mood === "watch" || c.mood === "petted") {
        const want = Math.atan2(player.x - c.x, player.z - c.z);
        c.heading += Math.atan2(Math.sin(want - c.heading), Math.cos(want - c.heading)) * Math.min(1, dt * 4);
      }
      if (c.t <= 0) {
        if (c.mood === "petted") {
          c.mood = "sit";
          c.t = 3 + this.rand() * 3;
        } else this.next(c, player);
      }
    }
  }

  /** Pet cat i: it stops, looks at you and purrs. */
  pet(i: number) {
    const c = this.cats[i];
    if (!c) return;
    c.mood = "petted";
    c.t = 3.2;
    c.purr = 3.2;
    c.hearts = 1.8;
  }

  /** The nearest cat within `reach` of (x, z), or -1. */
  nearest(x: number, z: number, reach: number) {
    let best = -1;
    let bestD = reach;
    this.cats.forEach((c, i) => {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }
}
