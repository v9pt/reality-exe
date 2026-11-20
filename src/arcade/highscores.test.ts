import { describe, expect, it } from "vitest";
import { insertScore } from "./highscores";

describe("score table", () => {
  it("keeps the best five, best first", () => {
    let list: { score: number; at: number }[] = [];
    for (const [i, s] of [5, 50, 20, 40, 10, 30].entries()) list = insertScore(list, s, i).list;
    expect(list.map((e) => e.score)).toEqual([50, 40, 30, 20, 10]);
  });

  it("reports the rank, or null when the score misses the table", () => {
    const list = [100, 90, 80, 70, 60].map((score, at) => ({ score, at }));
    expect(insertScore(list, 95, 10).rank).toBe(2);
    expect(insertScore(list, 10, 10).rank).toBeNull();
    expect(insertScore([], 0, 1).rank).toBeNull();
  });

  it("ties keep the earlier score ahead", () => {
    const { list, rank } = insertScore([{ score: 50, at: 1 }], 50, 2);
    expect(list[0].at).toBe(1);
    expect(rank).toBe(2);
  });
});
