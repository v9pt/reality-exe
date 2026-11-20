import type { Quality } from "@/store/game";

export type Device = {
  webgl: boolean;
  /** Phone-sized screen: simplified scene, cinematic camera, full-screen sheets. */
  cinematic: boolean;
  touch: boolean;
  maxQuality: Quality;
  startQuality: Quality;
  reducedMotion: boolean;
};

export function detectWebGL(): boolean {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).has("nowebgl")) return false;
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return false;
    // Release the probe context straight away.
    (gl as WebGLRenderingContext).getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** Phones in portrait, and phones on their side (short and touch-driven). */
export const CINEMATIC_QUERY = "(max-width: 767px), (pointer: coarse) and (max-height: 500px)";

export function detectDevice(): Device {
  const mq = (q: string) => window.matchMedia(q).matches;
  const cinematic = mq(CINEMATIC_QUERY);
  const touch = mq("(pointer: coarse)");
  const cores = navigator.hardwareConcurrency ?? 4;
  const maxQuality: Quality = cinematic ? "low" : touch ? "medium" : cores >= 8 ? "high" : "medium";
  return {
    webgl: detectWebGL(),
    cinematic,
    touch,
    maxQuality,
    startQuality: cinematic ? "low" : "medium",
    reducedMotion: mq("(prefers-reduced-motion: reduce)"),
  };
}
