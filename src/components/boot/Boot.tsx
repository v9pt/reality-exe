"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { profile } from "@/config/portfolio";

type Line = { text: string; status?: "ok" | "warn" | "wait" };

/**
 * Boot sequence. The progress is real: the last steps wait for the 3D
 * world's code to download. Nothing here is padded to look busy; "Skip"
 * works from the first frame.
 */
export function Boot({
  worldReady,
  webgl,
  reducedMotion,
  onEnter,
}: {
  worldReady: Promise<unknown>;
  webgl: boolean;
  reducedMotion: boolean;
  onEnter: () => void;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [done, setDone] = useState(false);
  const enterRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, reducedMotion ? 0 : ms));
    const push = (l: Line) => !cancelled && setLines((p) => [...p, l]);
    const settle = (status: Line["status"]) =>
      !cancelled && setLines((p) => p.map((l, i) => (i === p.length - 1 ? { ...l, status } : l)));

    // Restart cleanly if the effect runs twice (React Strict Mode in development).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLines([]);
    setDone(false);
    (async () => {
      push({ text: "Initializing neural interface", status: "wait" });
      await wait(260);
      settle("ok");
      push({ text: webgl ? "Graphics link: WebGL available" : "Graphics link: WebGL unavailable, using flat map", status: webgl ? "ok" : "warn" });
      await wait(180);
      push({ text: `Loading player profile: ${profile.name}`, status: "wait" });
      await wait(240);
      settle("ok");
      push({ text: webgl ? "Streaming District V9 geometry" : "Drawing District V9 map", status: "wait" });
      try {
        await Promise.all([worldReady, wait(200)]);
        settle("ok");
      } catch {
        settle("warn");
      }
      push({ text: "Connecting to the digital world", status: "wait" });
      await wait(220);
      settle("ok");
      if (!cancelled) setDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [worldReady, webgl, reducedMotion]);

  useEffect(() => {
    if (done) enterRef.current?.focus();
  }, [done]);

  const total = 5;
  const progress = Math.min(1, lines.filter((l) => l.status === "ok" || l.status === "warn").length / total);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-night text-hud" role="dialog" aria-modal="true" aria-label="Boot sequence">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-10 sm:px-10">
        <p className="kanji text-sm text-crimson">現実実行</p>
        <h1 className="display mt-2 text-[clamp(3.5rem,13vw,8.5rem)] text-hud">
          REALITY<span className="text-crimson">.</span>EXE
        </h1>
        <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-hud-dim">
          The portfolio of {profile.name}, built as a city you can walk through. Projects, skills and experience live in its landmarks.
        </p>

        <ol className="mt-10 space-y-1.5 font-mono text-[13px] leading-6" aria-live="polite">
          {lines.map((l, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-12 shrink-0 text-right">
                {l.status === "ok" ? (
                  <span className="text-cyan">ok</span>
                ) : l.status === "warn" ? (
                  <span className="text-amber">warn</span>
                ) : (
                  <span className="text-hud-dim">··</span>
                )}
              </span>
              <span className={l.status === "wait" ? "text-hud" : "text-hud-dim"}>{l.text}</span>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex items-center gap-4" aria-hidden>
          <div className="flex flex-1 gap-[3px]">
            {Array.from({ length: 24 }, (_, i) => (
              <span
                key={i}
                className="h-2 flex-1 transition-colors duration-200"
                style={{ background: i / 24 < progress ? "var(--color-cyan)" : "rgb(233 228 214 / 0.1)" }}
              />
            ))}
          </div>
          <span className="w-10 font-mono text-[12px] text-hud-dim">{Math.round(progress * 100)}%</span>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <AnimatePresence>
            {done ? (
              <motion.button
                ref={enterRef}
                initial={reducedMotion ? false : { opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={onEnter}
                className="paper display px-8 py-4 text-3xl text-ink transition-transform duration-150 hover:-translate-y-0.5"
                style={{ ["--cut" as string]: "12px" }}
              >
                Enter world
              </motion.button>
            ) : null}
          </AnimatePresence>
          {!done ? (
            <button onClick={onEnter} className="text-[14px] text-hud-dim underline decoration-hud-dim/40 underline-offset-4 hover:text-hud">
              Skip intro
            </button>
          ) : (
            <span className="text-[13px] text-hud-dim">or press Enter</span>
          )}
        </div>
      </div>
      <p className="px-6 pb-6 text-[12px] text-hud-dim sm:px-10">No sound. Works with keyboard, mouse and touch.</p>
    </div>
  );
}
