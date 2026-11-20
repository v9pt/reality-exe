import { describe, expect, it } from "vitest";
import { STEP, scripted } from "./core";
import { DRONE_X, GROUND, PYLON_W, badge, create, skyhop } from "./skyhop";

describe("skyhop", () => {
  it("waits for the first thrust", () => {
    const s = create(1);
    for (let i = 0; i < 120; i++) skyhop.update(s, scripted(), STEP);
    expect(s.phase).toBe("ready");
    skyhop.update(s, scripted({ action: 1 }), STEP);
    expect(s.phase).toBe("play");
    expect(s.vy).toBeLessThan(0);
  });

  it("falls to the ground without input and ends the run", () => {
    const s = create(2);
    skyhop.update(s, scripted({ action: 1 }), STEP);
    for (let i = 0; i < 300 && s.phase === "play"; i++) skyhop.update(s, scripted(), STEP);
    expect(s.phase).toBe("over");
    expect(skyhop.over(s)).toBe(true);
  });

  it("scores a point for each pylon passed", () => {
    const s = create(3);
    skyhop.update(s, scripted({ action: 1 }), STEP);
    // Put the drone safely in a gap and slide a pylon past it.
    s.pylons = [{ x: DRONE_X - PYLON_W - 20, gapY: 200, scored: false }];
    s.y = 200;
    s.vy = 0;
    skyhop.update(s, scripted(), STEP);
    expect(s.score).toBe(1);
    expect(s.y).toBeLessThan(GROUND);
  });

  it("awards courier ranks at 10, 25, 50 and 100", () => {
    expect(badge(9)).toBeNull();
    expect(badge(10)).toBe("Runner");
    expect(badge(25)).toBe("Courier");
    expect(badge(60)).toBe("Pilot");
    expect(badge(100)).toBe("Ace");
  });
});
