"use client";

import { useMemo } from "react";
import { BACKROOM_AT, DISTRICTS, HUE_HEX, SECTIONS } from "@/lib/sections";
import { useGame } from "@/store/game";

/** Map units to CSS, matching the SVG's "slice" scaling (viewBox 96 × 72). */
const at = (v: number) => `calc(50% + ${v} * max(${100 / 96}vw, ${100 / 72}vh))`;

/** The outer districts sit far out; pull them in so the whole district fits one screen. */
const squeeze = ([x, z]: [number, number]): [number, number] => {
  const r = Math.hypot(x, z);
  if (r <= 17) return [x, z];
  const k = (17 + (r - 17) * 0.24) / r;
  return [x * k, z * k];
};

/**
 * The city without WebGL: a printed district map. Same six locations, same
 * sheets, every pin is a real button.
 */
export function FlatMap() {
  const open = useGame((s) => s.open);
  const backroomOpen = useGame((s) => s.backroomOpen);
  const openBackroom = useGame((s) => s.openBackroom);
  const blocks = useMemo(() => {
    const out: { x: number; y: number; w: number; h: number; o: number }[] = [];
    let s = 11;
    const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let x = -46; x <= 46; x += 6.5) {
      for (let y = -30; y <= 30; y += 6.5) {
        const d = Math.hypot(x, y);
        if (d < 20 || Math.abs(x) < 4.5 || Math.abs(y) < 4.5) continue;
        if (Math.hypot(x - BACKROOM_AT[0], y - BACKROOM_AT[1]) < 6) continue;
        out.push({ x: x - 2.4 + r(), y: y - 2.4 + r(), w: 3.6 + r() * 1.4, h: 3.6 + r() * 1.4, o: 0.25 + r() * 0.5 });
      }
    }
    return out;
  }, []);

  return (
    <div className="fixed inset-0 bg-night">
      <svg viewBox="-48 -36 96 72" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label="Map of District V9: six locations round the plaza and three outer districts">
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%" r="60%">
            <stop offset="0" stopColor="#2a1440" />
            <stop offset="1" stopColor="#070814" />
          </radialGradient>
        </defs>
        <rect x="-48" y="-36" width="96" height="72" fill="url(#glow)" />
        <rect x="-3" y="-32" width="6" height="64" fill="#e9e4d6" opacity="0.04" />
        <rect x="-48" y="-3" width="96" height="6" fill="#e9e4d6" opacity="0.04" />
        {blocks.map((b, i) => (
          <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill="#1b1d33" opacity={b.o} />
        ))}
        <circle r="16.7" fill="none" stroke="#3ee8e0" strokeWidth="0.15" opacity="0.6" />
        <circle r="5" fill="none" stroke="#ff3b4f" strokeWidth="0.1" opacity="0.5" />
        {DISTRICTS.map((d) => {
          const [x, y] = squeeze(d.at);
          return (
            <g key={d.id}>
              <line x1={(x / Math.hypot(x, y)) * 16.7} y1={(y / Math.hypot(x, y)) * 16.7} x2={x} y2={y} stroke={HUE_HEX[d.hue]} strokeWidth="0.15" strokeDasharray="0.8 0.6" opacity="0.6" />
              <circle cx={x} cy={y} r="3.2" fill="none" stroke={HUE_HEX[d.hue]} strokeWidth="0.15" opacity="0.7" />
            </g>
          );
        })}
        <line x1="-10.8" y1="-11.6" x2={BACKROOM_AT[0]} y2={BACKROOM_AT[1]} stroke="#ff3b4f" strokeWidth="0.12" strokeDasharray="0.6 0.6" opacity="0.5" />
      </svg>
      <div className="pointer-events-none absolute inset-0">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => open(s.id)}
            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 text-center"
            style={{ left: at(s.at[0]), top: at(s.at[1]) }}
          >
            <span className="mx-auto block h-3 w-3 rotate-45" style={{ background: HUE_HEX[s.hue], boxShadow: `0 0 14px ${HUE_HEX[s.hue]}` }} />
            <span className="kanji mt-2 block text-[12px]" style={{ color: HUE_HEX[s.hue] }}>
              {s.glyph}
            </span>
            <span className="display block text-[1.4rem] text-hud">{s.name}</span>
          </button>
        ))}
        {DISTRICTS.map((d) => {
          const [x, y] = squeeze(d.at);
          return (
            <button
              key={d.id}
              onClick={() => (d.id === "arcade" ? useGame.getState().openGame(null) : useGame.getState().toast({ tone: "info", title: d.name, body: d.blurb }))}
              className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 text-center"
              style={{ left: at(x), top: at(y) }}
            >
              <span className="kanji block text-[12px]" style={{ color: HUE_HEX[d.hue] }}>
                {d.glyph}
              </span>
              <span className="display block text-[1.25rem] text-hud">{d.id === "arcade" ? "Arcade games" : d.name}</span>
            </button>
          );
        })}
        <button
          onClick={() => (backroomOpen ? open("backroom") : openBackroom())}
          className="pointer-events-auto absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2"
          style={{ left: at(BACKROOM_AT[0]), top: at(BACKROOM_AT[1]) }}
          aria-label={backroomOpen ? "Back alley" : "A dark alley"}
        >
          <span className={`block h-2 w-2 ${backroomOpen ? "bg-crimson" : "bg-hud/20"}`} />
        </button>
      </div>
    </div>
  );
}
