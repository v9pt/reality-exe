"use client";

import { achievements, profile, quests, roles, skillTree } from "@/config/portfolio";
import { HUE_HEX, SECTIONS } from "@/lib/sections";
import { useGame } from "@/store/game";
import { Label, Sheet } from "../ui/Sheet";

/**
 * RPG character screen. No invented stats: the "attributes" are the actual
 * technology groups, and the counts are counts of real entries in the config.
 */
export function ProfilePanel() {
  const open = useGame((s) => s.open);
  const sec = SECTIONS[0];
  const record: [string, number, () => void][] = [
    ["Quests", quests.length, () => open("quests")],
    ["Roles", roles.length, () => open("log")],
    ["Feats", achievements.length, () => open("log")],
    ["Skills", skillTree.reduce((n, c) => n + c.skills.length, 0), () => open("skills")],
  ];
  return (
    <Sheet glyph={sec.glyph} title={profile.name} subtitle={`${profile.title}. ${profile.location}.`}>
      <div className="grid gap-6 sm:grid-cols-[180px_1fr]">
        {/* Portrait plate: the in-world avatar's silhouette, drawn not photographed. */}
        <figure className="relative aspect-[3/4] overflow-hidden bg-ink" aria-hidden>
          <svg viewBox="0 0 120 160" className="absolute inset-0 h-full w-full">
            <defs>
              <linearGradient id="pf-bg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#1b1d33" />
                <stop offset="1" stopColor="#3a1222" />
              </linearGradient>
            </defs>
            <rect width="120" height="160" fill="url(#pf-bg)" />
            {Array.from({ length: 9 }, (_, i) => (
              <rect key={i} x={6 + i * 13} y={40 + ((i * 37) % 50)} width="8" height="160" fill="#0b0c18" opacity="0.8" />
            ))}
            <path d="M60 46c-9 0-14 7-14 15 0 6 3 11 7 13l-17 8c-5 2-8 8-9 14l-6 64h78l-6-64c-1-6-4-12-9-14l-17-8c4-2 7-7 7-13 0-8-5-15-14-15z" fill="#0d0d14" />
            <path d="M45 82l15 10 15-10 4 3-19 13-19-13z" fill="#c41a2e" />
            <rect x="49" y="58" width="22" height="3" fill="#3ee8e0" />
            <path d="M36 96l-6 64h12l4-52z M84 96l6 64H78l-4-52z" fill="#7d1020" opacity="0.8" />
          </svg>
          <figcaption className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black/80 p-2 text-[11px] text-hud">
            <span className="kanji text-cyan">技術者</span> Engineer class
          </figcaption>
        </figure>

        <div className="min-w-0">
          {profile.bio.map((p) => (
            <p key={p} className="mb-3 max-w-[62ch] text-[15px] leading-relaxed text-ink-2">
              {p}
            </p>
          ))}
          <dl className="mt-4">
            <Row k="Class" v={profile.title} />
            <Row k="Origin" v={`${profile.education.school}`} />
            <Row k="Training" v={`${profile.education.degree}, ${profile.education.period}`} />
            <Row k="Handle" v={profile.handle} />
          </dl>
        </div>
      </div>

      <Label className="mt-8">Record</Label>
      <p className="text-[13px] text-ink-3">Counts of what’s in this portfolio. Select one to go there.</p>
      <div className="mt-3 grid grid-cols-2 gap-px bg-ink/20 sm:grid-cols-4">
        {record.map(([k, n, go]) => (
          <button key={k} onClick={go} className="group bg-paper px-3 py-3 text-left hover:bg-paper-2">
            <span className="display block text-[2.6rem] text-ink group-hover:text-crimson-ink">{n}</span>
            <span className="text-[13px] text-ink-2">{k}</span>
          </button>
        ))}
      </div>

      <Label className="mt-8">Current focus</Label>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {profile.interests.map((i, n) => (
          <li key={i} className="flex items-center gap-3 border border-ink/20 px-3 py-2 text-[14px]">
            <span className="h-2 w-2 rotate-45" style={{ background: Object.values(HUE_HEX)[n % 4] }} />
            {i}
          </li>
        ))}
      </ul>

      <Label className="mt-8">Attributes</Label>
      <p className="text-[13px] text-ink-3">Technology groups and what’s equipped in each. No made-up levels.</p>
      <div className="mt-3">
        {skillTree.map((c) => (
          <div key={c.id} className="rule grid grid-cols-[2.2rem_8.5rem_1fr] items-baseline gap-2 py-2.5">
            <span className="kanji text-[15px] text-crimson-ink">{c.glyph}</span>
            <span className="text-[14px] font-bold">{c.name}</span>
            <span className="text-[14px] text-ink-2">{c.skills.map((s) => s.name).join(", ")}</span>
          </div>
        ))}
      </div>
      <button onClick={() => open("skills")} className="mt-4 bg-ink px-4 py-2 text-[14px] font-bold text-paper hover:bg-crimson-ink">
        Open the skill tree
      </button>
    </Sheet>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="rule grid grid-cols-[6rem_1fr] gap-3 py-2 text-[14px]">
      <dt className="text-ink-3">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
