"use client";

import { useEffect } from "react";
import type { Btn } from "@/arcade/core";
import type { GameId } from "@/lib/arcade";
import type { LiveControls } from "./input";

function Pad({ label, btn, c, wide = false, hold = true }: { label: string; btn: Btn; c: LiveControls; wide?: boolean; hold?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        c.press(btn);
        if (!hold) c.release(btn);
        navigator.vibrate?.(8);
      }}
      onPointerUp={() => c.release(btn)}
      onPointerCancel={() => c.release(btn)}
      className={`grid h-14 touch-none select-none place-items-center border border-hud/30 bg-hud/[0.06] text-[15px] font-bold text-hud active:bg-cyan/25 ${wide ? "col-span-2" : ""}`}
    >
      {label}
    </button>
  );
}

/**
 * On-screen controls for touch screens, per game, plus swipe gestures on the
 * game canvas where they suit the game.
 */
export function TouchPad({ game, controls: c, logicWidth, canvas }: { game: GameId; controls: LiveControls; logicWidth: number; canvas: React.RefObject<HTMLCanvasElement | null> }) {
  // Gestures on the canvas.
  useEffect(() => {
    const el = canvas.current;
    if (!el || (game !== "stackfall" && game !== "snake" && game !== "nullfleet")) return;
    let start: { x: number; y: number; t: number; lastX: number } | null = null;
    const toGame = (clientX: number) => {
      const r = el.getBoundingClientRect();
      return ((clientX - r.left) / r.width) * logicWidth;
    };
    const down = (e: PointerEvent) => {
      start = { x: e.clientX, y: e.clientY, t: performance.now(), lastX: e.clientX };
      if (game === "nullfleet") c.pointerX = toGame(e.clientX);
    };
    const move = (e: PointerEvent) => {
      if (!start) return;
      if (game === "nullfleet") c.pointerX = toGame(e.clientX);
      if (game === "stackfall") {
        // Drag sideways: one column per 22 px.
        const step = 22;
        while (e.clientX - start.lastX > step) {
          c.press("right");
          c.release("right");
          start.lastX += step;
        }
        while (start.lastX - e.clientX > step) {
          c.press("left");
          c.release("left");
          start.lastX -= step;
        }
      }
    };
    const up = (e: PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const quick = performance.now() - start.t < 300;
      if (game === "nullfleet") c.pointerX = null;
      if (game === "stackfall") {
        if (dy > 60 && quick) c.press("action");
        else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) c.press("up");
        c.release("action");
        c.release("up");
      }
      if (game === "snake" && Math.max(Math.abs(dx), Math.abs(dy)) > 20) {
        const b: Btn = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
        c.press(b);
        c.release(b);
      }
      start = null;
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [game, c, logicWidth, canvas]);

  if (game === "skyhop") {
    return (
      <div className="mx-auto mt-3 grid max-w-[320px] grid-cols-2 gap-2">
        <Pad label="Thrust" btn="action" c={c} wide />
      </div>
    );
  }
  if (game === "nullfleet") {
    return (
      <div className="mx-auto mt-3 grid max-w-[320px] grid-cols-3 gap-2">
        <Pad label="◀" btn="left" c={c} />
        <Pad label="Fire" btn="action" c={c} />
        <Pad label="▶" btn="right" c={c} />
      </div>
    );
  }
  if (game === "stackfall") {
    return (
      <div className="mx-auto mt-3 grid max-w-[360px] grid-cols-4 gap-2">
        <Pad label="◀" btn="left" c={c} />
        <Pad label="▶" btn="right" c={c} />
        <Pad label="⟲" btn="alt2" c={c} hold={false} />
        <Pad label="⟳" btn="up" c={c} hold={false} />
        <Pad label="Soft ▼" btn="down" c={c} />
        <Pad label="Drop" btn="action" c={c} hold={false} />
        <Pad label="Hold" btn="alt" c={c} hold={false} wide />
      </div>
    );
  }
  if (game === "snake") {
    return (
      <div className="mx-auto mt-3 grid w-[200px] grid-cols-3 gap-2">
        <span />
        <Pad label="▲" btn="up" c={c} hold={false} />
        <span />
        <Pad label="◀" btn="left" c={c} hold={false} />
        <span />
        <Pad label="▶" btn="right" c={c} hold={false} />
        <span />
        <Pad label="▼" btn="down" c={c} hold={false} />
        <span />
      </div>
    );
  }
  return null;
}
