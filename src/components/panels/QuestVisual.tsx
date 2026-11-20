"use client";

import type { Hue, QuestVisual as Kind } from "@/config/types";
import { HUE_HEX } from "@/lib/sections";

/**
 * Each quest gets its own small environment, drawn in code. No screenshots
 * needed, nothing to download, and it reflects what the project does.
 */
export function QuestVisual({ kind, hue, title }: { kind: Kind; hue: Hue; title: string }) {
  const c = HUE_HEX[hue];
  return (
    <figure className="relative aspect-[16/7] overflow-hidden bg-[#0b0c18]" aria-label={`Illustration for ${title}`} role="img">
      <svg viewBox="0 0 320 140" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id={`grid-${kind}`} width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M10 0H0V10" fill="none" stroke="#e9e4d6" strokeOpacity="0.05" strokeWidth="0.5" />
          </pattern>
          <linearGradient id={`fade-${kind}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={c} stopOpacity="0.18" />
            <stop offset="1" stopColor={c} stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="320" height="140" fill={`url(#grid-${kind})`} />
        <rect width="320" height="140" fill={`url(#fade-${kind})`} />
        {kind === "ledger" ? <Ledger c={c} /> : null}
        {kind === "route" ? <Route c={c} /> : null}
        {kind === "sync" ? <Sync c={c} /> : null}
        {kind === "darkness" ? <Darkness c={c} /> : null}
        {kind === "detect" ? <Detect c={c} /> : null}
      </svg>
    </figure>
  );
}

/** Append-only records, the last one a correction; reviewers attached. */
function Ledger({ c }: { c: string }) {
  const xs = [30, 85, 140, 195, 250];
  return (
    <g fontFamily="var(--font-jet)" fontSize="7">
      {xs.map((x, i) => (
        <g key={x}>
          {i > 0 ? <line x1={x - 25} y1="70" x2={x} y2="70" stroke={c} strokeOpacity="0.6" /> : null}
          <rect x={x} y="52" width="30" height="36" fill="#0b0c18" stroke={i === 4 ? c : "#e9e4d6"} strokeOpacity={i === 4 ? 1 : 0.35} />
          <line x1={x + 5} y1="62" x2={x + 25} y2="62" stroke="#e9e4d6" strokeOpacity="0.3" />
          <line x1={x + 5} y1="68" x2={x + 20} y2="68" stroke="#e9e4d6" strokeOpacity="0.3" />
          <text x={x + 5} y="82" fill={i === 4 ? c : "#a39e90"}>{i === 4 ? "fix" : `#${i + 1}`}</text>
        </g>
      ))}
      {[40, 120, 200, 275].map((x, i) => (
        <g key={x} className="qv-pulse" style={{ animationDelay: `${i * 0.4}s` }}>
          <circle cx={x} cy={i % 2 ? 28 : 116} r="5" fill="none" stroke={c} />
          <line x1={x} y1={i % 2 ? 33 : 111} x2={x + 5} y2={i % 2 ? 52 : 88} stroke={c} strokeOpacity="0.4" strokeDasharray="2 2" />
        </g>
      ))}
    </g>
  );
}

function Route({ c }: { c: string }) {
  return (
    <g>
      {[0, 1, 2, 3].map((i) => (
        <ellipse key={i} cx="210" cy="60" rx={30 + i * 22} ry={18 + i * 13} fill="none" stroke="#e9e4d6" strokeOpacity={0.12 - i * 0.02} />
      ))}
      <path d="M24 118 C70 110 70 70 110 72 S160 108 196 86 S250 30 296 26" fill="none" stroke={c} strokeWidth="1.6" strokeDasharray="5 4" className="qv-dash" />
      {[
        [24, 118],
        [110, 72],
        [196, 86],
        [296, 26],
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={i === 3 ? 5 : 3.5} fill="#0b0c18" stroke={c} strokeWidth="1.4" />
          {i === 3 ? <circle cx={x} cy={y} r="10" fill="none" stroke={c} strokeOpacity="0.5" className="qv-pulse" /> : null}
        </g>
      ))}
    </g>
  );
}

function Sync({ c }: { c: string }) {
  return (
    <g fill="none" stroke="#e9e4d6" strokeOpacity="0.5">
      <rect x="34" y="40" width="34" height="62" rx="4" />
      <rect x="128" y="34" width="72" height="48" />
      <path d="M118 88h92" />
      <rect x="246" y="44" width="46" height="60" rx="3" />
      <circle cx="164" cy="118" r="7" stroke={c} strokeOpacity="1" />
      {[
        "M68 72 Q110 118 157 118",
        "M171 118 Q220 118 246 76",
        "M164 82 V111",
      ].map((d, i) => (
        <path key={d} d={d} stroke={c} strokeOpacity="0.8" strokeDasharray="3 4" className="qv-dash" style={{ animationDelay: `${i * 0.3}s` }} />
      ))}
    </g>
  );
}

function Darkness({ c }: { c: string }) {
  return (
    <g>
      <defs>
        <linearGradient id="dk" x1="0" x2="1">
          <stop offset="0" stopColor="#000" />
          <stop offset="1" stopColor="#e9e4d6" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <rect x="20" y="96" width="280" height="10" fill="url(#dk)" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <line x1={20 + i * 70} y1="90" x2={20 + i * 70} y2="112" stroke={c} strokeOpacity={i === 0 || i === 4 ? 0 : 0.7} />
          <ellipse cx={45 + i * 58} cy="48" rx="16" ry="21" fill="none" stroke="#e9e4d6" strokeOpacity={0.1 + i * 0.18} />
          <circle cx={45 + i * 58 - 6} cy="44" r="1.6" fill="#e9e4d6" fillOpacity={0.1 + i * 0.18} />
          <circle cx={45 + i * 58 + 6} cy="44" r="1.6" fill="#e9e4d6" fillOpacity={0.1 + i * 0.18} />
        </g>
      ))}
      <rect x="20" y="20" width="2" height="60" fill={c} className="qv-scan" />
    </g>
  );
}

function Detect({ c }: { c: string }) {
  return (
    <g fontFamily="var(--font-jet)" fontSize="7">
      <rect x="0" y="100" width="320" height="16" fill="#e9e4d6" fillOpacity="0.06" />
      {Array.from({ length: 16 }, (_, i) => (
        <line key={i} x1={i * 22} y1="100" x2={i * 22 - 6} y2="116" stroke="#e9e4d6" strokeOpacity="0.12" />
      ))}
      {[
        [40, 70, 30, 30],
        [120, 58, 26, 42],
        [196, 74, 40, 26],
        [262, 64, 22, 36],
      ].map(([x, y, w, h], i) => (
        <g key={i}>
          <rect x={x} y={y} width={w} height={h} fill="#e9e4d6" fillOpacity="0.12" />
          <rect x={x - 4} y={y - 4} width={w + 8} height={h + 8} fill="none" stroke={c} className="qv-pulse" style={{ animationDelay: `${i * 0.35}s` }} />
          <text x={x - 4} y={y - 7} fill={c}>item {i + 1}</text>
        </g>
      ))}
    </g>
  );
}
