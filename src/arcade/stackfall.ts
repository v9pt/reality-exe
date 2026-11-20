import { mulberry32, type Evented, type GameLogic } from "./core";

/**
 * Stackfall: falling blocks with a 7-piece bag, standard SRS rotation and
 * wall kicks, hold, ghost piece, lock delay and level speed-up.
 */
export const COLS = 10;
export const ROWS = 22; // the top two rows are hidden spawn space
export const HIDDEN = 2;
export const CELL = 18;

export type Kind = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
export const KINDS: Kind[] = ["I", "O", "T", "S", "Z", "J", "L"];

/** Spawn-state cells (x, y with y down) inside each piece's bounding box. */
const SPAWN: Record<Kind, { n: number; cells: [number, number][] }> = {
  I: { n: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  O: { n: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  T: { n: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  S: { n: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { n: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { n: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { n: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
};

/** Cells for a kind in rotation state r (0 spawn, 1 R, 2 180, 3 L). */
export function cellsOf(kind: Kind, rot: number): [number, number][] {
  const { n, cells } = SPAWN[kind];
  let out = cells;
  for (let i = 0; i < ((rot % 4) + 4) % 4; i++) out = out.map(([x, y]) => [n - 1 - y, x] as [number, number]);
  return out;
}

// SRS kick tables, written with y pointing up as in the guideline; negated on use.
type Kick = [number, number][];
const JLSTZ: Record<string, Kick> = {
  "0>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "1>0": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "1>2": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "2>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "2>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  "3>2": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "3>0": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "0>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};
const I_KICKS: Record<string, Kick> = {
  "0>1": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  "1>0": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  "1>2": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  "2>1": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  "2>3": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  "3>2": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  "3>0": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  "0>3": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};

export type Piece = { kind: Kind; rot: number; x: number; y: number };
export type State = Evented & {
  board: (Kind | null)[][];
  piece: Piece;
  hold: Kind | null;
  canHold: boolean;
  queue: Kind[];
  bag: Kind[];
  gravity: number;
  lockTimer: number;
  lockResets: number;
  das: { dir: number; t: number };
  lines: number;
  level: number;
  score: number;
  dead: boolean;
  /** Rows just cleared, for the flash effect. */
  flash: number[];
  flashT: number;
  rng: () => number;
};

const LOCK_DELAY = 0.5;
const MAX_RESETS = 15;
const DAS = 0.17;
const ARR = 0.05;
export const LINE_POINTS = [0, 100, 300, 500, 800];

/** Seconds per row at a level (guideline curve). */
export const fallTime = (level: number) => Math.pow(0.8 - (level - 1) * 0.007, level - 1);

function nextFromBag(s: Pick<State, "bag" | "rng">): Kind {
  if (s.bag.length === 0) {
    const b = [...KINDS];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(s.rng() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    s.bag = b;
  }
  return s.bag.shift()!;
}

export const spawnPiece = (kind: Kind): Piece => ({ kind, rot: 0, x: kind === "O" ? 4 : 3, y: 0 });

export function collides(board: (Kind | null)[][], p: Piece) {
  return cellsOf(p.kind, p.rot).some(([cx, cy]) => {
    const x = p.x + cx;
    const y = p.y + cy;
    return x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x] !== null);
  });
}

export function create(seed: number): State {
  const s = {
    board: Array.from({ length: ROWS }, () => Array<Kind | null>(COLS).fill(null)),
    hold: null,
    canHold: true,
    bag: [] as Kind[],
    queue: [] as Kind[],
    gravity: 0,
    lockTimer: 0,
    lockResets: 0,
    das: { dir: 0, t: 0 },
    lines: 0,
    level: 1,
    score: 0,
    dead: false,
    flash: [],
    flashT: 0,
    rng: mulberry32(seed),
    events: [],
  } as unknown as State;
  for (let i = 0; i < 4; i++) s.queue.push(nextFromBag(s));
  s.piece = spawnPiece(s.queue.shift()!);
  s.queue.push(nextFromBag(s));
  return s;
}

function tryMove(s: State, dx: number, dy: number) {
  const p = { ...s.piece, x: s.piece.x + dx, y: s.piece.y + dy };
  if (collides(s.board, p)) return false;
  s.piece = p;
  if (dx !== 0) touchLock(s);
  return true;
}

/** A successful move or rotation on the ground buys a little more time. */
function touchLock(s: State) {
  if (s.lockResets < MAX_RESETS && collides(s.board, { ...s.piece, y: s.piece.y + 1 })) {
    s.lockTimer = 0;
    s.lockResets++;
  }
}

/** Rotate by +1 (clockwise) or -1, trying each SRS kick in turn. */
export function rotate(s: State, dir: 1 | -1) {
  const p = s.piece;
  if (p.kind === "O") return true;
  const from = ((p.rot % 4) + 4) % 4;
  const to = (from + dir + 4) % 4;
  const kicks = (p.kind === "I" ? I_KICKS : JLSTZ)[`${from}>${to}`];
  for (const [kx, ky] of kicks) {
    const c = { ...p, rot: to, x: p.x + kx, y: p.y - ky };
    if (!collides(s.board, c)) {
      s.piece = c;
      touchLock(s);
      s.events.push("rotate");
      return true;
    }
  }
  return false;
}

export function ghostY(s: State) {
  let y = s.piece.y;
  while (!collides(s.board, { ...s.piece, y: y + 1 })) y++;
  return y;
}

function newPiece(s: State, kind: Kind) {
  s.piece = spawnPiece(kind);
  s.lockTimer = 0;
  s.lockResets = 0;
  s.gravity = 0;
  if (collides(s.board, s.piece)) {
    s.dead = true;
    s.events.push("hit");
  }
}

/** Fix the piece to the board, clear full rows and score them. Returns rows cleared. */
export function lock(s: State) {
  for (const [cx, cy] of cellsOf(s.piece.kind, s.piece.rot)) {
    const y = s.piece.y + cy;
    if (y >= 0) s.board[y][s.piece.x + cx] = s.piece.kind;
  }
  const full: number[] = [];
  s.board.forEach((row, y) => row.every(Boolean) && full.push(y));
  if (full.length) {
    s.board = [...Array.from({ length: full.length }, () => Array<Kind | null>(COLS).fill(null)), ...s.board.filter((_, y) => !full.includes(y))];
    s.score += LINE_POINTS[full.length] * s.level;
    s.lines += full.length;
    s.level = 1 + Math.floor(s.lines / 10);
    s.flash = full;
    s.flashT = 0.2;
    s.events.push(full.length === 4 ? "quad" : "clear");
  } else {
    s.events.push("lock");
  }
  s.canHold = true;
  newPiece(s, s.queue.shift()!);
  s.queue.push(nextFromBag(s));
  return full.length;
}

export function hardDrop(s: State) {
  const y = ghostY(s);
  s.score += (y - s.piece.y) * 2;
  s.piece = { ...s.piece, y };
  return lock(s);
}

export function holdPiece(s: State) {
  if (!s.canHold) return;
  const cur = s.piece.kind;
  if (s.hold) newPiece(s, s.hold);
  else {
    newPiece(s, s.queue.shift()!);
    s.queue.push(nextFromBag(s));
  }
  s.hold = cur;
  s.canHold = false;
}

export const stackfall: GameLogic<State> = {
  width: COLS * CELL,
  height: (ROWS - HIDDEN) * CELL,
  create,
  score: (s) => s.score,
  over: (s) => s.dead,
  update(s, c, dt) {
    if (s.dead) return;
    s.flashT = Math.max(0, s.flashT - dt);
    if (c.take("alt")) holdPiece(s);
    if (c.take("up")) rotate(s, 1);
    if (c.take("alt2")) rotate(s, -1);
    if (c.take("action")) {
      hardDrop(s);
      return;
    }

    // Sideways: one step on press, then auto-repeat after a delay.
    const tl = c.take("left");
    const tr = c.take("right");
    const dir = tl ? -1 : tr ? 1 : c.held.left ? -1 : c.held.right ? 1 : 0;
    if (tl || tr) {
      tryMove(s, dir, 0);
      s.das = { dir, t: 0 };
    } else if (dir !== 0 && dir === s.das.dir) {
      s.das.t += dt;
      while (s.das.t >= DAS + ARR) {
        s.das.t -= ARR;
        tryMove(s, dir, 0);
      }
    } else {
      s.das = { dir: 0, t: 0 };
    }

    // Gravity, faster while soft dropping.
    const soft = c.held.down || c.take("down");
    const per = soft ? Math.min(fallTime(s.level), 0.05) : fallTime(s.level);
    s.gravity += dt;
    while (s.gravity >= per) {
      s.gravity -= per;
      if (tryMove(s, 0, 1)) {
        if (soft) s.score += 1;
      } else break;
    }

    // Lock delay once resting on something.
    if (collides(s.board, { ...s.piece, y: s.piece.y + 1 })) {
      s.lockTimer += dt;
      if (s.lockTimer >= LOCK_DELAY) lock(s);
    } else {
      s.lockTimer = 0;
    }
  },
};
