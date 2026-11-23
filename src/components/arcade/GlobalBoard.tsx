"use client";

import { useEffect, useState } from "react";
import type { Entry } from "@/arcade/highscores";
import { formatLap } from "@/lib/circuit";
import { LOWER_IS_BETTER, callsign, fetchBoard, setCallsign, type BoardEntry, type BoardGame, type PlayerStanding } from "@/lib/leaderboard";

const show = (game: BoardGame, score: number) => (LOWER_IS_BETTER[game] ? formatLap(score) : String(score));

/**
 * Leaderboard for one game: everyone's best (from the server) or this
 * device's own. Refetches when `version` changes (after a run is posted).
 */
export function Leaderboard({ game, local, version }: { game: BoardGame; local: Entry[]; version: number }) {
  const [tab, setTab] = useState<"everyone" | "device">("everyone");
  const [state, setState] = useState<{ board: BoardEntry[]; runs: number; players: number; you: PlayerStanding | null } | { error: string } | null>(null);

  useEffect(() => {
    let live = true;
    void fetchBoard(game).then((r) => {
      if (!live) return;
      setState(r.ok ? { board: r.board, runs: r.runs, players: r.players, you: r.you } : { error: r.message });
    });
    return () => {
      live = false;
    };
  }, [game, version]);

  return (
    <div>
      <div className="flex items-center gap-1" role="tablist" aria-label="Leaderboard">
        {(["everyone", "device"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`px-2 py-1 text-[12px] ${tab === t ? "bg-hud text-night" : "border border-hud/20 text-hud-dim hover:text-hud"}`}
          >
            {t === "everyone" ? "Everyone" : "This device"}
          </button>
        ))}
        {tab === "everyone" && state && "runs" in state ? (
          <span className="ml-auto text-[11px] text-hud-dim">
            {state.players} {state.players === 1 ? "player" : "players"}, {state.runs} {state.runs === 1 ? "run" : "runs"}
          </span>
        ) : null}
      </div>
      {tab === "device" ? (
        local.length ? (
          <ol className="mt-1 text-[14px]">
            {local.map((e, i) => (
              <li key={`${e.at}-${i}`} className="flex justify-between border-t border-hud/10 py-1.5 text-hud">
                <span className="text-hud-dim">#{i + 1}</span>
                <span className="tabular-nums">{show(game, e.score)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-[13px] text-hud-dim">No scores yet on this device.</p>
        )
      ) : !state ? (
        <p className="mt-2 text-[13px] text-hud-dim">Loading the board…</p>
      ) : "error" in state ? (
        <p className="mt-2 text-[13px] text-hud-dim">{state.error} Your scores are still kept on this device.</p>
      ) : state.board.length ? (
        <>
          <ol className="mt-1 text-[14px]">
            {state.board.map((e, i) => (
              <li key={`${e.at}-${i}`} className={`flex justify-between gap-3 border-t border-hud/10 py-1.5 ${e.you ? "text-cyan" : "text-hud"}`}>
                <span className="w-7 text-hud-dim">#{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">
                  {e.name}
                  {e.you ? <span className="ml-1.5 text-[11px]">you</span> : null}
                </span>
                <span className="tabular-nums">{show(game, e.score)}</span>
              </li>
            ))}
          </ol>
          {state.you && !state.board.some((e) => e.you) ? (
            <p className="flex justify-between gap-3 border-t border-dashed border-hud/20 py-1.5 text-[14px] text-cyan">
              <span className="w-7">#{state.you.rank}</span>
              <span className="flex-1 truncate">{callsign()} (you)</span>
              <span className="tabular-nums">{show(game, state.you.score)}</span>
            </p>
          ) : null}
          <p className="mt-1 text-[11px] text-hud-dim">Each player&rsquo;s best counts once.</p>
        </>
      ) : (
        <p className="mt-2 text-[13px] text-hud-dim">Nobody has posted a score yet. Be the first.</p>
      )}
    </div>
  );
}

/** The name your scores go under. */
export function CallsignEditor() {
  const [name, setName] = useState(() => callsign());
  const [saved, setSaved] = useState<"idle" | "ok" | "bad">("idle");
  return (
    <form
      className="flex flex-wrap items-center gap-2 text-[13px]"
      onSubmit={(e) => {
        e.preventDefault();
        const n = setCallsign(name);
        setSaved(n ? "ok" : "bad");
        if (n) setName(n);
      }}
    >
      <label htmlFor="callsign" className="text-hud-dim">
        Your callsign
      </label>
      <input
        id="callsign"
        value={name}
        maxLength={16}
        onChange={(e) => {
          setName(e.target.value);
          setSaved("idle");
        }}
        className="w-36 border-b border-hud/30 bg-transparent px-1 py-0.5 text-hud outline-none focus:border-cyan"
      />
      <button type="submit" className="border border-hud/30 px-2 py-0.5 text-hud hover:border-hud">
        Save
      </button>
      <span aria-live="polite" className={saved === "bad" ? "text-crimson" : "text-hud-dim"}>
        {saved === "ok" ? "Saved. New scores use it." : saved === "bad" ? "2 to 16 letters or digits." : "Shown on the global boards."}
      </span>
    </form>
  );
}
