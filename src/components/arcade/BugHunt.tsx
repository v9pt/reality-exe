"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { submit } from "@/arcade/highscores";
import { useGame } from "@/store/game";

const ROUND = 15;

/** The original back-alley cabinet: squash bugs on a 4 × 4 grid. Plain DOM, fully keyboard-operable. */
/** A random cell that isn't the previous one. */
function nextCell(prev: number) {
  const n = Math.floor(Math.random() * 16);
  return n === prev ? (n + 5) % 16 : n;
}

export function BugHunt({ onScores }: { onScores?: () => void }) {
  const [state, setState] = useState<"ready" | "play" | "over">("ready");
  const [cell, setCell] = useState(-1);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(ROUND);
  const [rank, setRank] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const scoreRef = useRef(0);
  const leftRef = useRef(ROUND);

  const finish = useCallback(() => {
    setState("over");
    setCell(-1);
    window.clearTimeout(timer.current);
    const final = scoreRef.current;
    const r = submit("bughunt", final);
    setRank(r.rank);
    if (r.rank === 1) useGame.getState().toast({ tone: "info", title: "New best on Bug Hunt", body: `${final} bugs` });
    onScores?.();
  }, [onScores]);

  useEffect(() => {
    if (state !== "play") return;
    const tick = setInterval(() => {
      leftRef.current -= 1;
      setLeft(leftRef.current);
      if (leftRef.current <= 0) {
        clearInterval(tick);
        finish();
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [state, finish]);

  const spawn = (prev: number) => {
    const n = nextCell(prev);
    setCell(n);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => spawn(n), 900);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const start = () => {
    scoreRef.current = 0;
    leftRef.current = ROUND;
    setScore(0);
    setLeft(ROUND);
    setRank(null);
    setState("play");
    spawn(-1);
  };
  return (
    <div className="border border-violet/40 p-4">
      <div className="flex items-baseline justify-between">
        <p className="display text-[1.7rem] text-hud">Bug Hunt</p>
        <p className="font-mono text-[12px] text-hud-dim">
          score {score} {state === "play" ? ` ${left}s` : ""}
        </p>
      </div>
      <p className="text-[13px] text-hud-dim">Squash as many bugs as you can in {ROUND} seconds.</p>
      <div className="mx-auto mt-3 grid max-w-[280px] grid-cols-4 gap-1.5" role="grid" aria-label="Bug hunt board">
        {Array.from({ length: 16 }, (_, i) => (
          <button
            key={i}
            disabled={state !== "play"}
            onClick={() => {
              if (i === cell) {
                scoreRef.current += 1;
                setScore(scoreRef.current);
                spawn(i);
              }
            }}
            aria-label={i === cell ? "Bug, squash it" : "Empty cell"}
            className={`grid aspect-square place-items-center border text-[20px] transition-colors ${i === cell ? "border-violet bg-violet/20" : "border-hud/10 bg-hud/[0.02]"}`}
          >
            {i === cell ? "🐞" : ""}
          </button>
        ))}
      </div>
      <div className="mt-3 text-center">
        {state !== "play" ? (
          <button onClick={start} className="bg-violet px-4 py-1.5 text-[14px] font-bold text-night hover:bg-hud">
            {state === "over" ? `Score ${score}${rank ? `, #${rank}` : ""}. Play again` : "Start"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
