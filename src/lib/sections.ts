/**
 * The six locations of District V9 plus the outer districts. The 3D world,
 * the map nav, the keyboard shortcuts and the terminal all read these lists,
 * so they never disagree.
 */
export type SectionId = "profile" | "quests" | "skills" | "log" | "terminal" | "contact";
export type PanelId = SectionId | "secret" | "backroom" | "arcade";
export type Hue = "cyan" | "violet" | "crimson" | "amber";

export type Section = {
  id: SectionId;
  /** Name in the map and nav. */
  name: string;
  /** Name of the place in the city. */
  place: string;
  glyph: string;
  hotkey: string;
  /** World position on the plaza (x, z). */
  at: [number, number];
  /** Accent colour token. */
  hue: Hue;
};

export const SECTIONS: Section[] = [
  { id: "profile", name: "Character", place: "Mirror booth", glyph: "人物", hotkey: "1", at: [-7, -3], hue: "cyan" },
  { id: "quests", name: "Quests", place: "Notice board", glyph: "依頼", hotkey: "2", at: [0, -11], hue: "crimson" },
  { id: "skills", name: "Skill tree", place: "Light shrine", glyph: "技能", hotkey: "3", at: [8, -4], hue: "violet" },
  { id: "log", name: "Archive", place: "Record tower", glyph: "記録", hotkey: "4", at: [9, 6], hue: "amber" },
  { id: "terminal", name: "Terminal", place: "Street terminal", glyph: "端末", hotkey: "5", at: [-9, 6], hue: "cyan" },
  { id: "contact", name: "Comms", place: "Signal mast", glyph: "通信", hotkey: "6", at: [0, 12], hue: "crimson" },
];

/** Outer districts. Reached on foot down the avenues, or by fast travel. */
export type DistrictId = "arcade" | "garden" | "overlook";

export type District = {
  id: DistrictId;
  name: string;
  glyph: string;
  hotkey: string;
  /** Centre of the district (x, z), used for labels and maps. */
  at: [number, number];
  /** Where fast travel drops you, and the direction you face (radians). */
  spawn: [number, number];
  face: number;
  /** Label height above the ground. */
  labelY: number;
  hue: Hue;
  blurb: string;
};

export const DISTRICTS: District[] = [
  { id: "arcade", name: "Arcade", glyph: "遊技場", hotkey: "7", at: [67, 0], spawn: [59, 0], face: Math.PI / 2, labelY: 7.5, hue: "violet", blurb: "Four cabinets at the end of the east avenue." },
  { id: "garden", name: "Garden", glyph: "庭園", hotkey: "8", at: [-66, 0], spawn: [-55, 0], face: -Math.PI / 2, labelY: 6.5, hue: "cyan", blurb: "Trees and a still pond at the end of the west avenue." },
  { id: "overlook", name: "Overlook", glyph: "展望台", hotkey: "9", at: [0, -72], spawn: [0, -67], face: Math.PI, labelY: 11, hue: "amber", blurb: "A raised deck north of the plaza. Take the ramp up." },
];

/** Hidden alley, revealed by walking there or by `cd backroom`. */
export const BACKROOM_AT: [number, number] = [-19, -16];

export const HUE_HEX: Record<Hue, string> = {
  cyan: "#3ee8e0",
  violet: "#8b6cff",
  crimson: "#ff3b4f",
  amber: "#ffb547",
};

export function sectionById(id: string) {
  return SECTIONS.find((s) => s.id === id);
}

export function districtById(id: string) {
  return DISTRICTS.find((d) => d.id === id);
}
