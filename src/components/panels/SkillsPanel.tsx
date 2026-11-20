"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { skillTree } from "@/config/portfolio";
import type { Skill, SkillCategory } from "@/config/types";
import { evidenceFor } from "@/lib/evidence";
import { SECTIONS } from "@/lib/sections";
import { useGame } from "@/store/game";
import { Label, Sheet } from "../ui/Sheet";

type Node = { cat: SkillCategory; skill: Skill; x: number; y: number; used: boolean; label: "right" | "left" | null };

/** Centre of the tree in the 0–100 box: left of middle, so the open branch has room for its labels. */
const CX = 36;
const CY = 50;
const HUB_R = 17;

/**
 * Lay the tree out around the selected branch. The selected branch always
 * points right, into the open space, with its skills fanned on an even arc
 * and labelled; every other branch shares the rest of the circle as a small
 * unlabelled cluster. Recomputed on every selection, and the nodes glide to
 * their new places.
 */
function layoutFor(catId: string) {
  const sel = skillTree.findIndex((c) => c.id === catId);
  const others = skillTree.length - 1;
  const cats = skillTree.map((cat, i) => {
    let a = 0;
    if (i !== sel) {
      // Spread the other branches over the left side, keeping clear of the fan.
      const k = (i - sel + skillTree.length) % skillTree.length; // 1..others
      a = 1.25 + ((k - 0.5) / others) * (Math.PI * 2 - 2.5);
    }
    return { cat, a, x: CX + Math.cos(a) * HUB_R, y: CY + Math.sin(a) * HUB_R };
  });
  const nodes: Node[] = [];
  cats.forEach(({ cat, a }, i) => {
    const n = cat.skills.length;
    const open = i === sel;
    // The open branch fans wide on a bigger radius; closed branches stay compact.
    const spread = open ? Math.min(2.1, 0.26 * (n - 1)) : Math.min(0.5, 0.08 * (n - 1));
    const r = open ? 36 : 32;
    cat.skills.forEach((skill, j) => {
      const t = n === 1 ? 0 : j / (n - 1) - 0.5;
      const aa = a + t * spread;
      const x = CX + Math.cos(aa) * (r + (open ? 0 : (j % 2) * 4));
      const y = CY + Math.sin(aa) * (r + (open ? 0 : (j % 2) * 4));
      nodes.push({ cat, skill, x, y, used: evidenceFor(skill).length > 0, label: open ? "right" : null });
    });
  });
  return { cats, nodes };
}

/**
 * A radial skill tree. A node is filled when the skill shows up in a
 * project or role on this site; outlined when it's listed but not yet
 * written up. That's the only "progression" shown: no invented levels.
 */
export function SkillsPanel() {
  const openQuest = useGame((s) => s.openQuest);
  const open = useGame((s) => s.open);
  const reducedMotion = useGame((s) => s.reducedMotion);
  const [catId, setCatId] = useState<string>(skillTree[0].id);
  const [skillName, setSkillName] = useState<string | null>(null);

  const layout = useMemo(() => layoutFor(catId), [catId]);

  const cat = skillTree.find((c) => c.id === catId)!;
  const skill = cat.skills.find((s) => s.name === skillName) ?? null;
  const evidence = skill ? evidenceFor(skill) : [];

  const pick = (c: SkillCategory, s?: Skill) => {
    setCatId(c.id);
    setSkillName(s?.name ?? null);
  };

  // Arrow keys step through branches while the tree has focus.
  const step = (d: number) => {
    const i = skillTree.findIndex((c) => c.id === catId);
    pick(skillTree[(i + d + skillTree.length) % skillTree.length]);
  };

  const ease = reducedMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 170, damping: 24 };
  const glide = reducedMotion ? "" : "transition-[left,top] duration-500 ease-[cubic-bezier(.2,.9,.1,1)]";

  return (
    <Sheet glyph={SECTIONS[2].glyph} title="Skill tree" subtitle="Select a branch or a node. Filled nodes link to where the skill was actually used." wide>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Tree: lines in SVG, nodes as real buttons on top. Hidden on phones, where the list below is easier. */}
        <div
          role="group"
          aria-label="Skill tree. Left and right arrow keys change branch."
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
              e.preventDefault();
              step(1);
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
              e.preventDefault();
              step(-1);
            }
          }}
          className="relative mx-auto hidden aspect-square w-full max-w-[560px] overflow-hidden bg-ink outline-none focus-visible:ring-2 focus-visible:ring-violet sm:block"
          // Labels size against the tree itself (cqw), so they fit at any width.
          style={{ clipPath: "polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,18px 100%,0 calc(100% - 18px))", containerType: "inline-size" }}
        >
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
            <circle cx={CX} cy={CY} r={HUB_R} fill="none" stroke="#e9e4d6" strokeOpacity="0.08" strokeWidth="0.3" />
            <circle cx={CX} cy={CY} r="36" fill="none" stroke="#e9e4d6" strokeOpacity="0.05" strokeWidth="0.3" />
            {layout.cats.map(({ cat: c, x, y }) => (
              <motion.line
                key={c.id}
                x1={CX}
                y1={CY}
                initial={false}
                animate={{ x2: x, y2: y }}
                transition={ease}
                stroke={c.id === catId ? "#8b6cff" : "#e9e4d6"}
                strokeOpacity={c.id === catId ? 0.9 : 0.2}
                strokeWidth="0.4"
              />
            ))}
            {layout.nodes.map((n) => {
              const p = layout.cats.find((c) => c.cat.id === n.cat.id)!;
              const on = n.cat.id === catId;
              return (
                <motion.line
                  key={n.cat.id + n.skill.name}
                  initial={false}
                  animate={{ x1: p.x, y1: p.y, x2: n.x, y2: n.y }}
                  transition={ease}
                  stroke={on ? "#8b6cff" : "#e9e4d6"}
                  strokeOpacity={on ? 0.7 : 0.12}
                  strokeWidth="0.3"
                />
              );
            })}
          </svg>
          <div className="absolute grid h-[13%] w-[13%] -translate-x-1/2 -translate-y-1/2 rotate-45 place-items-center border border-violet bg-[#140f2b]" style={{ left: `${CX}%`, top: `${CY}%` }}>
            <span className="kanji -rotate-45 text-[clamp(10px,2vw,15px)] text-violet">核心</span>
          </div>
          {layout.cats.map(({ cat: c, x, y }) => (
            <button
              key={c.id}
              onClick={() => pick(c)}
              aria-pressed={c.id === catId}
              aria-label={c.name}
              className={`group absolute grid h-[9.5%] w-[9.5%] -translate-x-1/2 -translate-y-1/2 place-items-center border transition-colors ${glide} ${c.id === catId ? "border-violet bg-violet text-night" : "border-hud/40 bg-night text-hud hover:border-violet"}`}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <span className="kanji text-[clamp(11px,2.2vw,17px)]">{c.glyph}</span>
              {/* Branch name: always shown for the open branch, on hover for the rest. */}
              <span
                className={`pointer-events-none absolute top-full left-1/2 mt-1 -translate-x-1/2 whitespace-nowrap bg-ink/90 px-1 text-[clamp(8px,2.1cqw,12px)] ${c.id === catId ? "text-violet" : "text-hud opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}
              >
                {c.name}
              </span>
            </button>
          ))}
          {layout.nodes.map((n) => {
            const active = n.cat.id === catId && n.skill.name === skillName;
            const inCat = n.cat.id === catId;
            return (
              <button
                key={n.cat.id + n.skill.name}
                onClick={() => pick(n.cat, n.skill)}
                aria-pressed={active}
                aria-label={`${n.skill.name}${n.used ? ", used in this portfolio" : ", listed"}`}
                className={`group absolute -translate-x-1/2 -translate-y-1/2 p-1.5 ${glide} ${inCat ? "z-10" : ""}`}
                style={{ left: `${n.x}%`, top: `${n.y}%` }}
              >
                <span
                  className={`block rotate-45 border transition-transform group-hover:scale-150 ${inCat ? "h-3 w-3" : "h-2 w-2"} ${active ? "scale-150" : ""}`}
                  style={{
                    borderColor: inCat ? "#8b6cff" : "rgb(233 228 214 / 0.5)",
                    background: n.used ? (inCat ? "#8b6cff" : "rgb(233 228 214 / 0.55)") : "transparent",
                    boxShadow: active ? "0 0 12px #8b6cff" : undefined,
                  }}
                />
                {n.label ? (
                  <span className={`pointer-events-none absolute top-1/2 left-full -translate-y-1/2 pl-1 whitespace-nowrap text-[clamp(8px,2.3cqw,13px)] ${active ? "font-bold text-white" : "text-hud"}`}>{n.skill.name}</span>
                ) : (
                  // Closed branches: name on hover or focus, drawn above everything else.
                  <span
                    className={`pointer-events-none absolute bottom-full z-20 mb-1 whitespace-nowrap bg-ink/95 px-1 text-[11px] text-hud opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 ${n.x < 18 ? "left-0" : n.x > 82 ? "right-0" : "left-1/2 -translate-x-1/2"}`}
                  >
                    {n.skill.name}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Detail column, and the full list on phones. */}
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5 sm:hidden">
            {skillTree.map((c) => (
              <button key={c.id} onClick={() => pick(c)} aria-pressed={c.id === catId} className={`px-2 py-1 text-[13px] ${c.id === catId ? "bg-ink text-paper" : "border border-ink/30"}`}>
                <span className="kanji mr-1">{c.glyph}</span>
                {c.name}
              </button>
            ))}
          </div>

          <p className="kanji mt-4 text-[13px] text-violet-ink sm:mt-0">{cat.glyph}</p>
          <h3 className="display text-[2.2rem]">{cat.name}</h3>
          {cat.note ? <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{cat.note}</p> : null}
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {cat.skills.map((s) => {
              const used = evidenceFor(s).length > 0;
              const active = s.name === skillName;
              return (
                <li key={s.name}>
                  <button
                    onClick={() => pick(cat, s)}
                    aria-pressed={active}
                    className={`flex items-center gap-1.5 px-2 py-1 text-[13px] ${active ? "bg-violet-ink text-paper" : "border border-ink/30 hover:border-ink"}`}
                  >
                    <span className={`h-1.5 w-1.5 rotate-45 border ${active ? "border-paper" : "border-ink"} ${used ? (active ? "bg-paper" : "bg-ink") : ""}`} />
                    {s.name}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-5 min-h-[9rem]">
            {skill ? (
              <>
                <Label>{skill.name}</Label>
                {evidence.length ? (
                  <ul className="mt-1">
                    {evidence.map((e) => (
                      <li key={e.kind + e.id} className="rule py-2.5">
                        <button
                          onClick={() => (e.kind === "quest" ? openQuest(e.id) : open("log"))}
                          className="text-left text-[14px] font-bold text-violet-ink underline decoration-violet-ink/30 underline-offset-2 hover:decoration-violet-ink"
                        >
                          {e.label}
                        </button>
                        {e.quote ? <p className="mt-1 text-[13px] leading-snug text-ink-2">{e.quote}</p> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[14px] text-ink-2">Listed skill. There’s no project or role write-up for it on this site yet.</p>
                )}
              </>
            ) : (
              <p className="text-[14px] text-ink-3">Select a node to see where it was used.</p>
            )}
          </div>

          <div className="rule mt-4 flex gap-4 pt-3 text-[12px] text-ink-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rotate-45 bg-ink" /> Used in a project or role here
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rotate-45 border border-ink" /> Listed
            </span>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
