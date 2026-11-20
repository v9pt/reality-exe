import { quests, roles, skillTree } from "@/config/portfolio";
import type { Skill } from "@/config/types";

export type Evidence = { kind: "quest" | "role"; id: string; label: string; quote?: string };

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matcher(skill: Skill) {
  const names = [skill.name, ...(skill.aliases ?? [])].map(escape);
  // Word-ish boundaries that also work for names like "C++" and "Next.js".
  return new RegExp(`(^|[^A-Za-z0-9+#])(${names.join("|")})(?![A-Za-z0-9+#])`, "i");
}

/**
 * Where a skill actually shows up in the portfolio: project stacks, project
 * write-ups and role descriptions. Derived from the config, never hand-scored.
 */
export function evidenceFor(skill: Skill): Evidence[] {
  const inner = matcher(skill);
  // Longer skills that start with this one ("React Native" for "React") are removed first.
  const longer = skillTree
    .flatMap((c) => c.skills)
    .filter((s) => s.name !== skill.name && s.name.toLowerCase().startsWith(skill.name.toLowerCase() + " "))
    .map((s) => new RegExp(escape(s.name), "gi"));
  const re = { test: (t: string) => inner.test(longer.reduce((acc, l) => acc.replace(l, " "), t)) };
  const out: Evidence[] = [];
  for (const q of quests) {
    const texts = [
      ...(q.stack ?? []),
      q.description ?? "",
      ...(q.decisions ?? []),
      ...(q.pipeline ?? []).map((p) => `${p.method} ${p.detail}`),
    ];
    const hit = texts.find((t) => re.test(t));
    if (hit) out.push({ kind: "quest", id: q.slug, label: q.title, quote: hit.length > 40 ? hit : undefined });
  }
  for (const r of roles) {
    const hit = r.points.find((p) => re.test(p));
    if (hit) out.push({ kind: "role", id: r.id, label: `${r.role}, ${r.organisation}`, quote: hit });
  }
  return out;
}
