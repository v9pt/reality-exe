"use client";

import { perf } from "../world/perf";

/** Outside the canvas: the text block the probe writes into. */
export function PerfOverlay() {
  return (
    <pre
      ref={(el) => {
        perf.el = el;
      }}
      aria-hidden
      className="pointer-events-none fixed top-[calc(env(safe-area-inset-top)+13rem)] right-3 z-[60] whitespace-pre bg-night/80 px-2 py-1 font-mono text-[11px] leading-snug text-cyan"
    >
      measuring…
    </pre>
  );
}
