/**
 * The global leaderboard: rules shared by the server route and the browser.
 * Every finished run is posted under the visitor's callsign. The server keeps
 * each player's best per game (so one driver can't fill the board), and a
 * count of every run. A player is a random id kept on their device: it is
 * never shown, it just keeps two people with the same callsign apart.
 */
import type { GameId } from "./arcade";

export type BoardGame = GameId | "kart";
export const BOARD_GAMES: BoardGame[] = ["skyhop", "nullfleet", "stackfall", "snake", "bughunt", "kart"];

/** Kart laps are times in milliseconds: lower is better. Everything else is points. */
export const LOWER_IS_BETTER: Record<BoardGame, boolean> = {
  skyhop: false,
  nullfleet: false,
  stackfall: false,
  snake: false,
  bughunt: false,
  kart: true,
};

/** Plausible ranges. Anything outside is refused rather than shown. */
export const LIMITS: Record<BoardGame, { min: number; max: number }> = {
  skyhop: { min: 1, max: 2000 },
  nullfleet: { min: 10, max: 500_000 },
  stackfall: { min: 1, max: 20_000_000 },
  snake: { min: 10, max: 4_000 },
  bughunt: { min: 1, max: 60 },
  // The circuit is about 212 m; at full Overdrive boost (about 43 m/s) that is
  // just under five seconds, so anything faster than four can't be real.
  kart: { min: 4_000, max: 600_000 },
};

/** A row on the board. `you` marks the requesting player's own row. */
export type BoardEntry = { name: string; score: number; at: number; you?: boolean };
/** The requesting player's own standing, whether or not they made the top ten. */
export type PlayerStanding = { rank: number; score: number };
export type BoardResponse =
  | { ok: true; board: BoardEntry[]; runs: number; players: number; you: PlayerStanding | null; rank?: number | null; improved?: boolean }
  | { ok: false; code: string; message: string };

export const BOARD_SIZE = 10;
/** How many players' bests the server keeps per game. */
export const KEEP = 500;

/** Player ids: 12 to 32 lowercase letters and digits, made on the device. */
export function cleanPlayer(raw: unknown): string | null {
  return typeof raw === "string" && /^[a-z0-9]{12,32}$/.test(raw) ? raw : null;
}

/** Is `a` a better score than `b` for this game? */
export const better = (game: BoardGame, a: number, b: number) => (LOWER_IS_BETTER[game] ? a < b : a > b);

/** Callsigns: 2–16 letters, digits, spaces, dots, dashes or underscores. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw
    .normalize("NFKC")
    .replace(/[^A-Za-z0-9 ._-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16);
  return name.length >= 2 ? name : null;
}

export function validateEntry(body: unknown): { ok: true; game: BoardGame; name: string; score: number; player: string } | { ok: false; message: string } {
  if (!body || typeof body !== "object") return { ok: false, message: "Expected a JSON body." };
  const b = body as Record<string, unknown>;
  const game = b.game as BoardGame;
  if (!BOARD_GAMES.includes(game)) return { ok: false, message: "Unknown game." };
  const name = cleanName(b.name);
  if (!name) return { ok: false, message: "Callsign must be 2 to 16 letters or digits." };
  const player = cleanPlayer(b.player);
  if (!player) return { ok: false, message: "Missing player id." };
  const score = b.score;
  if (typeof score !== "number" || !Number.isInteger(score)) return { ok: false, message: "Score must be a whole number." };
  const { min, max } = LIMITS[game];
  if (score < min || score > max) return { ok: false, message: "Score out of range." };
  return { ok: true, game, name, score, player };
}

/** Sort best first for a game. */
export function rankSort(game: BoardGame) {
  return LOWER_IS_BETTER[game]
    ? (a: BoardEntry, b: BoardEntry) => a.score - b.score || a.at - b.at
    : (a: BoardEntry, b: BoardEntry) => b.score - a.score || a.at - b.at;
}

/* ───────────────────────── Browser side ───────────────────────── */

const NAME_KEY = "reality.exe/callsign";
const PLAYER_KEY = "reality.exe/player";

/** Was the callsign picked by the visitor (rather than made up for them)? */
export function hasChosenCallsign() {
  const n = callsign();
  return !/^Visitor(-\d{4})?$/.test(n);
}

let sessionPlayer: string | null = null;

/** This device's player id, made on first use. Never shown to anyone. */
export function playerId(): string {
  try {
    const saved = cleanPlayer(localStorage.getItem(PLAYER_KEY));
    if (saved) return saved;
  } catch {
    /* fall through to a per-visit id */
  }
  if (!sessionPlayer) {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    sessionPlayer = Array.from(bytes, (b) => (b % 36).toString(36)).join("") + Date.now().toString(36).slice(-4);
  }
  try {
    localStorage.setItem(PLAYER_KEY, sessionPlayer);
  } catch {
    /* kept for this visit only */
  }
  return sessionPlayer;
}

/** The visitor's callsign, made up on first use and remembered on this device. */
export function callsign(): string {
  try {
    const saved = cleanName(localStorage.getItem(NAME_KEY));
    if (saved) return saved;
    const made = `Visitor-${Math.floor(1000 + Math.random() * 9000)}`;
    localStorage.setItem(NAME_KEY, made);
    return made;
  } catch {
    return "Visitor";
  }
}

export function setCallsign(raw: string): string | null {
  const name = cleanName(raw);
  if (!name) return null;
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* kept for this visit only */
  }
  return name;
}

export async function postScore(game: BoardGame, score: number): Promise<BoardResponse> {
  try {
    const res = await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game, score: Math.round(score), name: callsign(), player: playerId() }),
    });
    return (await res.json()) as BoardResponse;
  } catch {
    return { ok: false, code: "network", message: "No connection to the leaderboard." };
  }
}

/** One line for the visitor about what happened to a posted score. */
export function postedMessage(r: BoardResponse): string {
  if (r.ok) {
    const where = r.you ? `#${r.you.rank} of ${r.players}` : "on the board";
    return r.improved === false ? `Your best still stands: ${where}.` : `New personal best: ${where} on the global board.`;
  }
  if (r.code === "rate_limited") return "Too many scores at once; this one is saved on this device.";
  if (r.code === "invalid") return `Not logged: ${r.message}`;
  return "Saved on this device; the global board is offline.";
}

export async function fetchBoard(game: BoardGame): Promise<BoardResponse> {
  try {
    const res = await fetch(`/api/scores?game=${encodeURIComponent(game)}&player=${encodeURIComponent(playerId())}`, { cache: "no-store" });
    return (await res.json()) as BoardResponse;
  } catch {
    return { ok: false, code: "network", message: "No connection to the leaderboard." };
  }
}
