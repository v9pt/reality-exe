import type { Hue } from "./sections";

/**
 * Arcade catalogue. Original games in familiar genres: the names, art and
 * rules are this project's own.
 */
export type GameId = "skyhop" | "nullfleet" | "stackfall" | "snake" | "bughunt";

export type GameMeta = {
  id: GameId;
  title: string;
  glyph: string;
  genre: string;
  blurb: string;
  hue: Hue;
  keys: [string, string][];
  touch: string;
};

export const GAMES: GameMeta[] = [
  {
    id: "skyhop",
    title: "Skyhop",
    glyph: "翔",
    genre: "Gap runner",
    blurb: "Fly a courier drone through the gaps between signal pylons. One button.",
    hue: "cyan",
    keys: [["Space, W or click", "Thrust"], ["P", "Pause"]],
    touch: "Tap anywhere on the screen to thrust.",
  },
  {
    id: "nullfleet",
    title: "Null Fleet",
    glyph: "艦",
    genre: "Fixed shooter",
    blurb: "Hold the line against a descending formation of corrupted packets.",
    hue: "crimson",
    keys: [["A D or arrows", "Move"], ["Space", "Fire"], ["P", "Pause"]],
    touch: "Drag to steer, hold the fire button to shoot.",
  },
  {
    id: "stackfall",
    title: "Stackfall",
    glyph: "積",
    genre: "Falling blocks",
    blurb: "Rotate and drop data blocks; complete a row to clear it.",
    hue: "violet",
    keys: [
      ["Left, right", "Move"],
      ["Up or X", "Rotate clockwise"],
      ["Z", "Rotate anticlockwise"],
      ["Down", "Soft drop"],
      ["Space", "Hard drop"],
      ["C or Shift", "Hold"],
      ["P", "Pause"],
    ],
    touch: "Buttons below the board, or swipe: sideways to move, down to drop, tap to rotate.",
  },
  {
    id: "snake",
    title: "Signal Snake",
    glyph: "蛇",
    genre: "Snake",
    blurb: "Grow a signal trace by collecting packets. Don't cross your own line.",
    hue: "amber",
    keys: [["WASD or arrows", "Turn"], ["P", "Pause"]],
    touch: "Swipe to turn, or use the pad.",
  },
  {
    id: "bughunt",
    title: "Bug Hunt",
    glyph: "虫",
    genre: "Reflex",
    blurb: "Squash as many bugs as you can in fifteen seconds.",
    hue: "violet",
    keys: [["Click", "Squash"]],
    touch: "Tap the bug.",
  },
];

/** The four cabinets on the arcade strip, in order along the back wall. */
export const CABINETS: GameId[] = ["skyhop", "nullfleet", "stackfall", "snake"];

export const gameById = (id: string) => GAMES.find((g) => g.id === id);
