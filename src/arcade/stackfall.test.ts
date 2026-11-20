import { describe, expect, it } from "vitest";
import { STEP, scripted } from "./core";
import { COLS, KINDS, cellsOf, collides, create, ghostY, hardDrop, holdPiece, lock, rotate, spawnPiece, stackfall, type Kind } from "./stackfall";

const empty = () => Array.from({ length: 22 }, () => Array<Kind | null>(COLS).fill(null));

describe("stackfall", () => {
  it("rotates I through the SRS states", () => {
    expect(cellsOf("I", 0)).toEqual([[0, 1], [1, 1], [2, 1], [3, 1]]);
    expect(cellsOf("I", 1).every(([x]) => x === 2)).toBe(true);
    expect(cellsOf("I", 2).every(([, y]) => y === 2)).toBe(true);
    expect(cellsOf("I", 4)).toEqual(cellsOf("I", 0));
  });

  it("deals every piece once per bag of seven", () => {
    const s = create(1);
    // First bag: the current piece, the four previews and what's left in the bag.
    const seen = [s.piece.kind, ...s.queue, ...s.bag];
    expect(seen).toHaveLength(7);
    expect(new Set(seen).size).toBe(7);
    expect([...seen].sort()).toEqual([...KINDS].sort());
  });

  it("kicks a T piece off the left wall instead of refusing to rotate", () => {
    const s = create(2);
    s.board = empty();
    // Pressed against the left wall in state R; state 2 needs a kick to the right.
    s.piece = { kind: "T", rot: 1, x: -1, y: 5 };
    expect(collides(s.board, s.piece)).toBe(false);
    expect(collides(s.board, { ...s.piece, rot: 2 })).toBe(true);
    expect(rotate(s, 1)).toBe(true);
    expect(s.piece.rot).toBe(2);
    expect(s.piece.x).toBe(0);
    expect(collides(s.board, s.piece)).toBe(false);
  });

  it("clears a full row and scores it by level", () => {
    const s = create(3);
    s.board = empty();
    // Fill the bottom row except four cells, then drop an I into them.
    for (let x = 0; x < COLS; x++) if (x < 3 || x > 6) s.board[21][x] = "Z";
    s.piece = { ...spawnPiece("I"), x: 3, y: 0 };
    const before = s.score;
    const cleared = hardDrop(s);
    expect(cleared).toBe(1);
    expect(s.lines).toBe(1);
    // 100 for one line at level 1, plus 2 per row hard-dropped.
    expect(s.score - before).toBe(100 + 2 * 20);
    expect(s.board[21].every((c) => c === null)).toBe(true);
  });

  it("four rows at once is worth 800 × level", () => {
    const s = create(4);
    s.board = empty();
    for (let y = 18; y < 22; y++) for (let x = 0; x < COLS; x++) if (x !== 0) s.board[y][x] = "L";
    s.piece = { kind: "I", rot: 1, x: -2, y: 0 };
    s.level = 2;
    s.score = 0;
    s.piece.y = ghostY(s);
    expect(lock(s)).toBe(4);
    expect(s.score).toBe(1600);
  });

  it("hold swaps once per piece", () => {
    const s = create(5);
    const first = s.piece.kind;
    holdPiece(s);
    expect(s.hold).toBe(first);
    const second = s.piece.kind;
    holdPiece(s);
    expect(s.piece.kind).toBe(second);
  });

  it("gravity eventually locks a piece and spawns the next", () => {
    const s = create(6);
    const c = scripted();
    for (let i = 0; i < 60 * 30 && !s.board.flat().some(Boolean); i++) stackfall.update(s, c, STEP);
    expect(s.board.flat().filter(Boolean).length).toBe(4);
  });

  it("game over when a new piece can't spawn", () => {
    const s = create(7);
    // Columns 0 and 1 open, so locking a piece there can't complete a row.
    for (let y = 0; y < 22; y++) for (let x = 2; x < COLS; x++) s.board[y][x] = "O";
    s.piece = { kind: "I", rot: 1, x: -2, y: 0 };
    lock(s);
    expect(s.dead).toBe(true);
    expect(stackfall.over(s)).toBe(true);
  });
});
