"use client";

import { useEffect } from "react";
import { music } from "@/lib/music/engine";
import { DISTRICTS, SECTIONS } from "@/lib/sections";
import { input, useGame } from "@/store/game";

const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

function typing(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
}

/**
 * Global keyboard: movement, jumping, interaction, section and district
 * hotkeys, camera keys, the terminal key and the old code. Movement is
 * suspended while a sheet or field has focus; a running arcade game owns
 * the keyboard.
 */
export function useControls(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const held = new Set<string>();
    let konami = 0;

    const sync = () => {
      const panelOpen = useGame.getState().panel !== null;
      if (panelOpen) {
        input.x = input.z = 0;
        input.run = false;
        input.rot = input.zoom = 0;
        return;
      }
      const has = (...k: string[]) => k.some((x) => held.has(x));
      input.z = (has("w", "arrowup") ? 1 : 0) - (has("s", "arrowdown") ? 1 : 0);
      input.x = (has("d", "arrowright") ? 1 : 0) - (has("a", "arrowleft") ? 1 : 0);
      input.run = has("shift");
      input.rot = (has("]") ? 1 : 0) - (has("[") ? 1 : 0);
      input.zoom = (has("-") ? 1 : 0) - (has("=", "+") ? 1 : 0);
    };

    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const g = useGame.getState();

      // The old code works anywhere outside text fields (and outside the arcade).
      if (!typing(e.target) && g.panel !== "arcade") {
        const want = KONAMI[konami].toLowerCase();
        konami = k === want ? konami + 1 : k === "arrowup" ? (konami >= 2 ? 2 : 1) : 0;
        if (konami === KONAMI.length) {
          konami = 0;
          g.unlock("konami");
          g.open("secret");
          return;
        }
      }

      // M plays or pauses the jukebox anywhere outside text fields and games.
      if (k === "m" && !typing(e.target) && g.panel !== "arcade" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat) {
        const starting = !music.getState().playing;
        void music.toggle();
        if (starting) g.unlock("jukebox");
        return;
      }
      if (e.key === "Escape") {
        if (g.panel) {
          e.preventDefault();
          g.close();
        }
        return;
      }
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

      if ((e.key === "`" || e.key === "~") && g.panel !== "arcade") {
        e.preventDefault();
        g.open("terminal");
        return;
      }
      if (g.panel) return;

      const hot = SECTIONS.find((s) => s.hotkey === e.key);
      if (hot) {
        e.preventDefault();
        g.open(hot.id);
        return;
      }
      const district = DISTRICTS.find((d) => d.hotkey === e.key);
      if (district) {
        e.preventDefault();
        g.travel(district.id);
        return;
      }
      if (k === "c" && !e.repeat) {
        e.preventDefault();
        g.cycleCamMode();
        return;
      }
      if (e.key === " ") {
        // Space on a focused button presses that button.
        if ((e.target as HTMLElement)?.tagName === "BUTTON" || (e.target as HTMLElement)?.tagName === "A") return;
        e.preventDefault();
        if (!e.repeat) input.jump = true;
        return;
      }
      if ((k === "e" || k === "enter") && g.near) {
        // Enter on a focused button should press that button instead.
        if (k === "enter" && (e.target as HTMLElement)?.tagName === "BUTTON") return;
        e.preventDefault();
        g.interact(g.near);
        return;
      }
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift", "[", "]", "-", "=", "+"].includes(k)) {
        if (k.startsWith("arrow")) e.preventDefault();
        held.add(k);
        sync();
      }
    };
    const up = (e: KeyboardEvent) => {
      held.delete(e.key.toLowerCase());
      sync();
    };
    const blur = () => {
      held.clear();
      sync();
    };
    const unsub = useGame.subscribe((s, p) => {
      if (s.panel !== p.panel) {
        held.clear();
        sync();
      }
    });
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      unsub();
    };
  }, [enabled]);
}
