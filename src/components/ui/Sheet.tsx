"use client";

import { motion } from "motion/react";
import { useEffect, useId, useRef } from "react";
import { useGame } from "@/store/game";

/**
 * The paper sheet every section opens in. Right-hand page on wide screens,
 * full screen on phones. Traps focus, closes on Esc (handled globally) and
 * returns focus to whatever opened it.
 */
export function Sheet({
  glyph,
  title,
  subtitle,
  children,
  wide = false,
  tone = "paper",
}: {
  glyph: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  wide?: boolean;
  tone?: "paper" | "dark";
}) {
  const close = useGame((s) => s.close);
  const reducedMotion = useGame((s) => s.reducedMotion);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>("[data-autofocus]") ?? el?.querySelector<HTMLElement>("h2");
    first?.focus({ preventScroll: true });
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !el) return;
      const items = [...el.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,textarea,select,[tabindex]:not([tabindex="-1"])')];
      if (items.length === 0) return;
      const a = items[0];
      const b = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        b.focus();
      } else if (!e.shiftKey && document.activeElement === b) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      before?.focus?.({ preventScroll: true });
    };
  }, []);

  const dark = tone === "dark";

  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={id}
      initial={reducedMotion ? { opacity: 0 } : { x: 60, opacity: 0, skewX: -3 }}
      animate={{ x: 0, opacity: 1, skewX: 0 }}
      exit={reducedMotion ? { opacity: 0 } : { x: 40, opacity: 0 }}
      transition={{ duration: 0.32, ease: [0.2, 0.9, 0.1, 1] }}
      className={[
        "fixed z-40 flex flex-col",
        "inset-0 md:inset-auto md:top-4 md:right-4 md:bottom-4",
        wide ? "md:w-[min(920px,calc(100vw-2rem))] lg:w-[min(980px,64vw)]" : "md:w-[min(620px,calc(100vw-2rem))] lg:w-[min(640px,48vw)]",
        dark ? "bg-[#0b0c18] text-hud" : "paper on-paper",
      ].join(" ")}
      style={dark ? { clipPath: "polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 22px 100%, 0 calc(100% - 22px))", border: "1px solid rgb(62 232 224 / 0.25)" } : undefined}
    >
      <header className="flex items-start gap-4 px-5 pt-5 pb-4 sm:px-8 sm:pt-7">
        <span className="slash kanji mt-1 shrink-0 px-2 py-1 text-[15px] text-night">{glyph}</span>
        <div className="min-w-0 flex-1">
          <h2 id={id} tabIndex={-1} className="display text-[clamp(2.4rem,6vw,3.6rem)] outline-none">
            {title}
          </h2>
          {subtitle ? <p className={`mt-2 text-[14px] ${dark ? "text-hud-dim" : "text-ink-2"}`}>{subtitle}</p> : null}
        </div>
        <button
          onClick={close}
          className={`group flex shrink-0 items-center gap-2 px-2 py-1 text-[13px] font-bold ${dark ? "text-hud hover:text-cyan" : "text-ink hover:text-crimson-ink"}`}
          aria-label="Close and return to the city"
        >
          <span>Close</span>
          <kbd className={`hidden border px-1.5 text-[11px] font-normal [@media(pointer:fine)]:inline ${dark ? "border-hud/30" : "border-ink/30"}`}>Esc</kbd>
        </button>
      </header>
      <div className={`${dark ? "border-t border-hud/15" : "rule-strong"} mx-5 sm:mx-8`} />
      <div className="scroll-ink min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-10 sm:px-8">{children}</div>
    </motion.div>
  );
}

/** Small section heading used inside sheets. */
export function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`display text-[1.5rem] text-ink ${className}`}>{children}</h3>;
}
