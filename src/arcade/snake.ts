import { mulberry32, type Evented, type GameLogic } from "./core";

/** Signal Snake: grow a trace by collecting packets. */
export const COLS = 20;
export const ROWS = 20;
export const CELL = 16;

export type Dir = "up" | "down" | "left" | "right";
const V: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPP: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

export type State = Evented & {
  body: [number, number][];
  dir: Dir;
  queue: Dir[];
  food: [number, number];
  timer: number;
  score: number;
  dead: boolean;
  started: boolean;
  rng: () => number;
};

export function placeFood(s: Pick<State, "body" | "rng">): [number, number] {
  const free: [number, number][] = [];
  for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) if (!s.body.some(([bx, by]) => bx === x && by === y)) free.push([x, y]);
  return free[Math.floor(s.rng() * free.length)] ?? [0, 0];
}

export function create(seed: number): State {
  const s: State = {
    body: [
      [6, 10],
      [5, 10],
      [4, 10],
    ],
    dir: "right",
    queue: [],
    food: [0, 0],
    timer: 0,
    score: 0,
    dead: false,
    started: false,
    rng: mulberry32(seed),
    events: [],
  };
  s.food = placeFood(s);
  return s;
}

/** Seconds per step: faster as the trace grows. */
export const interval = (len: number) => Math.max(0.055, 0.13 - (len - 3) * 0.0025);

export function turn(s: State, d: Dir) {
  const last = s.queue[s.queue.length - 1] ?? s.dir;
  if (d !== last && d !== OPP[last] && s.queue.length < 2) s.queue.push(d);
  s.started = true;
}

export function step(s: State) {
  const next = s.queue.shift();
  if (next) s.dir = next;
  const [dx, dy] = V[s.dir];
  const [hx, hy] = s.body[0];
  const head: [number, number] = [hx + dx, hy + dy];
  const grow = head[0] === s.food[0] && head[1] === s.food[1];
  const body = grow ? s.body : s.body.slice(0, -1);
  if (head[0] < 0 || head[1] < 0 || head[0] >= COLS || head[1] >= ROWS || body.some(([x, y]) => x === head[0] && y === head[1])) {
    s.dead = true;
    s.events.push("hit");
    return;
  }
  s.body = [head, ...body];
  if (grow) {
    s.score += 10;
    s.events.push("score");
    s.food = placeFood(s);
  }
}

export const snake: GameLogic<State> = {
  width: COLS * CELL,
  height: ROWS * CELL,
  create,
  score: (s) => s.score,
  over: (s) => s.dead,
  update(s, c, dt) {
    if (s.dead) return;
    for (const d of ["up", "down", "left", "right"] as Dir[]) if (c.take(d)) turn(s, d);
    if (!s.started) return;
    s.timer += dt;
    const iv = interval(s.body.length);
    while (s.timer >= iv && !s.dead) {
      s.timer -= iv;
      step(s);
    }
  },
};
