/**
 * Content types for REALITY.EXE. Every field the UI renders comes from
 * `portfolio.ts`; optional fields are simply hidden when absent, so nothing
 * on the site is ever filler.
 */

export type LinkSet = {
  github?: string;
  demo?: string;
  writeup?: string;
};

export type PipelineStage = {
  name: string;
  method: string;
  detail: string;
};

/** Visual theme for the procedurally drawn quest preview (no screenshots needed). */
export type QuestVisual =
  | "ledger" // linked records, for audit/verification work
  | "route" // a plotted route over a map grid
  | "sync" // devices kept in step
  | "darkness" // a gradient from black to light with a face-ish scan
  | "detect"; // bounding boxes on a conveyor

export type Quest = {
  slug: string;
  title: string;
  /** One line shown on the quest board. */
  tagline: string;
  /** Kind of work, shown as the quest type. Use what it actually was. */
  kind: string;
  period?: string;
  context?: string;
  description?: string;
  problem?: string;
  decisions?: string[];
  features?: string[];
  stack?: string[];
  pipeline?: PipelineStage[];
  /** Optional screenshot paths under /public. Rendered before the procedural preview. */
  images?: { src: string; alt: string }[];
  links?: LinkSet;
  visual: QuestVisual;
  /** Accent hue for this quest's environment: "cyan" | "violet" | "crimson" | "amber". */
  hue: Hue;
};

export type Hue = "cyan" | "violet" | "crimson" | "amber";

export type Role = {
  id: string;
  organisation: string;
  role: string;
  period: string;
  location?: string;
  points: string[];
};

export type Achievement = {
  title: string;
  detail?: string;
};

export type SkillCategory = {
  id: string;
  name: string;
  /** Short kanji mark used as the node glyph. */
  glyph: string;
  note?: string;
  skills: Skill[];
};

export type Skill = {
  name: string;
  /** Other spellings to look for when finding where a skill was used. */
  aliases?: string[];
};

export type Profile = {
  name: string;
  handle: string;
  title: string;
  location: string;
  bio: string[];
  interests: string[];
  education: {
    school: string;
    short: string;
    degree: string;
    period: string;
  };
  contact: {
    email: string;
    github: string;
    linkedin?: string;
    leetcode?: string;
    /** Path under /public, e.g. "/resume.pdf". The resume button is hidden while unset. */
    resume?: string;
  };
};
