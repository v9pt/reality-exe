"use client";

import { DISTRICTS, HUE_HEX, SECTIONS } from "@/lib/sections";
import { useGame } from "@/store/game";
import { labelEls } from "./labels";

/** Outside the canvas: the label elements themselves. */
export function WorldLabels() {
  const near = useGame((s) => s.near);
  const visited = useGame((s) => s.visited);
  const panel = useGame((s) => s.panel);
  const backroomOpen = useGame((s) => s.backroomOpen);
  const reg = (id: string) => (el: HTMLElement | null) => {
    if (el) labelEls.set(id, el);
    else labelEls.delete(id);
  };
  return (
    <div aria-hidden className={`pointer-events-none fixed inset-0 z-20 overflow-hidden transition-opacity ${panel ? "opacity-0" : ""}`}>
      {SECTIONS.map((s) => (
        <div key={s.id} ref={reg(s.id)} className="absolute top-0 left-0 select-none whitespace-nowrap text-center opacity-0 will-change-transform">
          <div className="kanji text-[13px] leading-none" style={{ color: HUE_HEX[s.hue] }}>
            {s.glyph}
          </div>
          <div className={`display mt-1 text-hud transition-[font-size] duration-150 ${near === s.id ? "text-[24px]" : "text-[19px]"}`} style={{ textShadow: "0 1px 8px #000" }}>
            {s.name}
            {visited.includes(s.id) ? <span className="ml-1 text-[13px] text-hud-dim">✓</span> : null}
          </div>
        </div>
      ))}
      {DISTRICTS.map((d) => (
        <div key={d.id} ref={reg(d.id)} className="absolute top-0 left-0 select-none whitespace-nowrap text-center opacity-0 will-change-transform">
          <div className="kanji text-[13px] leading-none" style={{ color: HUE_HEX[d.hue] }}>
            {d.glyph}
          </div>
          <div className={`display mt-1 text-hud ${near === d.id ? "text-[24px]" : "text-[20px]"}`} style={{ textShadow: "0 1px 8px #000" }}>
            {d.name}
          </div>
        </div>
      ))}
      {backroomOpen ? (
        <div ref={reg("backroom")} className="absolute top-0 left-0 select-none whitespace-nowrap text-center opacity-0">
          <div className="kanji text-[13px] text-crimson">裏路地</div>
          <div className="display text-[19px] text-hud" style={{ textShadow: "0 1px 8px #000" }}>
            Back alley
          </div>
        </div>
      ) : null}
    </div>
  );
}
