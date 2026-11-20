"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { useGame, type Quality } from "@/store/game";
import { measureRefresh, perf } from "./perf";

const DOWN: Record<Quality, Quality> = { high: "medium", medium: "low", low: "low" };
const UP: Record<Quality, Quality> = { low: "medium", medium: "high", high: "high" };

/** Pixel-ratio range per tier, capped by the device's own ratio. */
export const DPR: Record<Quality, [number, number]> = {
  low: [0.75, 1],
  medium: [1, 1.35],
  high: [1, 1.75],
};

/** Below this the frame rate counts as slow, whatever the display. */
const FLOOR_FPS = 55;

/**
 * Keeps the frame rate at or above 60 (and near the display's own rate on
 * 120 Hz screens). Samples 2-second windows and judges the median, so one
 * long frame doesn't count as a slow GPU. Steps the pixel ratio first, then
 * the scene tier; stops after a few tier changes so it never flickers.
 * Windows from a hidden or throttled tab are ignored.
 */
export function AdaptiveQuality({ max }: { max: Quality }) {
  const s = useRef({ t: 0, dts: [] as number[], good: 0, changes: 0 });

  useEffect(() => {
    measureRefresh().then((hz) => {
      perf.refresh = hz;
    });
  }, []);

  useFrame(({ gl }, dt) => {
    const r = s.current;
    r.t += Math.min(dt, 0.25);
    (r.dts ??= []).push(dt);
    if (r.t < 2 || r.dts.length < 10) return;
    const sorted = r.dts.sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const fps = 1 / median;
    r.t = 0;
    r.dts = [];
    // A hidden or heavily throttled tab says nothing about the GPU.
    if (document.hidden || median > 0.25) return;
    const g = useGame.getState();
    if (g.panel) return;

    const q = g.quality;
    const [lo, hi] = DPR[q];
    const device = Math.min(window.devicePixelRatio || 1, 2);
    const cur = gl.getPixelRatio();
    const upAt = Math.max(FLOOR_FPS + 3, perf.refresh * 0.93);

    if (fps < FLOOR_FPS) {
      r.good = 0;
      if (cur - 0.15 >= lo) {
        g.setDpr(cur - 0.15);
      } else if (q !== "low" && r.changes < 4) {
        g.setQuality(DOWN[q]);
        r.changes++;
      }
    } else if (fps > upAt) {
      r.good++;
      if (r.good < 3) return;
      r.good = 0;
      if (cur + 0.15 <= Math.min(hi, device)) {
        g.setDpr(cur + 0.15);
      } else if (q !== max && r.changes < 4) {
        g.setQuality(UP[q]);
        r.changes++;
      }
    } else {
      r.good = 0;
    }
  });
  return null;
}
