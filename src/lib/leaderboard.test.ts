import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { KEEP, cleanName, validateEntry } from "./leaderboard";
import { FileStore } from "./server/scoreStore";

describe("leaderboard rules", () => {
  it("cleans callsigns", () => {
    expect(cleanName("  Neo  the One ")).toBe("Neo the One");
    expect(cleanName("<script>x</script>")).toBe("scriptxscript");
    expect(cleanName("a")).toBeNull();
    expect(cleanName(42)).toBeNull();
    expect(cleanName("x".repeat(40))).toHaveLength(16);
  });

  it("accepts plausible scores and refuses the rest", () => {
    expect(validateEntry({ game: "snake", name: "Ana", score: 120 }).ok).toBe(true);
    expect(validateEntry({ game: "snake", name: "Ana", score: 999999 }).ok).toBe(false);
    expect(validateEntry({ game: "kart", name: "Ana", score: 3000 }).ok).toBe(false); // impossibly fast lap
    expect(validateEntry({ game: "kart", name: "Ana", score: 42_000 }).ok).toBe(true);
    expect(validateEntry({ game: "chess", name: "Ana", score: 1 }).ok).toBe(false);
    expect(validateEntry({ game: "snake", name: "Ana", score: 12.5 }).ok).toBe(false);
  });
});

describe("file store", () => {
  it("keeps the best entries, best first, and counts every run", async () => {
    const file = path.join(await mkdtemp(path.join(os.tmpdir(), "scores-")), "scores.json");
    const s = new FileStore(file);
    await Promise.all([10, 50, 30].map((score, i) => s.add("snake", { name: `P${i}`, score, at: i })));
    const { board, runs } = await s.top("snake");
    expect(board.map((e) => e.score)).toEqual([50, 30, 10]);
    expect(runs).toBe(3);
    expect(JSON.parse(await readFile(file, "utf8")).runs.snake).toBe(3);
  });

  it("ranks kart laps lowest first", async () => {
    const s = new FileStore(path.join(await mkdtemp(path.join(os.tmpdir(), "scores-")), "s.json"));
    await s.add("kart", { name: "A", score: 50_000, at: 1 });
    const { rank } = await s.add("kart", { name: "B", score: 40_000, at: 2 });
    expect(rank).toBe(1);
    expect((await s.top("kart")).board[0].name).toBe("B");
  });

  it(`never keeps more than ${KEEP} entries`, async () => {
    const s = new FileStore(path.join(await mkdtemp(path.join(os.tmpdir(), "scores-")), "s.json"));
    for (let i = 0; i < KEEP + 20; i++) await s.add("bughunt", { name: "Z", score: (i % 50) + 1, at: i });
    const { runs } = await s.top("bughunt");
    expect(runs).toBe(KEEP + 20);
  });
});
