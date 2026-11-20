"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { useGame } from "@/store/game";
import { perf } from "./perf";

/**
 * Inside the canvas: measures frame rate, frame time, draw calls and
 * triangles, and writes them into the overlay element twice a second.
 * Shown with ?perf=1.
 */
export function PerfProbe() {
  const gl = useThree((s) => s.gl);
  const acc = useRef({ t: 0, frames: 0, worst: 0 });
  useFrame((_, dt) => {
    const a = acc.current;
    a.t += dt;
    a.frames++;
    a.worst = Math.max(a.worst, dt);
    if (a.t < 0.5) return;
    const el = perf.el;
    if (el) {
      const info = gl.info.render;
      const q = useGame.getState().quality;
      el.textContent = [
        `${Math.round(a.frames / a.t)} fps`,
        `${((a.t / a.frames) * 1000).toFixed(1)} ms avg, ${(a.worst * 1000).toFixed(1)} worst`,
        `${info.calls} draws, ${(info.triangles / 1000).toFixed(1)}k tris`,
        `dpr ${gl.getPixelRatio().toFixed(2)}, tier ${q}, display ${perf.refresh} Hz`,
      ].join("\n");
    }
    a.t = 0;
    a.frames = 0;
    a.worst = 0;
  });
  return null;
}
