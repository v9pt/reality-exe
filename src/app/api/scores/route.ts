import { NextResponse } from "next/server";
import { BOARD_GAMES, cleanPlayer, validateEntry, type BoardGame } from "@/lib/leaderboard";
import { StoreOffline, scoreStore } from "@/lib/server/scoreStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Posts per minute allowed from one address. Kept in memory only; addresses are never stored. */
const LIMIT = 20;
const hits = new Map<string, number[]>();

function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > LIMIT;
}

const offline = (message: string) => NextResponse.json({ ok: false, code: "board_offline", message }, { status: 503 });

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const game = params.get("game") as BoardGame;
  if (!BOARD_GAMES.includes(game)) return NextResponse.json({ ok: false, code: "invalid", message: "Unknown game." }, { status: 400 });
  try {
    const top = await scoreStore().top(game, cleanPlayer(params.get("player")));
    return NextResponse.json({ ok: true, ...top }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (!(e instanceof StoreOffline)) console.error("scores GET", e);
    return offline("The leaderboard is offline right now.");
  }
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  if (limited(ip)) return NextResponse.json({ ok: false, code: "rate_limited", message: "Too many scores at once. Try again in a minute." }, { status: 429 });
  if (Number(req.headers.get("content-length") ?? 0) > 2048)
    return NextResponse.json({ ok: false, code: "invalid", message: "Request too large." }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse((await req.text()).slice(0, 2048));
  } catch {
    return NextResponse.json({ ok: false, code: "invalid", message: "Expected a JSON body." }, { status: 400 });
  }
  const v = validateEntry(body);
  if (!v.ok) return NextResponse.json({ ok: false, code: "invalid", message: v.message }, { status: 400 });
  try {
    const store = scoreStore();
    const { improved } = await store.add(v.game, v.player, { name: v.name, score: v.score, at: Date.now() });
    const top = await store.top(v.game, v.player);
    return NextResponse.json({ ok: true, improved, rank: top.you?.rank ?? null, ...top }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (!(e instanceof StoreOffline)) console.error("scores POST", e);
    return offline("The leaderboard is offline right now; your score is saved on this device.");
  }
}
