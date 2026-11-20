import { BACKROOM_AT, DISTRICTS, SECTIONS } from "@/lib/sections";
import { OVERLOOK_Y } from "@/lib/world-map";

/**
 * In-world labels are plain DOM, positioned each frame by one projector
 * inside the canvas. One loop, no extra React roots.
 */
export const LABEL_HEIGHT: Record<string, number> = {
  profile: 5.2,
  quests: 6.0,
  skills: 6.1,
  log: 8.0,
  terminal: 4.3,
  contact: 9.2,
  backroom: 3.2,
};

/** `reach`: distance from the camera's focus at which the label starts to fade. */
export const anchors: { id: string; x: number; y: number; z: number; reach: number }[] = [
  ...SECTIONS.map((s) => ({ id: s.id, x: s.at[0], y: LABEL_HEIGHT[s.id], z: s.at[1], reach: 22 })),
  { id: "backroom", x: BACKROOM_AT[0], y: LABEL_HEIGHT.backroom, z: BACKROOM_AT[1], reach: 22 },
  ...DISTRICTS.map((d) => ({
    id: d.id,
    x: d.at[0],
    y: d.labelY + (d.id === "overlook" ? OVERLOOK_Y - 6 : 0),
    z: d.at[1],
    reach: 60,
  })),
];

export const labelEls = new Map<string, HTMLElement>();
