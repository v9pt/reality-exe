"use client";

import { useEffect, useRef } from "react";
import { openQuestSlots, quests } from "@/config/portfolio";
import type { Quest } from "@/config/types";
import { HUE_HEX, SECTIONS } from "@/lib/sections";
import { useGame } from "@/store/game";
import { Label, Sheet } from "../ui/Sheet";
import { QuestVisual } from "./QuestVisual";

const INK: Record<Quest["hue"], string> = {
  cyan: "var(--color-cyan-ink)",
  violet: "var(--color-violet-ink)",
  crimson: "var(--color-crimson-ink)",
  amber: "var(--color-amber-ink)",
};

export function QuestsPanel() {
  const slug = useGame((s) => s.questSlug);
  const setQuest = useGame((s) => s.setQuest);
  const selected = quests.find((q) => q.slug === slug) ?? null;
  const detailRef = useRef<HTMLDivElement>(null);

  // On wide screens, always show a quest; on phones the list comes first.
  useEffect(() => {
    if (!slug && window.matchMedia("(min-width: 768px)").matches) setQuest(quests[0].slug);
  }, [slug, setQuest]);

  useEffect(() => {
    if (selected) detailRef.current?.scrollTo({ top: 0 });
  }, [selected]);

  return (
    <Sheet glyph={SECTIONS[1].glyph} title="Quest board" subtitle="Projects and the engineering behind them. Pick one to read the briefing." wide>
      <div className="grid gap-6 md:grid-cols-[250px_1fr]">
        <ul className={`${selected ? "hidden md:block" : ""}`} aria-label="Quests">
          {quests.map((q, i) => {
            const active = q.slug === selected?.slug;
            return (
              <li key={q.slug}>
                <button
                  onClick={() => setQuest(q.slug)}
                  aria-current={active || undefined}
                  className={`group relative mb-2 block w-full border px-3 py-3 text-left transition-colors ${active ? "border-ink bg-ink text-paper" : "border-ink/25 hover:border-ink"}`}
                >
                  <span className="flex items-center justify-between gap-2 text-[12px]">
                    <span style={{ color: active ? HUE_HEX[q.hue] : INK[q.hue] }} className="font-bold">
                      {q.kind}
                    </span>
                    <span className={active ? "text-paper/60" : "text-ink-3"}>{q.period ?? ""}</span>
                  </span>
                  <span className="display mt-1 block text-[1.55rem] leading-[0.95]">{q.title}</span>
                  <span className={`mt-1 line-clamp-2 block text-[13px] ${active ? "text-paper/75" : "text-ink-2"}`}>{q.tagline}</span>
                  <span className="sr-only">Quest {i + 1} of {quests.length}</span>
                </button>
              </li>
            );
          })}
          {Array.from({ length: openQuestSlots }, (_, i) => (
            <li key={`slot-${i}`} className="mb-2 border border-dashed border-ink/30 px-3 py-3 text-ink-3">
              <span className="text-[12px]">Open slot</span>
              <span className="display block text-[1.4rem]">Next quest</span>
              <span className="text-[13px]">Reserved for what gets built next.</span>
            </li>
          ))}
        </ul>

        {selected ? (
          <div ref={detailRef} className="min-w-0">
            <button onClick={() => setQuest(null)} className="mb-3 text-[13px] font-bold text-crimson-ink md:hidden">
              ← All quests
            </button>
            <Briefing q={selected} />
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}

function Briefing({ q }: { q: Quest }) {
  const ink = INK[q.hue];
  return (
    <article aria-labelledby={`q-${q.slug}`}>
      {q.images?.length ? (
        <div className="mb-3 grid gap-2">
          {q.images.map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={img.src} src={img.src} alt={img.alt} className="w-full" loading="lazy" />
          ))}
        </div>
      ) : (
        <QuestVisual kind={q.visual} hue={q.hue} title={q.title} />
      )}

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 id={`q-${q.slug}`} className="display text-[2.6rem]">
          {q.title}
        </h3>
        <p className="text-[13px] text-ink-3">
          {[q.kind, q.period].filter(Boolean).join(", ")}
        </p>
      </div>
      {q.context ? <p className="text-[14px] text-ink-2">{q.context}</p> : null}
      <p className="mt-3 max-w-[64ch] text-[16px] leading-relaxed">{q.description ?? q.tagline}</p>

      {q.problem ? (
        <section className="mt-6">
          <Label>Objective</Label>
          <p className="mt-1 max-w-[64ch] border-l-2 pl-3 text-[15px] leading-relaxed text-ink-2" style={{ borderColor: ink }}>
            {q.problem}
          </p>
        </section>
      ) : null}

      {q.pipeline?.length ? (
        <section className="mt-6">
          <Label>How it flows</Label>
          <ol className="mt-2 grid gap-px bg-ink/20 sm:grid-cols-2 xl:grid-cols-3">
            {q.pipeline.map((p, i) => (
              <li key={p.name} className="bg-paper p-3">
                <span className="text-[12px] font-bold" style={{ color: ink }}>
                  Stage {i + 1}
                </span>
                <span className="block text-[15px] font-bold">{p.name}</span>
                <span className="block text-[13px] text-ink-2">{p.method}</span>
                <span className="mt-1 block text-[13px] text-ink-3">{p.detail}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {q.decisions?.length ? (
        <section className="mt-6">
          <Label>Engineering decisions</Label>
          <ul className="mt-1">
            {q.decisions.map((d) => (
              <li key={d} className="rule flex gap-3 py-2.5 text-[15px] leading-relaxed">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rotate-45" style={{ background: ink }} />
                <span className="max-w-[64ch]">{d}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {q.features?.length ? (
        <section className="mt-6">
          <Label>Features</Label>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {q.features.map((f) => (
              <li key={f} className="border border-ink/20 px-3 py-2 text-[14px] leading-snug">
                {f}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {q.stack?.length ? (
        <section className="mt-6">
          <Label>Equipment</Label>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {q.stack.map((s) => (
              <li key={s} className="bg-ink px-2 py-1 text-[13px] text-paper">
                {s}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {q.links && (q.links.github || q.links.demo || q.links.writeup) ? (
        <section className="mt-7 flex flex-wrap gap-2">
          {q.links.demo ? <LinkButton href={q.links.demo} primary>Visit the live site</LinkButton> : null}
          {q.links.github ? <LinkButton href={q.links.github}>{q.links.github.split("/").length > 4 ? "View the code" : "GitHub profile"}</LinkButton> : null}
          {q.links.writeup ? <LinkButton href={q.links.writeup}>Read the write-up</LinkButton> : null}
        </section>
      ) : null}
    </article>
  );
}

function LinkButton({ href, children, primary }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`px-4 py-2 text-[14px] font-bold ${primary ? "bg-crimson-ink text-paper hover:bg-ink" : "border border-ink hover:bg-ink hover:text-paper"}`}
    >
      {children}
    </a>
  );
}
