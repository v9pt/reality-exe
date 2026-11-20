import { circleRect, mulberry32, type Evented, type GameLogic } from "./core";

/** Skyhop: a one-button gap runner. A courier drone threads signal pylons. */
export const W = 320;
export const H = 480;
export const GROUND = H - 56;
export const DRONE_X = 82;
export const DRONE_R = 11;
export const PYLON_W = 52;
export const GAP = 132;
export const SPACING = 186;
const GRAVITY = 1350;
const THRUST = -400;

export type Pylon = { x: number; gapY: number; scored: boolean };
export type State = Evented & {
  phase: "ready" | "play" | "over";
  y: number;
  vy: number;
  t: number;
  pylons: Pylon[];
  score: number;
  speed: number;
  rng: () => number;
};

export const create = (seed: number): State => ({
  phase: "ready",
  y: H * 0.42,
  vy: 0,
  t: 0,
  pylons: [],
  score: 0,
  speed: 140,
  rng: mulberry32(seed),
  events: [],
});

function spawn(s: State, x: number) {
  const margin = 70;
  s.pylons.push({ x, gapY: margin + GAP / 2 + s.rng() * (GROUND - margin * 2 - GAP), scored: false });
}

/** Courier rank earned for a score (null below the first). */
export function badge(score: number) {
  return score >= 100 ? "Ace" : score >= 50 ? "Pilot" : score >= 25 ? "Courier" : score >= 10 ? "Runner" : null;
}

export function hits(s: State) {
  if (s.y + DRONE_R >= GROUND || s.y - DRONE_R <= 0) return true;
  return s.pylons.some(
    (p) =>
      circleRect(DRONE_X, s.y, DRONE_R, p.x, -10, PYLON_W, p.gapY - GAP / 2 + 10) ||
      circleRect(DRONE_X, s.y, DRONE_R, p.x, p.gapY + GAP / 2, PYLON_W, GROUND - (p.gapY + GAP / 2)),
  );
}

export const skyhop: GameLogic<State> = {
  width: W,
  height: H,
  create,
  score: (s) => s.score,
  over: (s) => s.phase === "over",
  update(s, c, dt) {
    s.t += dt;
    const thrust = c.take("action") || c.take("up");
    if (s.phase === "ready") {
      s.y = H * 0.42 + Math.sin(s.t * 3) * 6;
      if (thrust) {
        s.phase = "play";
        s.vy = THRUST;
        s.events.push("flap");
        spawn(s, W + 40);
      }
      return;
    }
    if (s.phase === "over") {
      // The drone drops to the ground after a crash.
      if (s.y + DRONE_R < GROUND) {
        s.vy += GRAVITY * dt;
        s.y = Math.min(GROUND - DRONE_R, s.y + s.vy * dt);
      }
      return;
    }
    if (thrust) {
      s.vy = THRUST;
      s.events.push("flap");
    }
    s.vy = Math.min(s.vy + GRAVITY * dt, 620);
    s.y += s.vy * dt;
    s.speed = 140 + Math.min(s.score, 40) * 1.5;
    for (const p of s.pylons) {
      p.x -= s.speed * dt;
      if (!p.scored && p.x + PYLON_W < DRONE_X - DRONE_R) {
        p.scored = true;
        s.score++;
        s.events.push("score");
      }
    }
    if (s.pylons.length && s.pylons[0].x < -PYLON_W) s.pylons.shift();
    const last = s.pylons[s.pylons.length - 1];
    if (!last || last.x < W + 40 - SPACING) spawn(s, (last?.x ?? W) + SPACING);
    if (hits(s)) {
      s.phase = "over";
      s.vy = Math.max(s.vy, 0);
      s.events.push("hit");
    }
  },
};
