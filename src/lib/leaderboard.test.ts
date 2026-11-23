import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KEEP, cleanName, cleanPlayer, postedMessage, validateEntry } from "./leaderboard";
import { FileStore, RedisStore } from "./server/scoreStore";

const P = (n: number) => `player${String(n).padStart(8, "0")}`;

describe("leaderboard rules", () => {
  it("cleans callsigns", () => {
    expect(cleanName("  Neo  the One ")).toBe("Neo the One");
    expect(cleanName("<script>x</script>")).toBe("scriptxscript");
    expect(cleanName("a")).toBeNull();
    expect(cleanName(42)).toBeNull();
    expect(cleanName("x".repeat(40))).toHaveLength(16);
  });

  it("accepts plausible scores and refuses the rest", () => {
    const player = P(1);
    expect(validateEntry({ game: "snake", name: "Ana", score: 120, player }).ok).toBe(true);
    expect(validateEntry({ game: "snake", name: "Ana", score: 999999, player }).ok).toBe(false);
    expect(validateEntry({ game: "kart", name: "Ana", score: 3000, player }).ok).toBe(false); // impossibly fast lap
    expect(validateEntry({ game: "kart", name: "Ana", score: 6_500, player }).ok).toBe(true); // a fast boosted lap
    expect(validateEntry({ game: "kart", name: "Ana", score: 42_000, player }).ok).toBe(true);
    expect(validateEntry({ game: "chess", name: "Ana", score: 1, player }).ok).toBe(false);
    expect(validateEntry({ game: "snake", name: "Ana", score: 12.5, player }).ok).toBe(false);
    expect(validateEntry({ game: "snake", name: "Ana", score: 120 }).ok).toBe(false); // no player id
  });

  it("only accepts well-formed player ids", () => {
    expect(cleanPlayer(P(3))).toBe(P(3));
    expect(cleanPlayer("short")).toBeNull();
    expect(cleanPlayer("UPPER0000000000")).toBeNull();
    expect(cleanPlayer("a:b:c:d:e:f:g:h")).toBeNull();
  });

  it("tells the visitor what happened to a score", () => {
    const ok = { ok: true as const, board: [], runs: 3, players: 2, you: { rank: 1, score: 9000 } };
    expect(postedMessage({ ...ok, improved: true })).toMatch(/New personal best: #1 of 2/);
    expect(postedMessage({ ...ok, improved: false })).toMatch(/still stands/);
    expect(postedMessage({ ok: false, code: "rate_limited", message: "" })).toMatch(/Too many/);
    expect(postedMessage({ ok: false, code: "invalid", message: "Score out of range." })).toMatch(/Not logged: Score out of range/);
    expect(postedMessage({ ok: false, code: "board_offline", message: "" })).toMatch(/offline/);
  });
});

describe("file store", () => {
  const fresh = async () => new FileStore(path.join(await mkdtemp(path.join(os.tmpdir(), "scores-")), "scores.json"));

  it("keeps each player's best, best first, and counts every run", async () => {
    const file = path.join(await mkdtemp(path.join(os.tmpdir(), "scores-")), "scores.json");
    const s = new FileStore(file);
    await Promise.all([10, 50, 30].map((score, i) => s.add("snake", P(i), { name: `P${i}`, score, at: i })));
    const { board, runs, players } = await s.top("snake");
    expect(board.map((e) => e.score)).toEqual([50, 30, 10]);
    expect(runs).toBe(3);
    expect(players).toBe(3);
    expect(JSON.parse(await readFile(file, "utf8")).runs.snake).toBe(3);
  });

  it("one player can't fill the board: only their best counts", async () => {
    const s = await fresh();
    const a = await s.add("kart", P(1), { name: "Ana", score: 50_000, at: 1 });
    expect(a.improved).toBe(true);
    const worse = await s.add("kart", P(1), { name: "Ana", score: 60_000, at: 2 });
    expect(worse.improved).toBe(false);
    const faster = await s.add("kart", P(1), { name: "Ana", score: 40_000, at: 3 });
    expect(faster.improved).toBe(true);
    const { board, runs, players } = await s.top("kart");
    expect(board).toHaveLength(1);
    expect(board[0].score).toBe(40_000);
    expect(runs).toBe(3);
    expect(players).toBe(1);
  });

  it("ranks kart laps lowest first and marks your own row", async () => {
    const s = await fresh();
    await s.add("kart", P(1), { name: "A", score: 50_000, at: 1 });
    const b = await s.add("kart", P(2), { name: "B", score: 40_000, at: 2 });
    expect(b.you).toEqual({ rank: 1, score: 40_000 });
    const top = await s.top("kart", P(1));
    expect(top.board[0].name).toBe("B");
    expect(top.board[1].you).toBe(true);
    expect(top.board[0].you).toBeUndefined();
    expect(top.you).toEqual({ rank: 2, score: 50_000 });
    // Player ids never leave the server.
    expect(JSON.stringify(top)).not.toContain(P(1));
  });

  it("a new callsign renames your rows everywhere", async () => {
    const s = await fresh();
    await s.add("snake", P(1), { name: "Old", score: 100, at: 1 });
    await s.add("kart", P(1), { name: "New", score: 30_000, at: 2 });
    expect((await s.top("snake")).board[0].name).toBe("New");
  });

  it("reads boards saved before player ids", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "scores-"));
    const file = path.join(dir, "s.json");
    const { writeFile } = await import("node:fs/promises");
    await writeFile(file, JSON.stringify({ games: { snake: [{ name: "Old", score: 90, at: 1 }] }, runs: { snake: 1 } }));
    const s = new FileStore(file);
    await s.add("snake", P(1), { name: "New", score: 80, at: 2 });
    expect((await s.top("snake")).board.map((e) => e.name)).toEqual(["Old", "New"]);
  });

  it(`never keeps more than ${KEEP} players`, async () => {
    const s = await fresh();
    for (let i = 0; i < KEEP + 20; i++) await s.add("bughunt", P(i), { name: "Z", score: (i % 50) + 1, at: i });
    const { runs, players } = await s.top("bughunt");
    expect(runs).toBe(KEEP + 20);
    expect(players).toBe(KEEP);
  });
});

/** A tiny in-memory stand-in for Upstash's REST pipeline, enough to run RedisStore. */
function fakeUpstash() {
  const z = new Map<string, Map<string, number>>();
  const h = new Map<string, Map<string, string>>();
  const kv = new Map<string, number>();
  const zset = (k: string) => z.get(k) ?? (z.set(k, new Map()), z.get(k)!);
  const hash = (k: string) => h.get(k) ?? (h.set(k, new Map()), h.get(k)!);
  const sorted = (k: string, rev: boolean) => [...zset(k)].sort((a, b) => (rev ? b[1] - a[1] : a[1] - b[1]) || (a[0] < b[0] ? -1 : 1));
  const run = (c: (string | number)[]): unknown => {
    const [op, key, ...a] = c as [string, string, ...(string | number)[]];
    switch (op) {
      case "ZSCORE": {
        const v = zset(key).get(String(a[0]));
        return v === undefined ? null : String(v);
      }
      case "ZADD":
        zset(key).set(String(a[1]), Number(a[0]));
        return 1;
      case "ZRANK":
      case "ZREVRANK": {
        const i = sorted(key, op === "ZREVRANK").findIndex(([m]) => m === String(a[0]));
        return i < 0 ? null : i;
      }
      case "ZREMRANGEBYRANK": {
        const list = sorted(key, false);
        const n = list.length;
        const from = Number(a[0]) < 0 ? n + Number(a[0]) : Number(a[0]);
        const to = Number(a[1]) < 0 ? n + Number(a[1]) : Number(a[1]);
        list.slice(Math.max(0, from), to + 1).forEach(([m]) => zset(key).delete(m));
        return 0;
      }
      case "ZRANGE": {
        const rev = a.includes("REV");
        return sorted(key, rev)
          .slice(Number(a[0]), Number(a[1]) + 1)
          .flatMap(([m, s]) => [m, String(s)]);
      }
      case "ZCARD":
        return zset(key).size;
      case "HSET":
        hash(key).set(String(a[0]), String(a[1]));
        return 1;
      case "HMGET":
        return a.map((f) => hash(key).get(String(f)) ?? null);
      case "INCR":
        kv.set(key, (kv.get(key) ?? 0) + 1);
        return kv.get(key);
      case "GET":
        return kv.has(key) ? String(kv.get(key)) : null;
    }
    return { error: `unknown ${op}` };
  };
  return vi.fn(async (_url: string, init: RequestInit) => {
    const cmds = JSON.parse(String(init.body)) as (string | number)[][];
    return new Response(JSON.stringify(cmds.map((c) => ({ result: run(c) }))), { status: 200 });
  });
}

describe("redis store (Upstash REST, faked)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps each player's best lap, ranks it, and names rows from the latest callsign", async () => {
    const fetchMock = fakeUpstash();
    vi.stubGlobal("fetch", fetchMock);
    const s = new RedisStore("https://example.upstash.io/", "token");
    expect((await s.add("kart", P(1), { name: "Ana", score: 50_000, at: 1 })).improved).toBe(true);
    expect((await s.add("kart", P(2), { name: "Bo", score: 45_000, at: 2 })).you).toEqual({ rank: 1, score: 45_000 });
    expect((await s.add("kart", P(1), { name: "Ana", score: 55_000, at: 3 })).improved).toBe(false);
    await s.add("kart", P(1), { name: "Ana K", score: 44_000, at: 4 });
    const top = await s.top("kart", P(2));
    expect(top.board.map((e) => [e.name, e.score])).toEqual([
      ["Ana K", 44_000],
      ["Bo", 45_000],
    ]);
    expect(top.board[1].you).toBe(true);
    expect(top).toMatchObject({ runs: 4, players: 2, you: { rank: 2, score: 45_000 } });
    // It talks to the pipeline endpoint with the token.
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.upstash.io/pipeline");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token");
  });

  it("ranks points highest first", async () => {
    vi.stubGlobal("fetch", fakeUpstash());
    const s = new RedisStore("https://x", "t");
    await s.add("snake", P(1), { name: "A", score: 10, at: 1 });
    await s.add("snake", P(2), { name: "B", score: 30, at: 2 });
    expect((await s.top("snake")).board.map((e) => e.score)).toEqual([30, 10]);
  });

  it("reports itself offline when Upstash fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500 })),
    );
    const s = new RedisStore("https://x", "t");
    await expect(s.top("kart")).rejects.toThrow("redis 500");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("ENOTFOUND"))),
    );
    await expect(s.top("kart")).rejects.toThrow("ENOTFOUND");
  });
});
