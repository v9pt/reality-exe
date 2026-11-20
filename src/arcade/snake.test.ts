import { describe, expect, it } from "vitest";
import { COLS, create, step, turn } from "./snake";

describe("signal snake", () => {
  it("grows and scores when it eats", () => {
    const s = create(1);
    const [hx, hy] = s.body[0];
    s.food = [hx + 1, hy];
    step(s);
    expect(s.body.length).toBe(4);
    expect(s.score).toBe(10);
  });

  it("can't reverse into itself", () => {
    const s = create(2);
    turn(s, "left");
    expect(s.queue).toEqual([]);
    turn(s, "up");
    expect(s.queue).toEqual(["up"]);
  });

  it("dies at the wall", () => {
    const s = create(3);
    s.food = [0, 0];
    for (let i = 0; i < COLS && !s.dead; i++) step(s);
    expect(s.dead).toBe(true);
  });

  it("dies crossing its own trace", () => {
    const s = create(4);
    s.body = [
      [5, 5],
      [6, 5],
      [6, 6],
      [5, 6],
      [4, 6],
    ];
    s.dir = "down";
    s.food = [0, 0];
    step(s);
    expect(s.dead).toBe(true);
  });
});
