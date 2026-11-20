import { describe, expect, it } from "vitest";
import { STEP, scripted } from "./core";
import { COLS, EH, EW, ROWS, ROW_POINTS, SHIP_Y, create, enemyPos, hitShield, nullfleet } from "./nullfleet";

describe("null fleet", () => {
  it("a shot destroys the packet it hits and scores its row", () => {
    const s = create(1);
    s.fireTimer = 99;
    const target = (ROWS - 1) * COLS + 3; // bottom row
    const [ex, ey] = enemyPos(s, target);
    s.shot = { x: ex + EW / 2, y: ey + EH + 2 };
    nullfleet.update(s, scripted(), STEP);
    expect(s.alive[target]).toBe(false);
    expect(s.score).toBe(ROW_POINTS[ROWS - 1]);
    expect(s.shot).toBeNull();
  });

  it("only one player shot is in the air at a time", () => {
    const s = create(2);
    nullfleet.update(s, scripted({}, { action: true }), STEP);
    const first = s.shot;
    nullfleet.update(s, scripted({}, { action: true }), STEP);
    expect(s.shot).toBe(first);
  });

  it("an enemy shot costs a life, then grants a moment of safety", () => {
    const s = create(3);
    s.fireTimer = 99;
    s.enemyShots = [{ x: s.ship, y: SHIP_Y - 2 }];
    nullfleet.update(s, scripted(), STEP);
    expect(s.lives).toBe(2);
    s.enemyShots = [{ x: s.ship, y: SHIP_Y - 2 }];
    nullfleet.update(s, scripted(), STEP);
    expect(s.lives).toBe(2);
  });

  it("shields erode where they are hit", () => {
    const s = create(4);
    const sh = s.shields[0];
    const before = sh.cells.filter(Boolean).length;
    expect(hitShield(s, sh.x + 10, sh.y + 5)).toBe(true);
    expect(sh.cells.filter(Boolean).length).toBeLessThan(before);
  });

  it("clearing the formation starts the next wave", () => {
    const s = create(5);
    s.alive = s.alive.map(() => false);
    nullfleet.update(s, scripted(), STEP);
    expect(s.wave).toBe(2);
    expect(s.alive.every(Boolean)).toBe(true);
  });
});
