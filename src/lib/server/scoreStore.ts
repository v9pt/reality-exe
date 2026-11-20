import { promises as fs } from "node:fs";
import path from "node:path";
import { BOARD_SIZE, KEEP, LOWER_IS_BETTER, rankSort, type BoardEntry, type BoardGame } from "../leaderboard";

/**
 * Where leaderboard entries live.
 *
 *  - Redis over REST when UPSTASH_REDIS_REST_URL / _TOKEN (or Vercel's
 *    KV_REST_API_URL / _TOKEN) are set. Works on serverless hosts.
 *  - Otherwise a JSON file (SCORES_FILE, default .data/scores.json). Fine for
 *    development and any always-on Node server; on read-only serverless
 *    filesystems writes fail and the board reports itself offline.
 *
 * Only the callsign, the score and the time are stored. Never IP addresses.
 */
export interface ScoreStore {
  kind: "redis" | "file";
  add(game: BoardGame, entry: BoardEntry): Promise<{ rank: number | null }>;
  top(game: BoardGame): Promise<{ board: BoardEntry[]; runs: number }>;
}

export class StoreOffline extends Error {}

/* ───────────── Redis (Upstash REST / Vercel KV) ───────────── */

class RedisStore implements ScoreStore {
  kind = "redis" as const;
  constructor(
    private url: string,
    private token: string,
  ) {}

  private async pipeline(cmds: (string | number)[][]) {
    const res = await fetch(`${this.url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmds),
      cache: "no-store",
    });
    if (!res.ok) throw new StoreOffline(`redis ${res.status}`);
    const out = (await res.json()) as { result?: unknown; error?: string }[];
    const err = out.find((r) => r.error);
    if (err) throw new StoreOffline(err.error);
    return out.map((r) => r.result);
  }

  private key = (game: BoardGame) => `reality:board:${game}`;

  async add(game: BoardGame, e: BoardEntry) {
    const member = JSON.stringify({ n: e.name, t: e.at, r: Math.random().toString(36).slice(2, 7) });
    const low = LOWER_IS_BETTER[game];
    const [, , rank] = await this.pipeline([
      ["ZADD", this.key(game), e.score, member],
      ["INCR", `reality:runs:${game}`],
      [low ? "ZRANK" : "ZREVRANK", this.key(game), member],
      // Keep the best KEEP entries.
      low ? ["ZREMRANGEBYRANK", this.key(game), KEEP, -1] : ["ZREMRANGEBYRANK", this.key(game), 0, -(KEEP + 1)],
    ]);
    return { rank: typeof rank === "number" ? rank + 1 : null };
  }

  async top(game: BoardGame) {
    const low = LOWER_IS_BETTER[game];
    const [range, runs] = await this.pipeline([
      low ? ["ZRANGE", this.key(game), 0, BOARD_SIZE - 1, "WITHSCORES"] : ["ZRANGE", this.key(game), 0, BOARD_SIZE - 1, "REV", "WITHSCORES"],
      ["GET", `reality:runs:${game}`],
    ]);
    const flat = (range as string[]) ?? [];
    const board: BoardEntry[] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) {
      try {
        const m = JSON.parse(flat[i]) as { n: string; t: number };
        board.push({ name: m.n, at: m.t, score: Number(flat[i + 1]) });
      } catch {
        /* skip a malformed member */
      }
    }
    return { board, runs: Number(runs ?? 0) || 0 };
  }
}

/* ───────────── JSON file ───────────── */

type FileData = { games: Partial<Record<BoardGame, BoardEntry[]>>; runs: Partial<Record<BoardGame, number>> };

export class FileStore implements ScoreStore {
  kind = "file" as const;
  private data: FileData | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private file: string) {}

  private async load(): Promise<FileData> {
    if (this.data) return this.data;
    try {
      this.data = JSON.parse(await fs.readFile(this.file, "utf8")) as FileData;
    } catch {
      this.data = { games: {}, runs: {} };
    }
    this.data.games ??= {};
    this.data.runs ??= {};
    return this.data;
  }

  private async save(d: FileData) {
    try {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(d));
      await fs.rename(tmp, this.file);
    } catch (e) {
      throw new StoreOffline((e as Error).message);
    }
  }

  add(game: BoardGame, e: BoardEntry) {
    // Serialise writes so concurrent posts never clobber each other.
    const run = this.queue.then(async () => {
      const d = await this.load();
      const list = [...(d.games[game] ?? []), e].sort(rankSort(game)).slice(0, KEEP);
      d.games[game] = list;
      d.runs[game] = (d.runs[game] ?? 0) + 1;
      await this.save(d);
      const i = list.indexOf(e);
      return { rank: i >= 0 ? i + 1 : null };
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async top(game: BoardGame) {
    const d = await this.load();
    return { board: (d.games[game] ?? []).slice(0, BOARD_SIZE), runs: d.runs[game] ?? 0 };
  }
}

let store: ScoreStore | null = null;

export function scoreStore(): ScoreStore {
  if (store) return store;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  store = url && token ? new RedisStore(url, token) : new FileStore(process.env.SCORES_FILE || path.join(process.cwd(), ".data", "scores.json"));
  return store;
}
