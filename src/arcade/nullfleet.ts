import { mulberry32, type Evented, type GameLogic } from "./core";

/** Null Fleet: a fixed shooter against a descending formation of corrupted packets. */
export const W = 336;
export const H = 384;
export const ROWS = 4;
export const COLS = 8;
export const EW = 18;
export const EH = 14;
export const GAP_X = 30;
export const GAP_Y = 26;
export const SHIP_Y = H - 28;
export const SHIP_W = 24;
export const CELL = 4;
export const SHIELD_COLS = 18;
export const SHIELD_ROWS = 3;
/** Cores are worth most, then diamonds, then rings. */
export const ROW_POINTS = [40, 25, 15, 10];

export type Shot = { x: number; y: number };
export type Shield = { x: number; y: number; cells: boolean[] };
export type State = Evented & {
  ship: number;
  lives: number;
  invuln: number;
  shot: Shot | null;
  enemyShots: Shot[];
  alive: boolean[];
  fx: number;
  fy: number;
  dir: 1 | -1;
  stepTimer: number;
  fireTimer: number;
  shields: Shield[];
  wave: number;
  score: number;
  dead: boolean;
  t: number;
  rng: () => number;
};

const startY = (wave: number) => 48 + Math.min((wave - 1) * 10, 50);

/** Three low firewall bars: wide and thin, eroded cell by cell. */
function makeShields(): Shield[] {
  return [0, 1, 2].map((i) => ({
    x: 30 + i * 102,
    y: SHIP_Y - 48,
    cells: Array(SHIELD_COLS * SHIELD_ROWS).fill(true),
  }));
}

export function create(seed: number): State {
  return {
    ship: W / 2,
    lives: 3,
    invuln: 0,
    shot: null,
    enemyShots: [],
    alive: Array(ROWS * COLS).fill(true),
    fx: 36,
    fy: startY(1),
    dir: 1,
    stepTimer: 0,
    fireTimer: 1.2,
    shields: makeShields(),
    wave: 1,
    score: 0,
    dead: false,
    t: 0,
    rng: mulberry32(seed),
    events: [],
  };
}

export const enemyPos = (s: State, i: number): [number, number] => [s.fx + (i % COLS) * GAP_X, s.fy + Math.floor(i / COLS) * GAP_Y];

/** Seconds between formation steps: the fewer left, the faster they move. */
export const stepInterval = (s: State) => 0.03 + 0.5 * (s.alive.filter(Boolean).length / s.alive.length) / (1 + (s.wave - 1) * 0.15);

/** Damage a shield where a shot lands. Returns true if a cell was hit. */
export function hitShield(s: State, x: number, y: number) {
  for (const sh of s.shields) {
    const cx = Math.floor((x - sh.x) / CELL);
    const cy = Math.floor((y - sh.y) / CELL);
    if (cx < 0 || cy < 0 || cx >= SHIELD_COLS || cy >= SHIELD_ROWS) continue;
    const k = cy * SHIELD_COLS + cx;
    if (!sh.cells[k]) continue;
    sh.cells[k] = false;
    // Chip a neighbour for a ragged edge.
    const nk = k + (s.rng() < 0.5 ? -1 : 1);
    if (nk >= 0 && nk < sh.cells.length && Math.floor(nk / SHIELD_COLS) === cy) sh.cells[nk] = false;
    return true;
  }
  return false;
}

export const nullfleet: GameLogic<State> = {
  width: W,
  height: H,
  create,
  score: (s) => s.score,
  over: (s) => s.dead,
  update(s, c, dt) {
    if (s.dead) return;
    s.t += dt;
    s.invuln = Math.max(0, s.invuln - dt);

    // Ship: keys, or steer toward the touch point.
    let move = (c.held.right ? 1 : 0) - (c.held.left ? 1 : 0);
    if (c.pointerX !== null) move = Math.abs(c.pointerX - s.ship) < 3 ? 0 : Math.sign(c.pointerX - s.ship);
    s.ship = Math.max(SHIP_W / 2 + 4, Math.min(W - SHIP_W / 2 - 4, s.ship + move * 170 * dt));
    if ((c.held.action || c.take("action")) && !s.shot) {
      s.shot = { x: s.ship, y: SHIP_Y - 10 };
      s.events.push("fire");
    }

    // Player shot.
    if (s.shot) {
      s.shot.y -= 380 * dt;
      if (s.shot.y < 0) s.shot = null;
      else if (hitShield(s, s.shot.x, s.shot.y)) s.shot = null;
      else {
        for (let i = 0; i < s.alive.length; i++) {
          if (!s.alive[i]) continue;
          const [ex, ey] = enemyPos(s, i);
          if (s.shot.x > ex && s.shot.x < ex + EW && s.shot.y > ey && s.shot.y < ey + EH) {
            s.alive[i] = false;
            s.score += ROW_POINTS[Math.floor(i / COLS)];
            s.shot = null;
            s.events.push("boom");
            break;
          }
        }
      }
    }

    // Formation steps sideways, drops and turns at the edges.
    s.stepTimer += dt;
    if (s.stepTimer >= stepInterval(s)) {
      s.stepTimer = 0;
      let minX = Infinity;
      let maxX = -Infinity;
      s.alive.forEach((a, i) => {
        if (!a) return;
        const [ex] = enemyPos(s, i);
        minX = Math.min(minX, ex);
        maxX = Math.max(maxX, ex + EW);
      });
      if ((s.dir > 0 && maxX + 6 > W - 6) || (s.dir < 0 && minX - 6 < 6)) {
        s.dir = s.dir > 0 ? -1 : 1;
        s.fy += 10;
      } else {
        s.fx += s.dir * 6;
      }
      s.events.push("step");
    }

    // Enemy fire from the lowest packet in a random column.
    s.fireTimer -= dt;
    if (s.fireTimer <= 0) {
      s.fireTimer = (0.5 + s.rng() * 0.9) / (1 + (s.wave - 1) * 0.2);
      const cols = [...Array(COLS).keys()].filter((col) => s.alive.some((a, i) => a && i % COLS === col));
      if (cols.length) {
        const col = cols[Math.floor(s.rng() * cols.length)];
        let low = -1;
        for (let r = ROWS - 1; r >= 0; r--) if (s.alive[r * COLS + col]) {
          low = r * COLS + col;
          break;
        }
        const [ex, ey] = enemyPos(s, low);
        s.enemyShots.push({ x: ex + EW / 2, y: ey + EH });
      }
    }
    s.enemyShots = s.enemyShots.filter((b) => {
      b.y += 170 * dt;
      if (b.y > H) return false;
      if (hitShield(s, b.x, b.y)) return false;
      if (b.y > SHIP_Y - 6 && b.y < SHIP_Y + 8 && Math.abs(b.x - s.ship) < SHIP_W / 2) {
        if (s.invuln <= 0) {
          s.lives--;
          s.invuln = 1.5;
          s.events.push("hit");
          if (s.lives <= 0) s.dead = true;
        }
        return false;
      }
      return true;
    });

    // Formation reaching the ship ends the run; clearing it starts the next wave.
    const lowest = s.alive.reduce((m, a, i) => (a ? Math.max(m, enemyPos(s, i)[1] + EH) : m), 0);
    if (lowest >= SHIP_Y - 12) {
      s.dead = true;
      s.events.push("hit");
    }
    if (!s.alive.some(Boolean)) {
      s.wave++;
      s.alive = Array(ROWS * COLS).fill(true);
      s.fx = 36;
      s.fy = startY(s.wave);
      s.dir = 1;
      s.enemyShots = [];
      s.events.push("wave");
    }
  },
};
