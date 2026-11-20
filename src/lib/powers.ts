import type { Hue } from "./sections";

/**
 * The visitor's abilities. Original names and looks; the mechanics are the
 * genre staples (line swinging, a stretching reach, super speed and so on).
 * All share one energy meter that refills on its own.
 */
export type PowerId = "grapple" | "reach" | "overdrive" | "leap" | "slam" | "blink";

export type Power = {
  id: PowerId;
  name: string;
  glyph: string;
  hue: Hue;
  /** Energy spent when used (per second for Overdrive). */
  cost: number;
  how: string;
  touch: string;
  /** What it does while driving the kart. */
  kart: string;
};

export const POWERS: Power[] = [
  {
    id: "grapple",
    name: "Grapple line",
    glyph: "糸",
    hue: "cyan",
    cost: 8,
    how: "Hold F to fire a line at the nearest rooftop and swing; steer with WASD, let go to fly. Fire again mid-swing to chain. In open sky a courier drone catches the line.",
    touch: "Hold the power button to swing, release to fly.",
    kart: "hops you out and swings",
  },
  {
    id: "reach",
    name: "Elastic reach",
    glyph: "伸",
    hue: "crimson",
    cost: 18,
    how: "Press F: your arm stretches to a rooftop or landmark ahead and slings you to it.",
    touch: "Tap the power button to stretch and sling.",
    kart: "hops you out and slings",
  },
  {
    id: "overdrive",
    name: "Overdrive",
    glyph: "速",
    hue: "amber",
    cost: 10,
    how: "Press F to toggle super speed. Leaves a trail of afterimages; drains energy while on.",
    touch: "Tap the power button to toggle super speed.",
    kart: "boost",
  },
  {
    id: "leap",
    name: "Sky leap",
    glyph: "跳",
    hue: "violet",
    cost: 15,
    how: "Press F for a huge jump, and once more in mid-air for extra lift. Hold F on the way down to glide.",
    touch: "Tap to leap (again in the air for more), hold to glide.",
    kart: "kart jump",
  },
  {
    id: "slam",
    name: "Ground slam",
    glyph: "衝",
    hue: "crimson",
    cost: 10,
    how: "Press F to dive and land with a shockwave. From the ground you spring up first.",
    touch: "Tap the power button to spring up and slam down.",
    kart: "hop and slam",
  },
  {
    id: "blink",
    name: "Blink",
    glyph: "瞬",
    hue: "cyan",
    cost: 22,
    how: "Press F to flash forward up to twelve metres, stopping short of walls.",
    touch: "Tap the power button to blink forward.",
    kart: "dash forward",
  },
];

export const ENERGY_MAX = 100;
export const ENERGY_REGEN = 16;

export const powerById = (id: string) => POWERS.find((p) => p.id === id);

/** Spend energy if there's enough. Returns the new value, or null when it would go below zero. */
export function spend(energy: number, cost: number) {
  return energy >= cost ? energy - cost : null;
}
