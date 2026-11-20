import { BUTTONS, type Btn, type Controls } from "@/arcade/core";

/** Keyboard map shared by every game. Esc is left alone: it closes the sheet. */
const KEYMAP: Record<string, Btn> = {
  arrowleft: "left",
  a: "left",
  arrowright: "right",
  d: "right",
  arrowup: "up",
  w: "up",
  x: "up",
  arrowdown: "down",
  s: "down",
  " ": "action",
  enter: "action",
  c: "alt",
  shift: "alt",
  z: "alt2",
};

export type LiveControls = Controls & {
  press(b: Btn): void;
  release(b: Btn): void;
  reset(): void;
};

/** Mutable controls fed by keyboard and touch, read by the fixed-step loop. */
export function createControls(): LiveControls {
  const held = Object.fromEntries(BUTTONS.map((b) => [b, false])) as Record<Btn, boolean>;
  const taps = Object.fromEntries(BUTTONS.map((b) => [b, 0])) as Record<Btn, number>;
  const c: LiveControls = {
    held,
    pointerX: null,
    take(b) {
      if (taps[b] <= 0) return false;
      taps[b]--;
      return true;
    },
    press(b) {
      if (!held[b]) taps[b] = Math.min(taps[b] + 1, 3);
      held[b] = true;
    },
    release(b) {
      held[b] = false;
    },
    reset() {
      for (const b of BUTTONS) {
        held[b] = false;
        taps[b] = 0;
      }
      c.pointerX = null;
    },
  };
  return c;
}

/**
 * Listen to the keyboard while a game runs. Game keys are captured and their
 * default actions (scrolling, pressing buttons) suppressed. P toggles pause.
 */
export function bindKeyboard(c: LiveControls, onPause: () => void) {
  const down = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "p") {
      e.preventDefault();
      if (!e.repeat) onPause();
      return;
    }
    const b = KEYMAP[k];
    if (!b) return;
    // Enter and Space still press a focused button or link (Play again, Close, All games).
    if ((k === " " || k === "enter") && t && (t.tagName === "BUTTON" || t.tagName === "A")) return;
    e.preventDefault();
    e.stopPropagation();
    if (!e.repeat) c.press(b);
  };
  const up = (e: KeyboardEvent) => {
    const b = KEYMAP[e.key.toLowerCase()];
    if (b) c.release(b);
  };
  const blur = () => c.reset();
  window.addEventListener("keydown", down, { capture: true });
  window.addEventListener("keyup", up, { capture: true });
  window.addEventListener("blur", blur);
  return () => {
    window.removeEventListener("keydown", down, { capture: true });
    window.removeEventListener("keyup", up, { capture: true });
    window.removeEventListener("blur", blur);
  };
}
