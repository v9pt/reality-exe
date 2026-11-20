"use client";

import { achievements, profile, quests, roles } from "@/config/portfolio";
import { SECTIONS } from "@/lib/sections";
import { useGame } from "@/store/game";
import { Label, Sheet } from "../ui/Sheet";

type Entry = {
  key: string;
  kind: string;
  title: string;
  org: string;
  period: string;
  location?: string;
  points: string[];
  quest?: string;
};

/** The archive: experience, the thesis, and education, newest first, as an achievement history. */
export function LogPanel() {
  const openQuest = useGame((s) => s.openQuest);
  const thesis = quests.find((q) => q.kind === "Thesis");
  const role = (i: number, kind: string): Entry => {
    const r = roles[i];
    return { key: r.id, kind, title: r.role, org: r.organisation, period: r.period, location: r.location, points: r.points, quest: r.id === "tilantra" ? "capsulehub" : undefined };
  };
  const entries: Entry[] = [
    role(0, "Internship"),
    ...(thesis
      ? [{ key: "thesis", kind: "Thesis", title: thesis.title, org: thesis.context ?? profile.education.short, period: thesis.period ?? "", points: [thesis.tagline], quest: thesis.slug }]
      : []),
    role(1, "Internship"),
    role(2, "Leadership"),
    { key: "edu", kind: "Education", title: profile.education.degree, org: profile.education.school, period: profile.education.period, points: [] },
  ];

  return (
    <Sheet glyph={SECTIONS[3].glyph} title="Archive" subtitle="Experience, education and milestones, newest first.">
      <ol className="relative">
        <span className="absolute top-2 bottom-2 left-[7px] w-px bg-ink/25" aria-hidden />
        {entries.map((e) => (
          <li key={e.key} className="relative pb-7 pl-8">
            <span className="absolute top-[7px] left-0 h-[15px] w-[15px] rotate-45 border-2 border-ink bg-paper" aria-hidden>
              <span className="absolute inset-[3px] bg-crimson-ink" />
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-[12px] font-bold text-crimson-ink">{e.kind}</span>
              <span className="text-[13px] text-ink-3">{e.period}</span>
            </div>
            <h3 className="display mt-0.5 text-[1.9rem]">{e.title}</h3>
            <p className="text-[14px] text-ink-2">
              {e.org}
              {e.location ? `, ${e.location}` : ""}
            </p>
            {e.points.length ? (
              <ul className="mt-2">
                {e.points.map((p) => (
                  <li key={p} className="rule max-w-[64ch] py-2 text-[14px] leading-relaxed">
                    {p}
                  </li>
                ))}
              </ul>
            ) : null}
            {e.quest ? (
              <button onClick={() => openQuest(e.quest!)} className="mt-2 text-[13px] font-bold text-crimson-ink underline decoration-crimson-ink/30 underline-offset-2">
                Open the related quest
              </button>
            ) : null}
          </li>
        ))}
      </ol>

      <Label className="mt-2">Feats</Label>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {achievements.map((a) => (
          <li key={a.title} className="flex items-start gap-3 bg-ink px-3 py-3 text-paper">
            <span className="kanji mt-0.5 border border-amber/60 px-1 text-[12px] text-amber">達成</span>
            <span>
              <span className="block text-[15px] font-bold">{a.title}</span>
              {a.detail ? <span className="text-[13px] text-paper/70">{a.detail}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      {profile.contact.leetcode ? (
        <p className="mt-4 text-[13px] text-ink-2">
          Problem-solving history is public on{" "}
          <a className="font-bold underline" href={profile.contact.leetcode} target="_blank" rel="noreferrer">
            LeetCode
          </a>
          .
        </p>
      ) : null}
    </Sheet>
  );
}
