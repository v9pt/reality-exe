"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { TRACKS, music, serverMusicState } from "@/lib/music/engine";
import { useGame } from "@/store/game";

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden fill="currentColor">
    <path d={d} />
  </svg>
);
const PLAY = "M4 2.5v11l9.5-5.5z";
const PAUSE = "M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z";
const PREV = "M3 2.5h2v11H3zM13.5 2.5v11L6 8z";
const NEXT = "M11 2.5h2v11h-2zM2.5 2.5v11L10 8z";

export function useMusic() {
  return useSyncExternalStore(music.subscribe, music.getState, serverMusicState);
}

/** Five bars that move with the music (and sit still when it's paused or motion is reduced). */
function Bars({ playing }: { playing: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!playing || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const l = music.level();
      ref.current?.querySelectorAll("i").forEach((el, i) => {
        (el as HTMLElement).style.transform = `scaleY(${0.25 + Math.min(1, l * (0.6 + ((i * 37) % 5) / 6) + Math.random() * 0.15)})`;
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  return (
    <span ref={ref} aria-hidden className="flex h-3 items-end gap-[2px]">
      {[0, 1, 2, 3, 4].map((i) => (
        <i key={i} className="block h-full w-[2px] origin-bottom bg-cyan" style={{ transform: "scaleY(0.25)" }} />
      ))}
    </span>
  );
}

/**
 * The site-wide music player. Plays the jukebox's original tracks; music
 * keeps going across sheets, the arcade and the camera modes. Off until the
 * visitor presses play.
 */
export function JukeboxButton() {
  const s = useMusic();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const track = TRACKS[s.index];
  // Starting music from anywhere counts as finding the jukebox.
  useEffect(() => {
    if (s.playing) useGame.getState().unlock("jukebox");
  }, [s.playing]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !panel.current?.parentElement?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={s.playing ? `Jukebox: playing ${track.title}` : "Jukebox"}
        className="hud-frame flex items-center gap-2 px-3 py-1.5 text-[12px] text-hud hover:text-cyan"
      >
        <span className="kanji text-amber">音</span>
        {s.playing ? <Bars playing /> : null}
        <span className="hidden max-w-[9rem] truncate sm:inline">{s.playing ? track.title : "Jukebox"}</span>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            ref={panel}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            role="dialog"
            aria-label="Jukebox"
            className="fixed top-[calc(env(safe-area-inset-top)+4.75rem)] right-3 left-3 z-50 border sm:absolute sm:top-full sm:right-0 sm:left-auto sm:mt-2 sm:w-[300px] border-hud/20 bg-[#0b0c18]/95 p-4 text-hud backdrop-blur"
          >
            <p className="kanji text-[12px] text-amber">自動演奏機</p>
            <p className="display text-[1.8rem] leading-none">Jukebox</p>
            <p className="mt-1 text-[12px] text-hud-dim">Original tracks, played live by a synth in your browser. Nothing is downloaded.</p>

            <div className="mt-3 flex items-center gap-3">
              <button onClick={() => music.prev()} aria-label="Previous track" className="grid h-9 w-9 place-items-center border border-hud/25 hover:border-hud">
                <Icon d={PREV} />
              </button>
              <button
                onClick={() => music.toggle()}
                aria-label={s.playing ? "Pause" : "Play"}
                className="grid h-11 w-11 place-items-center bg-cyan text-[16px] font-bold text-night hover:bg-hud"
              >
                <Icon d={s.playing ? PAUSE : PLAY} />
              </button>
              <button onClick={() => music.next()} aria-label="Next track" className="grid h-9 w-9 place-items-center border border-hud/25 hover:border-hud">
                <Icon d={NEXT} />
              </button>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-bold">{track.title}</p>
                <p className="truncate text-[12px] text-hud-dim">{track.mood}</p>
              </div>
            </div>

            <label className="mt-3 flex items-center gap-2 text-[12px] text-hud-dim">
              Volume
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(s.volume * 100)}
                onChange={(e) => music.setVolume(Number(e.target.value) / 100)}
                className="flex-1 accent-cyan"
                aria-label="Music volume"
              />
            </label>

            <ol className="scroll-ink mt-3 max-h-[min(15rem,40vh)] overflow-y-auto border-t border-hud/10">
              {TRACKS.map((t, i) => (
                <li key={t.id}>
                  <button
                    onClick={() => (i === s.index && s.playing ? music.pause() : music.play(i))}
                    aria-current={i === s.index ? "true" : undefined}
                    className={`flex w-full items-center justify-between gap-2 border-b border-hud/10 py-1.5 text-left text-[13px] hover:text-cyan ${i === s.index ? "text-cyan" : "text-hud"}`}
                  >
                    <span>
                      {i + 1}. {t.title}
                    </span>
                    <span className="text-[11px] text-hud-dim">{i === s.index && s.playing ? "playing" : t.mood.split(",")[0]}</span>
                  </button>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-[11px] text-hud-dim">M plays or pauses. There’s also a jukebox on the plaza.</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
