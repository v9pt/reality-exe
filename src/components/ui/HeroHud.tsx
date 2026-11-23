"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { CHECKPOINTS, formatLap } from "@/lib/circuit";
import { callsign, fetchBoard, type BoardEntry, type PlayerStanding } from "@/lib/leaderboard";
import { ENERGY_MAX, POWERS, powerById } from "@/lib/powers";
import { HUE_HEX } from "@/lib/sections";
import { CIRCUIT_RECT } from "@/lib/world-map";
import { avatar, hero, input, useGame } from "@/store/game";

/** Read the frame loop's `hero` state on a light timer instead of every frame. */
function useHeroTick(ms = 100) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return { h: hero, now };
}

/** Powers: the selected one, all six to pick from, and the shared energy meter. */
export function PowerBar({ touch }: { touch: boolean }) {
  const power = useGame((s) => s.power);
  const setPower = useGame((s) => s.setPower);
  const driving = useGame((s) => s.driving);
  const { h, now } = useHeroTick();
  const def = powerById(power)!;
  const denied = now - h.deniedAt < 400;
  return (
    <div data-tour="powers" className="pointer-events-auto hud-frame w-[236px] px-3 py-2">
      <div className="flex items-center justify-between text-[11px] text-hud-dim">
        <span>
          <span className="kanji text-crimson">能力</span> Power
        </span>
        {!touch ? <span>Q switch · F use · K kart</span> : null}
      </div>
      <div className="mt-1.5 grid grid-cols-6 gap-1" role="radiogroup" aria-label="Choose a power">
        {POWERS.map((p) => {
          const on = p.id === power;
          return (
            <button
              key={p.id}
              role="radio"
              aria-checked={on}
              aria-label={p.name}
              title={`${p.name}: ${p.how}`}
              onClick={() => setPower(p.id)}
              className={`kanji grid h-8 place-items-center border text-[15px] transition-colors ${on ? "text-night" : "border-hud/20 text-hud hover:border-hud/60"}`}
              style={on ? { background: HUE_HEX[p.hue], borderColor: HUE_HEX[p.hue] } : undefined}
            >
              {p.glyph}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 truncate text-[13px] text-hud">
        {def.name}
        {power === "overdrive" && h.overdrive ? <span className="ml-1 text-amber">on</span> : null}
        {driving ? <span className="ml-1 text-hud-dim">· kart: {def.kart}</span> : null}
      </p>
      <div
        className="mt-1 h-1.5 w-full bg-hud/10"
        aria-label={`Energy ${Math.round(h.energy)} of ${ENERGY_MAX}`}
        role="meter"
        aria-valuenow={Math.round(h.energy)}
        aria-valuemin={0}
        aria-valuemax={ENERGY_MAX}
      >
        <div className={`h-full transition-[width] duration-100 ${denied ? "bg-crimson" : "bg-cyan"}`} style={{ width: `${(h.energy / ENERGY_MAX) * 100}%` }} />
      </div>
    </div>
  );
}

/** Touch buttons for powers and the kart, laid out beside the joystick. */
export function PowerButtons() {
  const power = useGame((s) => s.power);
  const cycle = useGame((s) => s.cyclePower);
  const driving = useGame((s) => s.driving);
  const def = powerById(power)!;
  const btn =
    "pointer-events-auto grid h-[56px] w-[56px] touch-none select-none place-items-center rounded-full border bg-night/60 text-[11px] font-bold text-paper";
  return (
    <>
      <button
        type="button"
        aria-label={`Use ${def.name}`}
        className={`${btn} border-amber/70`}
        style={{ borderColor: HUE_HEX[def.hue] }}
        onPointerDown={(e) => {
          e.preventDefault();
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          input.powerTaps++;
          input.powerHeld = true;
          navigator.vibrate?.(10);
        }}
        onPointerUp={() => (input.powerHeld = false)}
        onPointerCancel={() => (input.powerHeld = false)}
      >
        <span className="kanji text-[15px] leading-none" style={{ color: HUE_HEX[def.hue] }}>
          {def.glyph}
        </span>
        <span className="leading-none">Power</span>
      </button>
      <button type="button" aria-label="Switch power" className={`${btn} border-hud/40`} onPointerDown={(e) => (e.preventDefault(), cycle(1))}>
        <span className="text-[15px] leading-none">⟳</span>
        <span className="leading-none">Switch</span>
      </button>
      <button
        type="button"
        aria-label={driving ? "Get out of the kart" : "Get in the kart"}
        aria-pressed={driving}
        className={`${btn} border-crimson/60 ${driving ? "bg-crimson/25" : ""}`}
        onPointerDown={(e) => (e.preventDefault(), (input.kartToggle = true))}
      >
        <span className="kanji text-[13px] leading-none text-crimson">車</span>
        <span className="leading-none">{driving ? "Exit" : "Kart"}</span>
      </button>
    </>
  );
}

/** Speed and lap timing while driving; a nudge toward the kart near the circuit. */
export function KartHud({ touch }: { touch: boolean }) {
  const driving = useGame((s) => s.driving);
  const panel = useGame((s) => s.panel);
  const { h, now } = useHeroTick(50);
  const [globalBest, setGlobalBest] = useState<BoardEntry | null>(null);
  const [standing, setStanding] = useState<{ you: PlayerStanding | null; players: number } | null>(null);
  const [name, setName] = useState("");

  // Global best lap and your own standing, refreshed when you start driving
  // and once each posted lap has reached the server.
  useEffect(() => {
    if (!driving) return;
    let live = true;
    void fetchBoard("kart").then((r) => {
      if (!live || !r.ok) return;
      setGlobalBest(r.board[0] ?? null);
      setStanding({ you: r.you, players: r.players });
      setName(callsign());
    });
    return () => {
      live = false;
    };
  }, [driving, h.lap.postedAt]);

  const atCircuit = avatar.x > CIRCUIT_RECT.x0 - 6 && avatar.x < CIRCUIT_RECT.x1 + 6 && avatar.z > CIRCUIT_RECT.z0 - 8 && avatar.z < CIRCUIT_RECT.z1 + 6;
  const recent = now - h.lap.lastEventAt < 2500 ? h.lap.lastEvent : "";

  if (panel) return null;
  return (
    <AnimatePresence>
      {driving ? (
        <motion.div
          key="kart"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="hud-frame px-4 py-2 text-center text-hud"
          role="status"
          aria-live="off"
        >
          <div className="flex items-end justify-center gap-5">
            <div>
              <p className="display text-[2.2rem] leading-none tabular-nums">{Math.round(h.speed * 3.6)}</p>
              <p className="text-[10px] text-hud-dim">km/h</p>
            </div>
            {atCircuit || h.lap.running ? (
              <div className="text-left text-[12px] tabular-nums">
                <p className={`display text-[1.6rem] leading-none ${h.lap.running ? (h.lap.valid ? "text-cyan" : "text-crimson") : "text-hud-dim"}`}>
                  {h.lap.running ? formatLap(now - h.lap.startedAt) : "-:--.--"}
                </p>
                <p className="text-hud-dim">
                  Last {h.lap.lastMs ? formatLap(h.lap.lastMs) : "–"} · Best {h.lap.bestMs ? formatLap(h.lap.bestMs) : "–"}
                </p>
                <p className="text-amber">World {globalBest ? `${formatLap(globalBest.score)} ${globalBest.name}` : "–"}</p>
                <p className="text-hud-dim">
                  {name ? `${name}: ` : ""}
                  {standing?.you ? `#${standing.you.rank} of ${standing.players}` : "no lap logged yet"}
                </p>
              </div>
            ) : null}
          </div>
          {h.lap.running ? (
            <div className="mt-1 flex justify-center gap-1" aria-hidden>
              {CHECKPOINTS.map((_, i) => (
                <i key={i} className={`block h-1 w-6 ${i < h.lap.passed ? "bg-cyan" : "bg-hud/20"}`} />
              ))}
            </div>
          ) : null}
          <p className="mt-1 h-4 text-[12px] text-hud-dim">
            {recent ||
              (atCircuit
                ? "Cross the start line to time a lap"
                : touch
                  ? "Joystick to drive · Jump to drift"
                  : "W/S drive · A/D steer · Space drift · K exit · 0 for the circuit")}
          </p>
        </motion.div>
      ) : atCircuit && avatar.y < 1 ? (
        <motion.div
          key="nudge"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="hud-frame pointer-events-auto flex items-center gap-3 px-4 py-2 text-[13px] text-hud"
        >
          <span>{touch ? "Tap Kart to drive a timed lap" : "Press K for the kart and drive a timed lap"}</span>
          <button
            type="button"
            onClick={() => useGame.getState().openKartBoard()}
            className="border border-amber/60 px-2 py-0.5 text-[12px] text-amber hover:bg-amber/10"
          >
            Lap board
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** A slim energy meter for phones, above the touch buttons. */
export function EnergyLine() {
  const { h, now } = useHeroTick();
  const power = useGame((s) => s.power);
  const denied = now - h.deniedAt < 400;
  return (
    <div className="pointer-events-none w-[184px]" aria-hidden>
      <p className="mb-0.5 truncate text-right text-[11px] text-hud-dim">{powerById(power)!.name}</p>
      <div className="h-1 w-full bg-hud/15">
        <div className={`h-full ${denied ? "bg-crimson" : "bg-cyan"}`} style={{ width: `${(h.energy / ENERGY_MAX) * 100}%` }} />
      </div>
    </div>
  );
}
