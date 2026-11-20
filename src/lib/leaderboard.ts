/**
 * The global leaderboard: rules shared by the server route and the browser.
 * Every finished run is posted under the visitor's callsign; the server keeps
 * the best entries per game and a count of all runs.
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
  kart: { min: 12_000, max: 600_000 },
};

export type BoardEntry = { name: string; score: number; at: number };
export type BoardResponse = { ok: true; board: BoardEntry[]; runs: number; rank?: number | null } | { ok: false; code: string; message: string };

export const BOARD_SIZE = 10;
/** How many entries the server keeps per game. */
export const KEEP = 500;

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

export function validateEntry(body: unknown): { ok: true; game: BoardGame; name: string; score: number } | { ok: false; message: string } {
  if (!body || typeof body !== "object") return { ok: false, message: "Expected a JSON body." };
  const b = body as Record<string, unknown>;
  const game = b.game as BoardGame;
  if (!BOARD_GAMES.includes(game)) return { ok: false, message: "Unknown game." };
  const name = cleanName(b.name);
  if (!name) return { ok: false, message: "Callsign must be 2 to 16 letters or digits." };
  const score = b.score;
  if (typeof score !== "number" || !Number.isInteger(score)) return { ok: false, message: "Score must be a whole number." };
  const { min, max } = LIMITS[game];
  if (score < min || score > max) return { ok: false, message: "Score out of range." };
  return { ok: true, game, name, score };
}

/** Sort best first for a game. */
export function rankSort(game: BoardGame) {
  return LOWER_IS_BETTER[game] ? (a: BoardEntry, b: BoardEntry) => a.score - b.score || a.at - b.at : (a: BoardEntry, b: BoardEntry) => b.score - a.score || a.at - b.at;
}

/* ───────────────────────── Browser side ───────────────────────── */

const NAME_KEY = "reality.exe/callsign";

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
      body: JSON.stringify({ game, score: Math.round(score), name: callsign() }),
    });
    return (await res.json()) as BoardResponse;
  } catch {
    return { ok: false, code: "network", message: "No connection to the leaderboard." };
  }
}

export async function fetchBoard(game: BoardGame): Promise<BoardResponse> {
  try {
    const res = await fetch(`/api/scores?game=${encodeURIComponent(game)}`, { cache: "no-store" });
    return (await res.json()) as BoardResponse;
  } catch {
    return { ok: false, code: "network", message: "No connection to the leaderboard." };
  }
}
