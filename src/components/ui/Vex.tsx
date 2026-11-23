"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { TRACKS } from "@/lib/music/engine";
import { SECTIONS } from "@/lib/sections";
import { SECRET_LABELS, TOUR_KEY, useGame, type CameraMode } from "@/store/game";

type Step = {
  id: string;
  title: string;
  /** Text for keyboard-and-mouse visitors, and for touch screens. */
  body: string;
  touchBody?: string;
  /** data-tour targets to spotlight, first match wins. None: Vex speaks from the centre. */
  target?: string[];
  /** Needs the 3D city (skipped on the flat map). */
  world?: boolean;
  /** Camera mode to show during this step. */
  camera?: CameraMode;
};

const STEPS: Step[] = [
  {
    id: "hello",
    title: "Hi, I'm Vex",
    body: "I look after District V9. This whole city is Huzaifa Mulla's portfolio, and I'll show you round in under a minute. Skip any time.",
  },
  {
    id: "move",
    title: "Getting about",
    body: "Walk with W A S D or the arrow keys. Hold Shift to run and press Space to jump.",
    touchBody: "Walk with the joystick; push it to the edge to run. Run locks it on, Jump jumps.",
    target: ["move"],
    world: true,
  },
  {
    id: "camera",
    title: "Your eyes",
    body: "Drag to look around; the camera follows behind you. C switches between Follow, Free and Overview.",
    touchBody: "Drag the city or use the Look pad. The camera button switches between Follow, Free and Overview.",
    target: ["camera"],
    world: true,
  },
  {
    id: "sections",
    title: "The portfolio",
    body: `Six landmarks on the plaza hold the portfolio: ${SECTIONS.map((s) => s.name).join(", ")}. Walk up and press E, press 1 to 6, or pick one here.`,
    touchBody: `Six landmarks on the plaza hold the portfolio: ${SECTIONS.map((s) => s.name).join(", ")}. Tap one in the city, or in this bar.`,
    target: ["sections", "nav"],
  },
  {
    id: "districts",
    title: "Beyond the plaza",
    body: "Avenues lead out to the Arcade, the Garden and the Overlook. Walk there, or press 7, 8 or 9 to travel.",
    touchBody: "Avenues lead out to the Arcade, the Garden and the Overlook. Scroll the bottom bar to travel.",
    target: ["travel", "nav"],
    world: true,
    camera: "overview",
  },
  {
    id: "map",
    title: "Staying oriented",
    body: "The minimap follows you. The arrow is you, and the cone shows where you're looking.",
    target: ["minimap"],
    world: true,
  },
  {
    id: "powers",
    title: "Your powers",
    body: "You get six: Grapple line (swing between rooftops), Elastic reach, Overdrive, Sky leap, Ground slam and Blink. Q switches, F uses. Hold F to keep swinging or to glide.",
    touchBody: "You get six: Grapple line (swing between rooftops), Elastic reach, Overdrive, Sky leap, Ground slam and Blink. Switch picks one, Power uses it; hold to swing or glide.",
    target: ["powers"],
    world: true,
  },
  {
    id: "kart",
    title: "The kart",
    body: "Press K and a go-kart rolls up wherever you are. Drive anywhere; Space drifts. South of the plaza (press 0) is a circuit that times every clean lap, and the best laps go on a board everyone sees.",
    touchBody: "Tap Kart and a go-kart rolls up wherever you are. Drive anywhere; Drift slides. South of the plaza is a circuit that times every clean lap, and the best laps go on a board everyone sees.",
    target: ["powers"],
    world: true,
  },
  {
    id: "arcade",
    title: "The arcade",
    body: "Five original games: a gap runner, a shooter, falling blocks, a snake and Bug Hunt. Every score goes on a global leaderboard under your callsign.",
    target: ["games"],
  },
  {
    id: "weather",
    title: "Weather and time",
    body: "Switch between clear skies, rain, a storm, fog and snow, and pick dawn, day, dusk or night. A full day passes every 24 minutes, or the sky can follow your own clock. T and Y are the shortcuts.",
    touchBody: "Switch between clear skies, rain, a storm, fog and snow, and pick dawn, day, dusk or night. A full day passes every 24 minutes, or the sky can follow your own clock.",
    target: ["weather"],
    world: true,
  },
  {
    id: "music",
    title: "Music",
    body: `${TRACKS.length} original tracks, played live by your browser. Start them here, at the plaza jukebox, or with M.`,
    touchBody: `${TRACKS.length} original tracks, played live by your browser. Start them here or at the plaza jukebox.`,
    target: ["jukebox"],
  },
  {
    id: "secrets",
    title: "Secrets",
    body: `There are ${Object.keys(SECRET_LABELS).length} secrets hidden in the city. This counter keeps track, and opens a list of hints.`,
    target: ["secrets"],
  },
  {
    id: "bye",
    title: "That's the tour",
    body: "Prefer typing? Press ` for the terminal and try help. To see me again, open Controls or type vex in the terminal. Enjoy the district.",
    touchBody: "To see me again, open Controls. Enjoy the district.",
    target: ["help"],
  },
];

const UNIT_W = 340;
const UNIT_H = 230;

type Rect = { x: number; y: number; w: number; h: number };

function findTarget(ids?: string[]): Rect | null {
  for (const id of ids ?? []) {
    const el = document.querySelector<HTMLElement>(`[data-tour="${id}"]`);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }
  return null;
}

/** Where Vex and the speech bubble sit: beside the target if there's room, else above or below it. */
function placeUnit(t: Rect | null, vw: number, vh: number, w: number) {
  const pad = 14;
  if (!t) return { left: (vw - w) / 2, top: Math.max(pad, vh * 0.3) };
  const clampY = (y: number) => Math.min(Math.max(pad, y), vh - UNIT_H - pad);
  const clampX = (x: number) => Math.min(Math.max(pad, x), vw - w - pad);
  if (t.x + t.w + 18 + w < vw - pad) return { left: t.x + t.w + 18, top: clampY(t.y + t.h / 2 - UNIT_H / 2) };
  if (t.x - 18 - w > pad) return { left: t.x - 18 - w, top: clampY(t.y + t.h / 2 - UNIT_H / 2) };
  const below = t.y + t.h + 16;
  const top = below + UNIT_H < vh - pad ? below : t.y - 16 - UNIT_H;
  return { left: clampX(t.x + t.w / 2 - w / 2), top: clampY(top) };
}

/** Vex: an original holo-drone with one eye. */
function VexBot({ talking, still }: { talking: boolean; still: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 64 64"
      width="64"
      height="64"
      aria-hidden
      animate={still ? undefined : { y: [0, -5, 0] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      className="shrink-0 drop-shadow-[0_0_10px_rgba(62,232,224,0.55)]"
    >
      {/* Thruster glow */}
      <motion.ellipse cx="32" cy="58" rx="9" ry="3" fill="#3ee8e0" opacity="0.35" animate={still ? undefined : { opacity: [0.2, 0.5, 0.2] }} transition={{ duration: 0.6, repeat: Infinity }} />
      {/* Antenna */}
      <line x1="32" y1="10" x2="32" y2="4" stroke="#e9e4d6" strokeWidth="1.5" />
      <motion.circle cx="32" cy="3.5" r="2.2" fill="#ff3b4f" animate={still ? undefined : { opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
      {/* Side fins */}
      <path d="M9 30 L3 24 L5 38 Z" fill="#ff3b4f" />
      <path d="M55 30 L61 24 L59 38 Z" fill="#ff3b4f" />
      {/* Hexagonal shell */}
      <path d="M32 10 L52 21 L52 43 L32 54 L12 43 L12 21 Z" fill="#14172c" stroke="#3ee8e0" strokeWidth="1.6" />
      <path d="M32 15 L47 24 L47 40 L32 49 L17 40 L17 24 Z" fill="#0b0c18" />
      {/* Eye: blinks now and then, flickers while talking */}
      <motion.ellipse
        cx="32"
        cy="32"
        rx="8"
        ry="6"
        fill="#3ee8e0"
        style={{ originX: "32px", originY: "32px" }}
        animate={still ? undefined : { scaleY: talking ? [1, 0.75, 1] : [1, 1, 0.1, 1] }}
        transition={talking ? { duration: 0.25, repeat: Infinity } : { duration: 3.2, repeat: Infinity, times: [0, 0.9, 0.95, 1] }}
      />
      <circle cx="34.5" cy="30" r="2" fill="#e9e4d6" />
      {/* Mouth slot */}
      <rect x="27" y="42" width="10" height="1.6" fill="#ff3b4f" opacity="0.8" />
    </motion.svg>
  );
}

/**
 * Vex's guided tour: a spotlight on each part of the interface, with Vex
 * flying alongside to explain it. Runs once on a first visit (after the
 * intro), never over an open sheet or a deep link, and can be replayed from
 * Controls or the terminal.
 */
export function Vex({ flat, touch }: { flat: boolean; touch: boolean }) {
  const tour = useGame((s) => s.tour);
  const [offer, setOffer] = useState(false);

  // First visit: once the intro settles, Vex asks whether you'd like the tour.
  // Never over a deep link or an open sheet.
  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(TOUR_KEY) === "1";
    } catch {
      /* no storage: ask */
    }
    if (seen || new URLSearchParams(window.location.search).has("go")) return;
    const t = setTimeout(() => {
      if (!useGame.getState().panel) setOffer(true);
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  const answer = (yes: boolean) => {
    setOffer(false);
    if (yes) useGame.getState().startTour();
    else useGame.getState().endTour();
  };

  return (
    <AnimatePresence>
      {tour ? <Tour key="vex" flat={flat} touch={touch} /> : offer ? <Offer key="offer" onAnswer={answer} /> : null}
    </AnimatePresence>
  );
}

/** "Want the tour?" Asked once, on a first visit. */
function Offer({ onAnswer }: { onAnswer: (yes: boolean) => void }) {
  const reducedMotion = useGame((s) => s.reducedMotion);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onAnswer(false);
      }
    };
    window.addEventListener("keydown", k, { capture: true });
    // Opening a sheet counts as "not now".
    const unsub = useGame.subscribe((s, p) => s.panel && !p.panel && onAnswer(false));
    return () => {
      window.removeEventListener("keydown", k, { capture: true });
      unsub();
    };
  }, [onAnswer]);
  return (
    <motion.div
      role="dialog"
      aria-modal="false"
      aria-labelledby="vex-offer-title"
      className="fixed inset-0 z-[70] grid place-items-center bg-night/45 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="flex w-full max-w-[400px] items-start gap-3 border border-cyan/40 bg-[#0b0c18]/95 p-5 text-hud shadow-[0_0_30px_rgba(62,232,224,0.15)]"
        initial={reducedMotion ? false : { y: 24, scale: 0.96 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 160, damping: 18 }}
      >
        <VexBot talking={false} still={reducedMotion} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-hud-dim">
            <span className="kanji text-cyan">案内</span> Vex
          </p>
          <h2 id="vex-offer-title" className="display mt-1 text-[1.8rem] leading-none">
            First time in District V9?
          </h2>
          <p className="mt-2 text-[14px] leading-snug text-hud/90">I can show you round: the portfolio, your powers, the kart and the arcade. It takes about a minute.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button autoFocus onClick={() => onAnswer(true)} className="bg-cyan px-4 py-2 text-[14px] font-bold text-night hover:bg-hud">
              Yes, show me round
            </button>
            <button onClick={() => onAnswer(false)} className="border border-hud/30 px-4 py-2 text-[14px] text-hud hover:border-hud">
              No thanks
            </button>
          </div>
          <p className="mt-3 text-[12px] text-hud-dim">You can take the tour later from Controls.</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Types text out a couple of characters at a time; instant with reduced motion. Keyed per step. */
function TypedText({ text, instant, onDone }: { text: string; instant: boolean; onDone: () => void }) {
  const [n, setN] = useState(instant ? text.length : 0);
  useEffect(() => {
    if (instant) {
      onDone();
      return;
    }
    let k = 0;
    const t = setInterval(() => {
      k += 2;
      setN(Math.min(k, text.length));
      if (k >= text.length) {
        clearInterval(t);
        onDone();
      }
    }, 16);
    return () => clearInterval(t);
  }, [text, instant, onDone]);
  return (
    <p aria-hidden className="mt-2 min-h-[4.5rem] text-[14px] leading-snug text-hud/90">
      {text.slice(0, n)}
      {n < text.length ? <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-cyan" /> : null}
    </p>
  );
}

function Tour({ flat, touch }: { flat: boolean; touch: boolean }) {
  const reducedMotion = useGame((s) => s.reducedMotion);
  const steps = STEPS.filter((s) => !(flat && s.world));
  const [i, setI] = useState(0);
  const [talking, setTalking] = useState(true);
  const [rect, setRect] = useState<Rect | null>(null);
  const [view, setView] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const prevCam = useRef<CameraMode | null>(null);
  const step = steps[Math.min(i, steps.length - 1)];
  const body = (touch && step.touchBody) || step.body;
  const doneTalking = useCallback(() => setTalking(false), []);

  const finish = useCallback(() => {
    if (prevCam.current) {
      useGame.getState().setCamMode(prevCam.current);
      prevCam.current = null;
    }
    useGame.getState().endTour();
  }, []);

  // Opening a sheet (a hotkey, a click in the city) ends the tour rather than hiding under it.
  useEffect(
    () =>
      useGame.subscribe((s, p) => {
        if (s.tour && s.panel && !p.panel) finish();
      }),
    [finish],
  );

  const go = useCallback(
    (d: number) => {
      const n = i + d;
      if (n >= steps.length) return finish();
      setTalking(true);
      setI(Math.max(0, n));
    },
    [i, steps.length, finish],
  );

  // Camera changes for steps that need them, restored when the step ends.
  useEffect(() => {
    const g = useGame.getState();
    if (step.camera) {
      prevCam.current ??= g.camMode;
      g.setCamMode(step.camera);
    } else if (prevCam.current) {
      g.setCamMode(prevCam.current);
      prevCam.current = null;
    }
  }, [step]);

  // Track the spotlight target (it can move: layouts change, the minimap mounts).
  useLayoutEffect(() => {
    let raf = 0;
    let last = "";
    const measure = () => {
      const r = findTarget(step.target);
      const key = r ? `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.w)},${Math.round(r.h)}` : "none";
      const vk = `${window.innerWidth}x${window.innerHeight}`;
      if (key + vk !== last) {
        last = key + vk;
        setRect(r);
        setView({ w: window.innerWidth, h: window.innerHeight });
      }
      raf = requestAnimationFrame(measure);
    };
    raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  // Keyboard: Enter or → next, ← back, Esc ends. Captured so the city doesn't also react.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const map: Record<string, () => void> = { Enter: () => go(1), ArrowRight: () => go(1), ArrowLeft: () => go(-1), Escape: finish };
      const fn = map[e.key];
      if (!fn) return;
      if (e.key === "Enter" && (e.target as HTMLElement)?.tagName === "BUTTON") return;
      e.preventDefault();
      e.stopPropagation();
      fn();
    };
    window.addEventListener("keydown", k, { capture: true });
    return () => window.removeEventListener("keydown", k, { capture: true });
  }, [go, finish]);

  const w = Math.min(UNIT_W, view.w - 24);
  const pos = placeUnit(rect, view.w, view.h, w);
  const spring = reducedMotion ? { duration: 0 } : { type: "spring" as const, stiffness: 120, damping: 18 };

  return (
    <motion.div className="pointer-events-none fixed inset-0 z-[70]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {rect ? (
        <motion.div
          aria-hidden
          className="absolute border-2 border-cyan"
          style={{ boxShadow: "0 0 0 200vmax rgba(7,8,20,0.55), 0 0 24px rgba(62,232,224,0.6)" }}
          initial={false}
          animate={{ left: rect.x - 6, top: rect.y - 6, width: rect.w + 12, height: rect.h + 12 }}
          transition={spring}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-night/45" />
      )}
      <motion.div
        role="dialog"
        aria-modal="false"
        aria-labelledby="vex-title"
        aria-describedby="vex-body"
        className="pointer-events-auto absolute flex items-start gap-2"
        style={{ width: w }}
        initial={{ left: pos.left, top: pos.top + 30, opacity: 0 }}
        animate={{ left: pos.left, top: pos.top, opacity: 1 }}
        transition={spring}
      >
        <VexBot talking={talking} still={reducedMotion} />
        <div className="min-w-0 flex-1 border border-cyan/40 bg-[#0b0c18]/95 p-4 text-hud shadow-[0_0_30px_rgba(62,232,224,0.15)]">
          <p className="flex items-center justify-between text-[11px] text-hud-dim">
            <span>
              <span className="kanji text-cyan">案内</span> Vex · {i + 1} of {steps.length}
            </span>
            <button onClick={finish} className="text-hud-dim underline hover:text-hud">
              Skip tour
            </button>
          </p>
          <h2 id="vex-title" className="display mt-1 text-[1.7rem] leading-none">
            {step.title}
          </h2>
          {/* Full text for assistive tech; the typed copy is visual only. */}
          <p id="vex-body" className="sr-only">
            {body}
          </p>
          <TypedText key={step.id} text={body} instant={reducedMotion} onDone={doneTalking} />
          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => go(-1)} disabled={i === 0} className="border border-hud/25 px-3 py-1.5 text-[13px] hover:border-hud disabled:opacity-30">
              Back
            </button>
            <button autoFocus onClick={() => go(1)} className="bg-cyan px-4 py-1.5 text-[13px] font-bold text-night hover:bg-hud">
              {i === steps.length - 1 ? "Explore" : "Next"}
            </button>
            <span className="ml-auto hidden gap-1 sm:flex" aria-hidden>
              {steps.map((s, k) => (
                <i key={s.id} className={`block h-1 w-2.5 ${k === i ? "bg-cyan" : k < i ? "bg-hud/50" : "bg-hud/15"}`} />
              ))}
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
