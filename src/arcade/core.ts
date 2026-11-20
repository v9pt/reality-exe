/**
 * Shared pieces for the arcade games. Game logic is pure and deterministic:
 * `create(seed)` builds a state, `update(state, controls, dt)` advances it by
 * one fixed step. Rendering and input live in components/arcade.
 */
export type Btn = "left" | "right" | "up" | "down" | "action" | "alt" | "alt2";
export const BUTTONS: Btn[] = ["left", "right", "up", "down", "action", "alt", "alt2"];

export type Controls = {
  held: Record<Btn, boolean>;
  /** True once per press since the last call (taps between steps are never lost). */
  take(b: Btn): boolean;
  /** Absolute pointer position in game units (touch steering), or null. */
  pointerX: number | null;
};

export interface GameLogic<S> {
  width: number;
  height: number;
  create(seed: number): S;
  update(s: S, c: Controls, dt: number): void;
  score(s: S): number;
  over(s: S): boolean;
}

/** Things that happened this step, for sound. Drained by the runtime. */
export type Evented = { events: string[] };

export const STEP = 1 / 60;

export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Controls for tests and for replaying scripted input. */
export function scripted(pressed: Partial<Record<Btn, number>> = {}, held: Partial<Record<Btn, boolean>> = {}): Controls & { press(b: Btn): void } {
  const taps: Partial<Record<Btn, number>> = { ...pressed };
  const h = Object.fromEntries(BUTTONS.map((b) => [b, !!held[b]])) as Record<Btn, boolean>;
  return {
    held: h,
    pointerX: null,
    take(b) {
      if (!taps[b]) return false;
      taps[b]!--;
      return true;
    },
    press(b) {
      taps[b] = (taps[b] ?? 0) + 1;
    },
  };
}

export function circleRect(cx: number, cy: number, r: number, x: number, y: number, w: number, h: number) {
  const nx = Math.max(x, Math.min(cx, x + w));
  const ny = Math.max(y, Math.min(cy, y + h));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}
