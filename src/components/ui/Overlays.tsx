"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { useGame } from "@/store/game";

/** Achievement-style notices. Polite live region, so screen readers hear them too. */
export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const dismiss = useGame((s) => s.dismissToast);
  return (
    <div aria-live="polite" className="pointer-events-none fixed top-24 left-1/2 z-50 flex w-[min(380px,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 md:top-36 md:left-4 md:translate-x-0">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            initial={{ opacity: 0, y: -12, skewX: -6 }}
            animate={{ opacity: 1, y: 0, skewX: 0 }}
            exit={{ opacity: 0, y: -8 }}
            onClick={() => dismiss(t.id)}
            className="paper pointer-events-auto flex items-start gap-3 px-4 py-3 text-left text-ink"
            style={{ ["--cut" as string]: "10px" }}
          >
            <span className={`kanji mt-0.5 px-1.5 py-0.5 text-[13px] ${t.tone === "secret" ? "bg-crimson-ink text-paper" : "bg-ink text-paper"}`}>
              {t.tone === "secret" ? "秘" : "報"}
            </span>
            <span className="min-w-0">
              <span className="display block text-[1.35rem] leading-none">{t.title}</span>
              {t.body ? <span className="mt-1 block text-[13px] leading-snug text-ink-2">{t.body}</span> : null}
            </span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Reticle cursor for mouse users. Hidden on touch and for reduced motion users who prefer the system cursor. */
export function Cursor() {
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    document.documentElement.classList.add("cursor-reticle");
    let x = -100;
    let y = -100;
    let rx = x;
    let ry = y;
    let hot = false;
    let raf = 0;
    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      const t = e.target as HTMLElement | null;
      hot = !!t?.closest?.("a,button,input,textarea,select,label,[role=button]") || document.body.dataset.hover === "1";
    };
    const loop = () => {
      rx += (x - rx) * 0.3;
      ry += (y - ry) * 0.3;
      if (dot.current) dot.current.style.transform = `translate(${x}px, ${y}px)`;
      if (ring.current) {
        ring.current.style.transform = `translate(${rx}px, ${ry}px) rotate(45deg) scale(${hot ? 1.5 : 1})`;
        ring.current.style.borderColor = hot ? "var(--color-crimson)" : "rgb(233 228 214 / 0.7)";
      }
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("pointermove", move);
    raf = requestAnimationFrame(loop);
    return () => {
      document.documentElement.classList.remove("cursor-reticle");
      window.removeEventListener("pointermove", move);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div aria-hidden className="pointer-events-none fixed top-0 left-0 z-[70] hidden [@media(pointer:fine)]:block">
      <div ref={ring} className="absolute -top-[9px] -left-[9px] h-[18px] w-[18px] border transition-[border-color] duration-150" />
      <div ref={dot} className="absolute -top-[2px] -left-[2px] h-[4px] w-[4px] bg-cyan" />
    </div>
  );
}

/** The one orchestrated transition: a crimson slash wipes the boot screen into the city. */
export function Slash({ onDone }: { onDone: () => void }) {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[55] overflow-hidden"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ delay: 0.55, duration: 0.45 }}
      onAnimationComplete={onDone}
    >
      <motion.div
        className="absolute top-[-20%] h-[140%] w-[70%] bg-crimson"
        style={{ skewX: -18 }}
        initial={{ left: "-80%" }}
        animate={{ left: "120%" }}
        transition={{ duration: 0.7, ease: [0.7, 0, 0.2, 1] }}
      />
      <motion.div
        className="absolute top-[-20%] h-[140%] w-[40%] bg-paper"
        style={{ skewX: -18 }}
        initial={{ left: "-60%" }}
        animate={{ left: "130%" }}
        transition={{ duration: 0.7, delay: 0.06, ease: [0.7, 0, 0.2, 1] }}
      />
    </motion.div>
  );
}
