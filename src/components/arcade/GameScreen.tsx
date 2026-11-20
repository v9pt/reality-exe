"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STEP, type Btn, type Evented, type GameLogic } from "@/arcade/core";
import { submit } from "@/arcade/highscores";
import { CABINETS, type GameMeta } from "@/lib/arcade";
import { HUE_HEX } from "@/lib/sections";
import { useGame } from "@/store/game";
import { bindKeyboard, createControls, type LiveControls } from "./input";
import { play, setSound, soundOn } from "./sound";
import { TouchPad } from "./TouchPad";

type Status = "play" | "paused" | "over";

/**
 * Runs one canvas game: a fixed 60 Hz update with rendering on every
 * display frame, keyboard and touch input, pause (P, tab switch, losing
 * focus), score submission and the game-over card.
 */
export function GameScreen<S extends Evented>({
  meta,
  logic,
  draw,
  touch,
  onScores,
  side,
}: {
  meta: GameMeta;
  logic: GameLogic<S>;
  draw: (g: CanvasRenderingContext2D, s: S, t: number) => void;
  touch: boolean;
  onScores: () => void;
  side?: (s: S) => React.ReactNode;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [controls] = useState<LiveControls>(createControls);
  const [first] = useState(() => logic.create(Date.now() >>> 0));
  const state = useRef<S>(first);
  /** Copy of the state for the side panels, refreshed a few times a second. */
  const [snap, setSnap] = useState<S>(first);
  const [status, setStatus] = useState<Status>("play");
  const statusRef = useRef<Status>("play");
  const [result, setResult] = useState<{ score: number; rank: number | null } | null>(null);
  const sound = useRef(false);
  useEffect(() => {
    sound.current = soundOn();
  }, []);

  const setS = (s: Status) => {
    statusRef.current = s;
    setStatus(s);
  };

  const restart = useCallback(() => {
    state.current = logic.create(Date.now() >>> 0);
    setSnap(state.current);
    controls.reset();
    setResult(null);
    setS("play");
    canvas.current?.focus({ preventScroll: true });
  }, [logic, controls]);

  const togglePause = useCallback(() => {
    if (statusRef.current === "over") return;
    setS(statusRef.current === "paused" ? "play" : "paused");
  }, []);

  // Keyboard while this screen is mounted.
  useEffect(() => bindKeyboard(controls, togglePause), [controls, togglePause]);

  // Pause when the tab is hidden.
  useEffect(() => {
    const v = () => document.hidden && statusRef.current === "play" && setS("paused");
    document.addEventListener("visibilitychange", v);
    return () => document.removeEventListener("visibilitychange", v);
  }, []);

  // Size the canvas to its box at device resolution, keeping the game's aspect ratio.
  useEffect(() => {
    const c = canvas.current;
    const w = wrap.current;
    if (!c || !w) return;
    const fit = () => {
      const maxW = w.clientWidth;
      // Leave room for the touch pad under the screen on phones.
      const maxH = Math.min(window.innerHeight * (touch ? 0.46 : 0.62), 640);
      const k = Math.min(maxW / logic.width, maxH / logic.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.style.width = `${Math.floor(logic.width * k)}px`;
      c.style.height = `${Math.floor(logic.height * k)}px`;
      c.width = Math.floor(logic.width * k * dpr);
      c.height = Math.floor(logic.height * k * dpr);
      const g = c.getContext("2d")!;
      g.setTransform(k * dpr, 0, 0, k * dpr, 0, 0);
      g.imageSmoothingEnabled = false;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(w);
    return () => ro.disconnect();
  }, [logic, touch]);

  // The loop.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let t = 0;
    let uiTick = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const g = canvas.current?.getContext("2d");
      if (!g) return;
      const s = state.current;
      if (statusRef.current === "play") {
        acc += dt;
        t += dt;
        while (acc >= STEP) {
          logic.update(s, controls, STEP);
          acc -= STEP;
        }
        for (const e of s.events.splice(0)) play(e, sound.current);
        if (logic.over(s)) {
          const score = logic.score(s);
          const { rank, played } = submit(meta.id, score);
          setResult({ score, rank });
          setS("over");
          onScores();
          const g2 = useGame.getState();
          if (rank === 1) g2.toast({ tone: "info", title: `New best on ${meta.title}`, body: `${score} points` });
          if (CABINETS.every((id) => played.includes(id))) g2.unlock("arcade");
        }
        // Side panels (next piece, hold) refresh a few times a second.
        if (side && (uiTick += dt) > 0.1) {
          uiTick = 0;
          setSnap({ ...s });
        }
      } else {
        acc = 0;
      }
      draw(g, s, t);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [logic, draw, meta, onScores, side, controls]);

  const press = (b: Btn) => controls.press(b);
  const release = (b: Btn) => controls.release(b);
  const color = HUE_HEX[meta.hue];

  return (
    <div>
      <div className="flex flex-nowrap items-start justify-center gap-3">
        <div ref={wrap} className="relative flex min-w-0 max-w-[460px] flex-1 justify-center">
          <canvas
            ref={canvas}
            tabIndex={0}
            aria-label={`${meta.title} game screen. ${meta.keys.map(([k, v]) => `${k}: ${v}`).join(". ")}`}
            className="touch-none border outline-none focus-visible:ring-2 focus-visible:ring-cyan"
            style={{ borderColor: `${color}66` }}
            onPointerDown={(e) => {
              // Tap-to-act games: a tap on the screen is the action button.
              if (meta.id === "skyhop") {
                e.preventDefault();
                press("action");
              }
            }}
            onPointerUp={() => meta.id === "skyhop" && release("action")}
          />
          {status !== "play" ? (
            <div className="absolute inset-0 grid place-items-center bg-night/70 p-4 text-center" role="status">
              {status === "paused" ? (
                <div>
                  <p className="display text-[2.4rem] text-hud">Paused</p>
                  <button onClick={togglePause} className="mt-2 bg-cyan px-4 py-1.5 text-[14px] font-bold text-night">
                    Resume
                  </button>
                  <p className="mt-2 text-[12px] text-hud-dim">P to pause and resume</p>
                </div>
              ) : result ? (
                <div>
                  <p className="kanji text-[13px]" style={{ color }}>
                    終了
                  </p>
                  <p className="display text-[2.6rem] text-hud">Game over</p>
                  <p className="text-[15px] text-hud">
                    {result.score} points
                    {result.rank ? <span className="text-amber"> · #{result.rank} on this device</span> : null}
                  </p>
                  <button data-autofocus onClick={restart} className="mt-3 px-4 py-1.5 text-[14px] font-bold text-night" style={{ background: color }}>
                    Play again
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        {side ? <div className="flex shrink-0 flex-col gap-2">{side(snap)}</div> : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <button onClick={togglePause} disabled={status === "over"} className="border border-hud/25 px-3 py-1 text-[13px] text-hud hover:border-hud disabled:opacity-40">
          {status === "paused" ? "Resume" : "Pause"}
        </button>
        <button onClick={restart} className="border border-hud/25 px-3 py-1 text-[13px] text-hud hover:border-hud">
          Restart
        </button>
        <SoundToggle onChange={(on) => (sound.current = on)} />
      </div>
      {touch ? <TouchPad game={meta.id} controls={controls} logicWidth={logic.width} canvas={canvas} /> : null}
    </div>
  );
}

function SoundToggle({ onChange }: { onChange: (on: boolean) => void }) {
  // This sheet only renders in the browser, so storage can be read up front.
  const [on, setOn] = useState(soundOn);
  return (
    <button
      aria-pressed={on}
      onClick={() => {
        setSound(!on);
        setOn(!on);
        onChange(!on);
      }}
      className="border border-hud/25 px-3 py-1 text-[13px] text-hud hover:border-hud"
    >
      Sound {on ? "on" : "off"}
    </button>
  );
}
