import type { GameId } from "@/lib/arcade";

export type Entry = { score: number; at: number };
export type Table = Partial<Record<GameId, Entry[]>>;

export const MAX_ENTRIES = 5;
const KEY = "reality.exe/scores/v1";

/**
 * Insert a score into a best-first table. Returns the new table and the
 * 1-based rank, or null when the score didn't make the table (or was 0).
 */
export function insertScore(list: Entry[], score: number, at: number, max = MAX_ENTRIES): { list: Entry[]; rank: number | null } {
  if (score <= 0) return { list, rank: null };
  const next = [...list, { score, at }].sort((a, b) => b.score - a.score || a.at - b.at).slice(0, max);
  const i = next.findIndex((e) => e.at === at && e.score === score);
  return { list: next, rank: i >= 0 ? i + 1 : null };
}

type Saved = { scores: Table; played: GameId[] };

export function loadAll(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    const saved: Saved = raw ? JSON.parse(raw) : { scores: {}, played: [] };
    saved.scores ??= {};
    saved.played ??= [];
    // Carry over the old Bug Hunt best from before the arcade existed.
    const old = Number(localStorage.getItem("reality.exe/bugs") ?? 0);
    if (old > 0 && !saved.scores.bughunt?.length) saved.scores.bughunt = [{ score: old, at: 0 }];
    return saved;
  } catch {
    return { scores: {}, played: [] };
  }
}

function saveAll(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode: scores last for this visit only */
  }
}

export function scoresFor(game: GameId): Entry[] {
  return loadAll().scores[game] ?? [];
}

/** Record a finished run. Returns the rank it earned and the games played so far. */
export function submit(game: GameId, score: number): { rank: number | null; played: GameId[] } {
  const s = loadAll();
  const { list, rank } = insertScore(s.scores[game] ?? [], score, Date.now());
  s.scores[game] = list;
  if (!s.played.includes(game)) s.played.push(game);
  saveAll(s);
  return { rank, played: s.played };
}
