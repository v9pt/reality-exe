import { promises as fs } from "node:fs";
import path from "node:path";
import { BOARD_SIZE, KEEP, LOWER_IS_BETTER, better, rankSort, type BoardEntry, type BoardGame, type PlayerStanding } from "../leaderboard";

/**
 * Where leaderboard entries live.
 *
 *  - Redis over REST when UPSTASH_REDIS_REST_URL / _TOKEN (or Vercel's
 *    KV_REST_API_URL / _TOKEN) are set. Works on serverless hosts.
 *  - Otherwise a JSON file (SCORES_FILE, default .data/scores.json). Fine for
 *    development and any always-on Node server; on read-only serverless
 *    filesystems writes fail and the board reports itself offline.
 *
 * Each player keeps one entry per game: their best, under their latest
 * callsign. Stored: player id (random, made on their device), callsign, score
 * and time. Never IP addresses.
 */
export type AddResult = { improved: boolean; you: PlayerStanding | null };
export type TopResult = { board: BoardEntry[]; runs: number; players: number; you: PlayerStanding | null };

export interface ScoreStore {
  kind: "redis" | "file";
  add(game: BoardGame, player: string, entry: BoardEntry): Promise<AddResult>;
  top(game: BoardGame, player?: string | null): Promise<TopResult>;
}

export class StoreOffline extends Error {}

/* ───────────── Redis (Upstash REST / Vercel KV) ───────────── */

type Cmd = (string | number)[];

export class RedisStore implements ScoreStore {
  kind = "redis" as const;
  constructor(
    private url: string,
    private token: string,
  ) {}

  private async pipeline(cmds: Cmd[]): Promise<unknown[]> {
    let res: Response;
    try {
      res = await fetch(`${this.url.replace(/\/$/, "")}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(cmds),
        cache: "no-store",
      });
    } catch (e) {
      throw new StoreOffline((e as Error).message);
    }
    if (!res.ok) throw new StoreOffline(`redis ${res.status}`);
    const out = (await res.json()) as { result?: unknown; error?: string }[];
    const err = out.find((r) => r.error);
    if (err) throw new StoreOffline(err.error);
    return out.map((r) => r.result);
  }

  private board = (game: BoardGame) => `reality:best:${game}`;
  private when = (game: BoardGame) => `reality:at:${game}`;
  private runs = (game: BoardGame) => `reality:runs:${game}`;
  private names = "reality:names";

  private rankCmd(game: BoardGame, player: string): Cmd {
    return [LOWER_IS_BETTER[game] ? "ZRANK" : "ZREVRANK", this.board(game), player];
  }

  private standing(rank: unknown, score: unknown): PlayerStanding | null {
    return typeof rank === "number" && score !== null && score !== undefined ? { rank: rank + 1, score: Number(score) } : null;
  }

  async add(game: BoardGame, player: string, e: BoardEntry): Promise<AddResult> {
    const [old] = await this.pipeline([["ZSCORE", this.board(game), player]]);
    const improved = old === null || old === undefined || better(game, e.score, Number(old));
    const low = LOWER_IS_BETTER[game];
    const cmds: Cmd[] = [
      ["HSET", this.names, player, e.name],
      ["INCR", this.runs(game)],
    ];
    if (improved) {
      cmds.push(["ZADD", this.board(game), e.score, player], ["HSET", this.when(game), player, e.at]);
      // Keep the best KEEP players.
      cmds.push(low ? ["ZREMRANGEBYRANK", this.board(game), KEEP, -1] : ["ZREMRANGEBYRANK", this.board(game), 0, -(KEEP + 1)]);
    }
    cmds.push(this.rankCmd(game, player), ["ZSCORE", this.board(game), player]);
    const out = await this.pipeline(cmds);
    return { improved, you: this.standing(out[out.length - 2], out[out.length - 1]) };
  }

  async top(game: BoardGame, player?: string | null): Promise<TopResult> {
    const low = LOWER_IS_BETTER[game];
    const cmds: Cmd[] = [
      low ? ["ZRANGE", this.board(game), 0, BOARD_SIZE - 1, "WITHSCORES"] : ["ZRANGE", this.board(game), 0, BOARD_SIZE - 1, "REV", "WITHSCORES"],
      ["GET", this.runs(game)],
      ["ZCARD", this.board(game)],
    ];
    if (player) cmds.push(this.rankCmd(game, player), ["ZSCORE", this.board(game), player]);
    const [range, runs, players, rank, score] = await this.pipeline(cmds);
    const flat = (range as string[] | null) ?? [];
    const ids: string[] = [];
    const scores: number[] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) {
      ids.push(flat[i]);
      scores.push(Number(flat[i + 1]));
    }
    let board: BoardEntry[] = [];
    if (ids.length) {
      const [names, ats] = (await this.pipeline([
        ["HMGET", this.names, ...ids],
        ["HMGET", this.when(game), ...ids],
      ])) as (string | null)[][];
      board = ids.map((id, i) => ({ name: names?.[i] ?? "Visitor", score: scores[i], at: Number(ats?.[i] ?? 0), ...(id === player ? { you: true } : {}) }));
    }
    return { board, runs: Number(runs ?? 0) || 0, players: Number(players ?? 0) || 0, you: player ? this.standing(rank, score) : null };
  }
}

/* ───────────── JSON file ───────────── */

type Best = BoardEntry & { player: string };
type FileData = { version: 2; games: Partial<Record<BoardGame, Best[]>>; runs: Partial<Record<BoardGame, number>> };

export class FileStore implements ScoreStore {
  kind = "file" as const;
  private data: FileData | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private file: string) {}

  private async load(): Promise<FileData> {
    if (this.data) return this.data;
    let raw: Partial<FileData> & { version?: number } = {};
    try {
      raw = JSON.parse(await fs.readFile(this.file, "utf8"));
    } catch {
      /* new board */
    }
    const games: FileData["games"] = {};
    for (const [g, list] of Object.entries(raw.games ?? {})) {
      // Boards from before player ids: each old row becomes its own player.
      games[g as BoardGame] = (list as (BoardEntry & { player?: string })[]).map((e, i) => ({
        ...e,
        player: e.player ?? `legacy${String(i).padStart(8, "0")}`,
      }));
    }
    this.data = { version: 2, games, runs: raw.runs ?? {} };
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

  private standing(list: Best[], player: string | null | undefined): PlayerStanding | null {
    if (!player) return null;
    const i = list.findIndex((e) => e.player === player);
    return i >= 0 ? { rank: i + 1, score: list[i].score } : null;
  }

  add(game: BoardGame, player: string, e: BoardEntry) {
    // Serialise writes so concurrent posts never clobber each other.
    const run = this.queue.then(async () => {
      const d = await this.load();
      const list = [...(d.games[game] ?? [])];
      const i = list.findIndex((x) => x.player === player);
      const improved = i < 0 || better(game, e.score, list[i].score);
      if (i >= 0) list[i] = improved ? { ...e, player } : { ...list[i], name: e.name };
      else list.push({ ...e, player });
      // Keep the callsign current on every board this player is on.
      for (const other of Object.values(d.games)) for (const x of other ?? []) if (x.player === player) x.name = e.name;
      const sorted = list.sort(rankSort(game)).slice(0, KEEP);
      d.games[game] = sorted;
      d.runs[game] = (d.runs[game] ?? 0) + 1;
      await this.save(d);
      return { improved, you: this.standing(sorted, player) };
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async top(game: BoardGame, player?: string | null) {
    const d = await this.load();
    const list = d.games[game] ?? [];
    return {
      board: list.slice(0, BOARD_SIZE).map(({ player: id, ...e }) => (id === player ? { ...e, you: true } : e)),
      runs: d.runs[game] ?? 0,
      players: list.length,
      you: this.standing(list, player),
    };
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
