"use client";

import { Component, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { loadAll, type Entry } from "@/arcade/highscores";
import { nullfleet } from "@/arcade/nullfleet";
import { skyhop } from "@/arcade/skyhop";
import { snake } from "@/arcade/snake";
import { stackfall, type State as StackState } from "@/arcade/stackfall";
import { CABINETS, GAMES, gameById, type GameId } from "@/lib/arcade";
import { HUE_HEX } from "@/lib/sections";
import { useGame } from "@/store/game";
import { Sheet } from "../ui/Sheet";
import { BugHunt } from "./BugHunt";
import { GameScreen } from "./GameScreen";
import { drawMini, drawNullFleet, drawSkyhop, drawSnake, drawStackfall } from "./render";

/** A game that throws shows a message and a way back, instead of taking the sheet down with it. */
class GameBoundary extends Component<{ onBack: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("[reality.exe] arcade game crashed", error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="border border-crimson/50 p-4 text-[14px] text-hud">
        <p className="display text-[1.6rem]">This cabinet crashed</p>
        <p className="text-hud-dim">The other games still work. Your scores are safe.</p>
        <button onClick={this.props.onBack} className="mt-2 text-cyan underline">
          Back to all games
        </button>
      </div>
    );
  }
}

const COARSE = "(pointer: coarse)";
function useTouch() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(COARSE);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(COARSE).matches,
    () => false,
  );
}

function Mini({ kind, label, dim }: { kind: StackState["hold"]; label: string; dim?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current?.getContext("2d");
    if (g) drawMini(g, kind, 14, dim);
  }, [kind, dim]);
  return (
    <div className="border border-hud/15 p-1.5">
      <p className="text-[11px] text-hud-dim">{label}</p>
      <canvas ref={ref} width={56} height={35} className="block" aria-label={`${label}: ${kind ?? "empty"}`} />
    </div>
  );
}

function stackSide(s: StackState) {
  return (
    <>
      <Mini kind={s.hold} label="Hold" dim={!s.canHold} />
      {s.queue.slice(0, 3).map((k, i) => (
        <Mini key={i} kind={k} label={i === 0 ? "Next" : "Then"} />
      ))}
      <div className="border border-hud/15 p-1.5 text-[12px] text-hud">
        <p>Score {s.score}</p>
        <p>Lines {s.lines}</p>
        <p>Level {s.level}</p>
      </div>
    </>
  );
}

function Scores({ list }: { list: Entry[] }) {
  if (!list.length) return <p className="text-[13px] text-hud-dim">No scores yet on this device.</p>;
  return (
    <ol className="text-[14px]">
      {list.map((e, i) => (
        <li key={`${e.at}-${i}`} className="flex justify-between border-t border-hud/10 py-1.5 text-hud">
          <span className="text-hud-dim">#{i + 1}</span>
          <span>{e.score}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * The arcade: a picker of five original games, each with its controls, a
 * best-scores table kept in this browser, and touch controls on phones.
 */
export function ArcadePanel() {
  const initial = useGame((s) => s.arcadeGame);
  const [game, setGame] = useState<GameId | null>(initial);
  // Follow the store when a cabinet, the terminal or the nav picks a game,
  // including when this sheet is reused mid-close.
  useEffect(
    () =>
      useGame.subscribe((st, prev) => {
        if (st.arcadeGame !== prev.arcadeGame || (st.panel === "arcade" && prev.panel !== "arcade")) setGame(st.arcadeGame);
      }),
    [],
  );
  const [table, setTable] = useState(() => loadAll());
  const refresh = useCallback(() => setTable(loadAll()), []);
  const touch = useTouch();
  const meta = game ? gameById(game) : null;

  const screen = useMemo(() => {
    if (!meta) return null;
    const common = { meta, touch, onScores: refresh };
    switch (meta.id) {
      case "skyhop":
        return <GameScreen key="skyhop" {...common} logic={skyhop} draw={drawSkyhop} />;
      case "nullfleet":
        return <GameScreen key="nullfleet" {...common} logic={nullfleet} draw={drawNullFleet} />;
      case "stackfall":
        return <GameScreen key="stackfall" {...common} logic={stackfall} draw={drawStackfall} side={stackSide} />;
      case "snake":
        return <GameScreen key="snake" {...common} logic={snake} draw={drawSnake} />;
      case "bughunt":
        return <BugHunt onScores={refresh} />;
    }
  }, [meta, touch, refresh]);

  const played = table.played.filter((id) => CABINETS.includes(id)).length;

  return (
    <Sheet glyph="遊技場" title={meta ? meta.title : "Arcade"} subtitle={meta ? `${meta.genre}. ${meta.blurb}` : `Five original games. Scores stay in this browser. Cabinets played: ${played} of ${CABINETS.length}.`} tone="dark" wide>
      {meta ? (
        <div>
          <button onClick={() => setGame(null)} className="mb-3 text-[13px] text-cyan hover:underline">
            ← All games
          </button>
          <GameBoundary key={meta.id} onBack={() => setGame(null)}>
            {screen}
          </GameBoundary>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="display text-[1.4rem] text-hud">Controls</h3>
              <dl className="mt-1 text-[14px]">
                {(touch ? [["Touch", meta.touch] as [string, string]] : meta.keys).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-t border-hud/10 py-1.5">
                    <dt className="text-hud">{k}</dt>
                    <dd className="text-right text-hud-dim">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <h3 className="display text-[1.4rem] text-hud">Best on this device</h3>
              <Scores list={table.scores[meta.id] ?? []} />
            </div>
          </div>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {GAMES.map((g) => {
            const best = table.scores[g.id]?.[0]?.score;
            const c = HUE_HEX[g.hue];
            return (
              <li key={g.id}>
                <button onClick={() => setGame(g.id)} className="group flex w-full items-start gap-4 border border-hud/15 p-4 text-left hover:border-hud/50 focus-visible:border-hud/50">
                  <span className="kanji grid h-14 w-14 shrink-0 place-items-center border text-[26px]" style={{ color: c, borderColor: `${c}88` }}>
                    {g.glyph}
                  </span>
                  <span className="min-w-0">
                    <span className="display block text-[1.8rem] leading-none text-hud group-hover:text-white">{g.title}</span>
                    <span className="mt-1 block text-[12px]" style={{ color: c }}>
                      {g.genre}
                      {g.id === "bughunt" ? ", from the back alley" : ""}
                    </span>
                    <span className="mt-1 block text-[13px] text-hud-dim">{g.blurb}</span>
                    <span className="mt-2 block text-[12px] text-hud">{best ? `Best ${best}` : "Not played yet"}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
