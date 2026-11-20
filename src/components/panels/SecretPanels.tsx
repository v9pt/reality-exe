"use client";

import { useEffect, useState } from "react";
import { JOKES } from "@/lib/jokes";
import { SECTIONS } from "@/lib/sections";
import { BugHunt } from "../arcade/BugHunt";
import { SECRET_LABELS, useGame, type SecretId } from "@/store/game";
import { Sheet } from "../ui/Sheet";

const HINTS: Record<SecretId, string> = {
  konami: "An old code, pressed not typed.",
  backroom: "Not every gap between buildings is a wall.",
  cat: "Someone small lives in the dark.",
  vending: "Thirsty? The street terminal has a neighbour.",
  sign: "One sign in the plaza can't hold its light.",
  sudo: "Ask the terminal for more power.",
  devmode: "The terminal can show you what the city is made of.",
  arcade: "Every cabinet on the east strip wants one go.",
  overlook: "Some views are only up the ramp.",
  jukebox: "The plaza has a machine that plays songs.",
  kart: "Press K. Mind the paintwork.",
  lap: "The circuit south of the plaza times you.",
  hero: "Six powers. Try them all.",
};

/**
 * The hidden file. Lists every secret (found or hinted). The old code
 * unlocks the second half: a character sheet for the visitor, built only
 * from what they did here.
 */
export function SecretPanel() {
  const s = useGame();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const unlocked = s.secrets.includes("konami");
  const minutes = Math.max(0, Math.floor((now - s.enteredAt) / 60000));
  const seconds = Math.max(0, Math.floor((now - s.enteredAt) / 1000) % 60);
  const all = Object.keys(SECRET_LABELS) as SecretId[];

  return (
    <Sheet glyph="秘密" title={unlocked ? "Player two" : "Hidden file"} subtitle={unlocked ? "A character sheet for you, built from what you did here. Nothing leaves your browser." : "Secrets in District V9. None of them hide anything you need."} tone="dark">
      {unlocked ? (
        <div className="mb-8">
          <div className="grid grid-cols-2 gap-px bg-hud/15 sm:grid-cols-3">
            {[
              ["Class", "Explorer"],
              ["Time in the district", `${minutes}m ${String(seconds).padStart(2, "0")}s`],
              ["Locations visited", `${s.visited.length} of ${SECTIONS.length}`],
              ["Commands run", String(s.commandsRun)],
              ["Secrets found", `${s.secrets.length} of ${all.length}`],
              ["Cat pets", String(s.catPets)],
            ].map(([k, v]) => (
              <div key={k} className="bg-[#0b0c18] p-3">
                <p className="text-[12px] text-hud-dim">{k}</p>
                <p className="display text-[1.9rem] text-hud">{v}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[14px] text-hud-dim">
            {s.visited.length === SECTIONS.length
              ? "You've been everywhere. That's thorough. Huzaifa would like to hear from someone this thorough."
              : `Still unexplored: ${SECTIONS.filter((x) => !s.visited.includes(x.id)).map((x) => x.name).join(", ")}.`}
          </p>
          <button onClick={s.toggleDevMode} aria-pressed={s.devMode} className="mt-4 border border-cyan/50 px-3 py-1.5 text-[13px] text-cyan hover:bg-cyan/10">
            {s.devMode ? "Turn developer view off" : "Turn on developer view (wireframe city)"}
          </button>
        </div>
      ) : (
        <div className="mb-8 border border-crimson/40 p-4">
          <p className="kanji text-[13px] text-crimson">封印</p>
          <p className="display mt-1 text-[1.8rem] text-hud">The second half is sealed</p>
          <p className="mt-1 text-[14px] text-hud-dim">An old code opens it. Arrow keys feature heavily. So do two letters.</p>
        </div>
      )}

      <h3 className="display text-[1.5rem] text-hud">Secrets</h3>
      <ul className="mt-2">
        {all.map((id) => {
          const found = s.secrets.includes(id);
          return (
            <li key={id} className="flex items-start gap-3 border-t border-hud/10 py-2.5">
              <span className={`kanji mt-0.5 px-1 text-[12px] ${found ? "bg-crimson text-night" : "border border-hud/25 text-hud-dim"}`}>{found ? "済" : "未"}</span>
              <span>
                <span className={`block text-[14px] ${found ? "text-hud" : "text-hud-dim"}`}>{found ? SECRET_LABELS[id] : "Undiscovered"}</span>
                {!found ? <span className="text-[13px] text-hud-dim/80">{HINTS[id]}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

/** The arcade in the back alley: one short game and the wall of jokes. */
export function BackroomPanel() {
  return (
    <Sheet glyph="裏路地" title="Back alley arcade" subtitle="Off the map. One cabinet, one cat, and some writing on the wall." tone="dark">
      <BugHunt />
      <p className="mt-3 text-[14px] text-hud-dim">
        The full arcade, four more cabinets, is at the end of the east avenue.{" "}
        <button onClick={() => useGame.getState().travel("arcade")} className="text-cyan underline">
          Go there
        </button>
      </p>
      <h3 className="display mt-8 text-[1.5rem] text-hud">Written on the wall</h3>
      <ul className="mt-2">
        {JOKES.slice(0, 5).map((j) => (
          <li key={j} className="border-t border-hud/10 py-2.5 text-[14px] text-hud-dim">
            {j}
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
