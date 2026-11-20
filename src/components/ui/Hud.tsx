"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { profile } from "@/config/portfolio";
import { gameById, type GameId } from "@/lib/arcade";
import { BACKROOM_AT, DISTRICTS, HUE_HEX, SECTIONS, districtById, sectionById, type DistrictId } from "@/lib/sections";
import { TRACK } from "@/lib/circuit";
import { MAP_HALF, fillZones } from "@/lib/world-map";
import { NAV_KEY, SECRET_LABELS, avatar, input, useGame, view, type CameraMode, type NearId } from "@/store/game";
import { orbitBy } from "@/lib/camera";
import { EnergyLine, KartHud, PowerBar, PowerButtons } from "./HeroHud";
import { JukeboxButton, useMusic } from "./Jukebox";

const CAM_LABEL: Record<CameraMode, string> = { follow: "Follow", free: "Free", overview: "Overview" };

/* ─────────────── Player plate (top left) ─────────────── */

function Plate({ compact }: { compact: boolean }) {
  return (
    <div className={`pointer-events-auto hud-frame shrink-0 ${compact ? "px-3 py-2" : "px-4 py-3"}`}>
      {!compact ? (
        <p className="text-[11px] text-hud-dim">
          <span className="kanji text-crimson">第九区</span> District V9
        </p>
      ) : null}
      <p className={`display text-hud ${compact ? "text-[1.35rem] leading-none" : "mt-1 text-[1.9rem]"}`}>{profile.name}</p>
      <p className={`text-hud-dim ${compact ? "mt-0.5 text-[11px]" : "text-[13px]"}`}>
        {profile.title}, {profile.education.short}
      </p>
    </div>
  );
}

/* ─────────────── Map nav: the conventional navigation ─────────────── */

function MapNav({ compact, flat }: { compact: boolean; flat: boolean }) {
  const open = useGame((s) => s.open);
  const go = useGame((s) => s.travel);
  // Without the 3D city there is nowhere to walk to: show the games, or say what's there.
  const travel = (id: DistrictId) => {
    const d = districtById(id)!;
    if (!flat) go(id);
    else if (id === "arcade") useGame.getState().openGame(null);
    else useGame.getState().toast({ tone: "info", title: d.name, body: d.blurb });
  };
  const openGame = useGame((s) => s.openGame);
  const visited = useGame((s) => s.visited);
  const near = useGame((s) => s.near);
  const navOpen = useGame((s) => s.navOpen);
  const toggle = useGame((s) => s.toggleNav);
  const tour = useGame((s) => s.tour);
  const rm = useGame((s) => s.reducedMotion);
  // Vex's tour points at the menu, so it stays open while the tour runs.
  const shown = navOpen || tour;

  if (compact) {
    return (
      <div className="pointer-events-auto">
        <div className="flex justify-end px-3">
          <button
            type="button"
            onClick={() => toggle()}
            aria-expanded={shown}
            aria-controls="quick-menu"
            className={`flex items-center gap-1.5 border border-b-0 border-hud/15 bg-night/90 px-3 py-1 text-[11px] text-hud ${shown ? "" : "mb-[env(safe-area-inset-bottom)] border-b"}`}
          >
            <span className="kanji text-cyan">案内</span> {shown ? "Hide menu" : "Menu"}
            <Chevron up={!shown} />
          </button>
        </div>
        {shown ? (
          <nav
            id="quick-menu"
            data-tour="nav"
            aria-label="Sections and districts"
            className="flex snap-x overflow-x-auto overscroll-contain border-t border-hud/15 bg-night/90 pb-[env(safe-area-inset-bottom)] [scrollbar-width:none]"
          >
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => open(s.id)}
                className="flex min-w-[64px] flex-1 snap-start flex-col items-center gap-0.5 py-2.5 active:bg-hud/10"
              >
                <span className="kanji text-[13px]" style={{ color: HUE_HEX[s.hue] }}>
                  {s.glyph}
                </span>
                <span className="text-[11px] text-hud">{s.name.split(" ")[0]}</span>
              </button>
            ))}
            <button
              data-tour="games"
              onClick={() => openGame(null)}
              className="flex min-w-[64px] flex-1 snap-start flex-col items-center gap-0.5 border-l border-hud/15 py-2.5 active:bg-hud/10"
            >
              <span className="kanji text-[13px] text-violet">遊技</span>
              <span className="text-[11px] text-hud">Games</span>
            </button>
            {DISTRICTS.map((d) => (
              <button
                key={d.id}
                onClick={() => travel(d.id)}
                className="flex min-w-[64px] flex-1 snap-start flex-col items-center gap-0.5 py-2.5 active:bg-hud/10"
                aria-label={`Travel to ${d.name}`}
              >
                <span className="kanji text-[13px]" style={{ color: HUE_HEX[d.hue] }}>
                  {d.glyph.slice(0, 2)}
                </span>
                <span className="text-[11px] text-hud">{d.name}</span>
              </button>
            ))}
          </nav>
        ) : null}
      </div>
    );
  }

  if (!shown) {
    return (
      <nav data-tour="nav" aria-label="Sections and districts" className="pointer-events-auto">
        <button
          type="button"
          onClick={() => toggle()}
          aria-expanded={false}
          aria-controls="quick-menu"
          className="hud-frame flex items-center gap-2 px-3 py-1.5 text-[12px] text-hud hover:text-cyan"
          title="Show the menu (N)"
        >
          <span className="kanji text-cyan">案内</span> Menu
          <kbd className="border border-hud/25 px-1.5 text-[11px] text-hud-dim">N</kbd>
          <Chevron up />
        </button>
      </nav>
    );
  }

  return (
    <motion.nav
      id="quick-menu"
      data-tour="nav"
      aria-label="Sections and districts"
      className="pointer-events-auto hud-frame w-[236px] overflow-hidden py-1.5"
      initial={rm ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className="flex items-center justify-between pr-2">
        <p className="px-4 pt-1 pb-1 text-[12px] text-hud-dim">Locations</p>
        <button
          type="button"
          onClick={() => toggle()}
          aria-expanded
          aria-controls="quick-menu"
          disabled={tour}
          className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-hud-dim hover:text-cyan disabled:opacity-40"
          title="Hide the menu (N)"
        >
          Hide <kbd className="border border-hud/25 px-1 text-[10px]">N</kbd>
          <Chevron up={false} />
        </button>
      </div>
      <ul data-tour="sections">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => open(s.id)}
              className="group flex w-full items-center gap-3 px-4 py-1.5 text-left hover:bg-hud/[0.06] focus-visible:bg-hud/[0.06]"
            >
              <span className="kanji w-9 text-[12px]" style={{ color: HUE_HEX[s.hue] }}>
                {s.glyph}
              </span>
              <span className="flex flex-1 items-baseline gap-2">
                <span className="display text-[1.3rem] leading-none text-hud group-hover:text-white">{s.name}</span>
                {near === s.id ? (
                  <span className="text-[11px] text-cyan">here</span>
                ) : visited.includes(s.id) ? (
                  <span className="text-[11px] text-hud-dim" aria-label="visited">
                    ✓
                  </span>
                ) : null}
              </span>
              <kbd className="border border-hud/25 px-1.5 text-[11px] text-hud-dim">{s.hotkey}</kbd>
            </button>
          </li>
        ))}
      </ul>
      <div data-tour="travel">
        <p className="mt-1 border-t border-hud/10 px-4 pt-2 pb-1 text-[12px] text-hud-dim">Travel</p>
        <ul>
          {DISTRICTS.map((d) => (
            <li key={d.id} className="flex items-center">
              <button
                onClick={() => travel(d.id)}
                className="group flex flex-1 items-center gap-3 px-4 py-1.5 text-left hover:bg-hud/[0.06] focus-visible:bg-hud/[0.06]"
                title={d.blurb}
              >
                <span className="kanji w-9 text-[11px]" style={{ color: HUE_HEX[d.hue] }}>
                  {d.glyph}
                </span>
                <span className="display flex-1 text-[1.3rem] leading-none text-hud group-hover:text-white">{d.name}</span>
                <kbd className="border border-hud/25 px-1.5 text-[11px] text-hud-dim">{d.hotkey}</kbd>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <button
        data-tour="games"
        onClick={() => openGame(null)}
        className="mx-4 mt-2 mb-1.5 w-[calc(100%-2rem)] border border-violet/50 py-1.5 text-[13px] text-violet hover:bg-violet/10"
      >
        Open the game list
      </button>
    </motion.nav>
  );
}

function Chevron({ up }: { up: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className={up ? "rotate-180" : ""}>
      <path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/* ─────────────── Interaction prompt ─────────────── */

function nearName(near: NearId, playing: boolean) {
  if (near === "jukebox") return playing ? "Next song" : "Play the jukebox";
  if (near === "backroom") return "Open the arcade cabinet";
  if (near.startsWith("cab:")) return `Play ${gameById(near.slice(4) as GameId)?.title}`;
  const d = districtById(near);
  if (d) return d.name;
  return `Open ${sectionById(near)?.name}`;
}

function Prompt({ touch }: { touch: boolean }) {
  const near = useGame((s) => s.near);
  const panel = useGame((s) => s.panel);
  const interact = useGame((s) => s.interact);
  const { playing } = useMusic();
  return (
    <AnimatePresence>
      {near && !panel ? (
        <motion.button
          key={near}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          onClick={() => {
            if (touch) navigator.vibrate?.(12);
            interact(near);
          }}
          className="paper pointer-events-auto flex items-center gap-3 px-5 py-2.5 text-ink"
          style={{ ["--cut" as string]: "10px" }}
        >
          {!touch ? <kbd className="bg-ink px-2 py-0.5 text-[13px] font-bold text-paper">E</kbd> : null}
          <span className="display text-[1.5rem]">{nearName(near, playing)}</span>
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}

/* ─────────────── Minimap ─────────────── */

const MINI = 140;
/** World units from the centre of the minimap to its edge. */
const MINI_RANGE = 42;

/** The map, painted once at a fixed scale; the minimap shows a window of it. */
function paintMap(px: number) {
  const c = document.createElement("canvas");
  c.width = c.height = px;
  const g = c.getContext("2d")!;
  g.scale(px / (MAP_HALF * 2), px / (MAP_HALF * 2));
  g.translate(MAP_HALF, MAP_HALF);
  g.fillStyle = "rgba(233,228,214,0.13)";
  fillZones(g);
  // The kart circuit.
  g.strokeStyle = "rgba(255,59,79,0.55)";
  g.lineWidth = 3;
  g.beginPath();
  TRACK.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z)));
  g.closePath();
  g.stroke();
  for (const s of SECTIONS) {
    g.fillStyle = HUE_HEX[s.hue];
    g.beginPath();
    g.moveTo(s.at[0], s.at[1] - 1.6);
    g.lineTo(s.at[0] + 1.6, s.at[1]);
    g.lineTo(s.at[0], s.at[1] + 1.6);
    g.lineTo(s.at[0] - 1.6, s.at[1]);
    g.fill();
  }
  for (const d of DISTRICTS) {
    g.strokeStyle = HUE_HEX[d.hue];
    g.lineWidth = 0.6;
    g.beginPath();
    g.arc(d.at[0], d.at[1], 3, 0, Math.PI * 2);
    g.stroke();
  }
  return c;
}

function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const backroomOpen = useGame((s) => s.backroomOpen);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio, 2);
    c.width = c.height = MINI * dpr;
    g.scale(dpr, dpr);
    const mapPx = 1024;
    const map = paintMap(mapPx);
    const pxPerUnit = mapPx / (MAP_HALF * 2);
    const scale = MINI / 2 / MINI_RANGE;
    let raf = 0;
    let last = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 66) return; // ~15 fps is plenty for a map
      last = t;
      g.clearRect(0, 0, MINI, MINI);
      g.save();
      g.beginPath();
      g.arc(MINI / 2, MINI / 2, MINI / 2 - 1, 0, Math.PI * 2);
      g.fillStyle = "rgba(7,8,20,0.82)";
      g.fill();
      g.clip();
      // Window of the painted map centred on the avatar.
      const src = MINI_RANGE * 2 * pxPerUnit;
      g.drawImage(map, (avatar.x + MAP_HALF - MINI_RANGE) * pxPerUnit, (avatar.z + MAP_HALF - MINI_RANGE) * pxPerUnit, src, src, 0, 0, MINI, MINI);
      g.translate(MINI / 2, MINI / 2);
      if (useGame.getState().backroomOpen) {
        g.fillStyle = "#ff3b4f";
        g.fillRect((BACKROOM_AT[0] - avatar.x) * scale - 2, (BACKROOM_AT[1] - avatar.z) * scale - 2, 4, 4);
      }
      // View cone: where the camera is looking. The camera sits at yaw and looks
      // the opposite way, so the cone points along (-sin yaw, -cos yaw) on the map.
      g.save();
      g.rotate(-view.yaw);
      const cone = g.createRadialGradient(0, 0, 2, 0, 0, 34);
      cone.addColorStop(0, "rgba(62,232,224,0.45)");
      cone.addColorStop(1, "rgba(62,232,224,0)");
      g.fillStyle = cone;
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, 34, -Math.PI / 2 - 0.42, -Math.PI / 2 + 0.42);
      g.closePath();
      g.fill();
      g.restore();
      g.rotate(-avatar.heading + Math.PI);
      g.fillStyle = "#e9e4d6";
      g.beginPath();
      g.moveTo(0, -6);
      g.lineTo(4, 4);
      g.lineTo(0, 2);
      g.lineTo(-4, 4);
      g.fill();
      g.restore();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [backroomOpen]);
  return (
    <div data-tour="minimap" className="relative" aria-hidden>
      <canvas ref={ref} style={{ width: MINI, height: MINI }} className="rounded-full border border-hud/20" />
      <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[10px] text-hud-dim">N</span>
    </div>
  );
}

/* ─────────────── Touch controls ─────────────── */

function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState<[number, number]>([0, 0]);
  const active = useRef(-1);
  const R = 46;
  const update = (cx: number, cy: number) => {
    const r = base.current!.getBoundingClientRect();
    let dx = cx - (r.left + r.width / 2);
    let dy = cy - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    setKnob([dx, dy]);
    input.x = dx / R;
    input.z = -dy / R;
    input.run = d > R * 0.92;
  };
  const end = () => {
    active.current = -1;
    setKnob([0, 0]);
    input.x = input.z = 0;
    input.run = false;
  };
  return (
    <div
      ref={base}
      role="presentation"
      className="pointer-events-auto relative h-[124px] w-[124px] shrink-0 touch-none rounded-full border border-hud/25 bg-night/50"
      onPointerDown={(e) => {
        active.current = e.pointerId;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => e.pointerId === active.current && update(e.clientX, e.clientY)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <span
        className="absolute top-1/2 left-1/2 h-12 w-12 rounded-full border border-cyan/60 bg-cyan/15"
        style={{ transform: `translate(calc(-50% + ${knob[0]}px), calc(-50% + ${knob[1]}px))` }}
      />
    </div>
  );
}

/** Drag here to turn the camera; works at the same time as the joystick. */
function LookPad() {
  const active = useRef(-1);
  const last = useRef<[number, number]>([0, 0]);
  return (
    <div
      role="presentation"
      className="pointer-events-auto grid h-[96px] w-[96px] shrink-0 touch-none place-items-center rounded-full border border-dashed border-hud/25 bg-night/40 text-[11px] text-hud-dim"
      onPointerDown={(e) => {
        active.current = e.pointerId;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        last.current = [e.clientX, e.clientY];
      }}
      onPointerMove={(e) => {
        if (e.pointerId !== active.current) return;
        orbitBy((e.clientX - last.current[0]) * 1.6, (e.clientY - last.current[1]) * 1.2);
        last.current = [e.clientX, e.clientY];
      }}
      onPointerUp={() => (active.current = -1)}
      onPointerCancel={() => (active.current = -1)}
    >
      Look
    </div>
  );
}

function RoundButton({
  label,
  glyph,
  onDown,
  onUp,
  pressed,
  tone = "crimson",
}: {
  label: string;
  glyph: string;
  onDown: () => void;
  onUp?: () => void;
  pressed?: boolean;
  tone?: "crimson" | "cyan" | "violet";
}) {
  const border = { crimson: "border-crimson/60", cyan: "border-cyan/60", violet: "border-violet/60" }[tone];
  const text = { crimson: "text-crimson", cyan: "text-cyan", violet: "text-violet" }[tone];
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onPointerDown={(e) => {
        e.preventDefault();
        navigator.vibrate?.(8);
        onDown();
      }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onDown()}
      className={`pointer-events-auto grid h-[56px] w-[56px] touch-none select-none place-items-center rounded-full border ${border} ${pressed ? "bg-hud/15" : "bg-night/60"} text-[12px] font-bold text-paper`}
    >
      <span className={`kanji text-[11px] leading-none ${text}`}>{glyph}</span>
      <span className="leading-none">{label}</span>
    </button>
  );
}

function TouchControls({ compact }: { compact: boolean }) {
  const camMode = useGame((s) => s.camMode);
  const cycle = useGame((s) => s.cycleCamMode);
  const [run, setRun] = useState(false);
  const driving = useGame((s) => s.driving);
  useEffect(() => {
    input.runLock = run;
  }, [run]);
  useEffect(() => () => void (input.runLock = false), []);
  return (
    <div
      className={`flex items-end justify-between gap-3 ${compact ? "px-4 pb-3" : ""} pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]`}
    >
      <div data-tour="move" className="flex items-end gap-2">
        <Joystick />
      </div>
      <div className="flex flex-col items-end gap-2">
        <EnergyLine />
        <div className="flex items-end gap-2">
          <div data-tour="powers" className="flex flex-col gap-2">
            <PowerButtons />
          </div>
          <div className="flex flex-col gap-2">
            <span data-tour="camera">
              <RoundButton label={CAM_LABEL[camMode]} glyph="視" tone="cyan" onDown={cycle} />
            </span>
            <RoundButton label="Run" glyph="走" tone="violet" pressed={run} onDown={() => setRun((r) => !r)} />
          </div>
          <div className="flex flex-col items-center gap-2">
            {/* Phones look by dragging the city; tablets also get a pad. */}
            {!compact ? <LookPad /> : null}
            <RoundButton
              label={driving ? "Drift" : "Jump"}
              glyph="跳"
              onDown={() => {
                input.jump = true;
                input.jumpHeld = true;
              }}
              onUp={() => (input.jumpHeld = false)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Help overlay ─────────────── */

function Help({ onClose, touch }: { onClose: () => void; touch: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const rows: [string, string][] = touch
    ? [
        ["Joystick", "Walk; push to the edge to run"],
        ["Run button", "Keep running"],
        ["Look pad, or drag the city", "Turn the camera"],
        ["Pinch the city", "Zoom; two fingers pan in Free camera"],
        ["Camera button", "Follow, Free or Overview"],
        ["Jump button", "Jump (drift in the kart)"],
        ["Power button", "Use the selected power; hold to swing or glide"],
        ["Switch", "Pick the next power"],
        ["Kart", "Get in or out of the go-kart"],
        ["Tap a landmark or cabinet", "Open it"],
        ["Bottom bar", "Sections, games and fast travel; Menu hides or shows it"],
      ]
    : [
        ["W A S D or arrows", "Walk (hold Shift to run)"],
        ["Space", "Jump (drift in the kart)"],
        ["Q, Shift+Q", "Switch power"],
        ["F", "Use power (hold to swing or glide)"],
        ["K", "Get in or out of the kart (A steers left, D right)"],
        ["Drag", "Orbit the camera"],
        ["Scroll, or - and =", "Zoom"],
        ["[ and ]", "Turn the camera"],
        ["C", "Camera: Follow, Free, Overview"],
        ["Right-drag or Shift-drag", "Pan (Free camera); double-click recentres"],
        ["E", "Open what you're next to"],
        ["M", "Play or pause music"],
        ["1 to 6", "Open a section"],
        ["7, 8, 9, 0", "Travel to Arcade, Garden, Overlook, Circuit"],
        ["N", "Hide or show the menu"],
        ["`", "Open the terminal"],
        ["Esc", "Close a sheet"],
      ];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Controls"
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-night/70 p-4"
      onClick={onClose}
    >
      <div className="paper on-paper w-full max-w-md p-7" onClick={(e) => e.stopPropagation()}>
        <p className="kanji text-[12px] text-crimson-ink">操作</p>
        <h2 className="display mt-1 text-[2.6rem]">Controls</h2>
        <dl className="mt-4">
          {rows.map(([k, v]) => (
            <div key={k} className="rule flex justify-between gap-4 py-2 text-[14px]">
              <dt className="font-bold">{k}</dt>
              <dd className="text-right text-ink-2">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[13px] text-ink-2">
          Every section is also one click away in the locations list. Some things in the city respond if you poke them.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button ref={ref} onClick={onClose} className="bg-ink px-4 py-2 text-[14px] font-bold text-paper">
            Got it
          </button>
          <button
            onClick={() => {
              onClose();
              useGame.getState().startTour();
            }}
            className="border border-ink px-4 py-2 text-[14px] font-bold text-ink hover:bg-ink hover:text-paper"
          >
            Take the tour with Vex
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── HUD root ─────────────── */

export function Hud({ compact, touch, flat }: { compact: boolean; touch: boolean; flat: boolean }) {
  const panel = useGame((s) => s.panel);
  const secrets = useGame((s) => s.secrets);
  const open = useGame((s) => s.open);
  const camMode = useGame((s) => s.camMode);
  const cycle = useGame((s) => s.cycleCamMode);
  const tour = useGame((s) => s.tour);
  const [help, setHelp] = useState(false);
  const hidden = panel !== null && compact;

  // First-time hint, gone after the first move or after a few seconds.
  const [hint, setHint] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setHint(false), 9000);
    const k = () => setHint(false);
    window.addEventListener("keydown", k, { once: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", k);
    };
  }, []);

  // The saved menu state is read after mount so the server render always matches.
  useEffect(() => {
    try {
      if (localStorage.getItem(NAV_KEY) === "closed") useGame.setState({ navOpen: false });
    } catch {
      /* storage blocked: keep it open */
    }
  }, []);

  const total = Object.keys(SECRET_LABELS).length;

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-30 flex flex-col justify-between transition-opacity duration-200 ${hidden ? "opacity-0" : "opacity-100"}`}
      aria-hidden={hidden || undefined}
    >
      <div className="flex items-start justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))] sm:p-5">
        <Plate compact={compact} />
        <div className="flex flex-col items-end gap-3">
          <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
            {!flat && !touch ? (
              <button data-tour="camera" onClick={cycle} className="hud-frame px-3 py-1.5 text-[12px] text-hud hover:text-cyan" title="Change camera (C)">
                <span className="kanji text-cyan">視</span> {CAM_LABEL[camMode]}
              </button>
            ) : null}
            <span data-tour="jukebox">
              <JukeboxButton />
            </span>
            <button
              data-tour="secrets"
              onClick={() => open("secret")}
              className="hud-frame px-3 py-1.5 text-[12px] text-hud-dim hover:text-hud"
              title="Secrets you have found"
            >
              <span className="kanji text-crimson">秘</span> {secrets.length}/{total}
            </button>
            <button data-tour="help" onClick={() => setHelp(true)} className="hud-frame px-3 py-1.5 text-[12px] text-hud hover:text-cyan">
              Controls
            </button>
          </div>
          {!compact && !flat ? <Minimap /> : null}
        </div>
      </div>
      {!flat && !compact ? (
        <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 sm:top-5">
          <KartHud touch={touch} />
        </div>
      ) : null}

      <div className="flex-1" />
      <div className="flex flex-col items-center gap-3 px-3 pb-3">
        <AnimatePresence>
          {hint && !panel && !tour ? (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="hud-frame px-4 py-2 text-center text-[13px] text-hud">
              {flat
                ? "Pick a location on the map or from the list."
                : touch
                  ? "Walk with the joystick and drag the city to look. Power, Switch and Kart are on the right."
                  : "WASD to walk, Space to jump, drag to look. Q and F for powers, K for the kart, E to interact, 1 to 0 to jump anywhere."}
            </motion.p>
          ) : null}
        </AnimatePresence>
        {!flat && compact ? <KartHud touch={touch} /> : null}
        {!flat ? <Prompt touch={touch} /> : null}
      </div>

      <div className={compact ? "" : "flex items-end justify-between gap-3 p-3 sm:p-5"}>
        {compact ? (
          <>
            {!flat && touch ? <TouchControls compact /> : null}
            <MapNav compact flat={flat} />
          </>
        ) : (
          <>
            <MapNav compact={false} flat={flat} />
            {!flat && touch ? <TouchControls compact={false} /> : null}
            {!flat && !touch ? <PowerBar touch={false} /> : null}
          </>
        )}
      </div>
      {help ? (
        <div className="pointer-events-auto">
          <Help onClose={() => setHelp(false)} touch={touch} />
        </div>
      ) : null}
    </div>
  );
}
