"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { PRESET_TIMES, WEATHERS, WEATHER_GLYPH, WEATHER_LABEL, daylight, formatClock, sunDir, type PresetTime, type TimeMode } from "@/lib/sky";
import { env, useGame } from "@/store/game";

const PRESETS: { id: PresetTime; label: string }[] = [
  { id: "dawn", label: "Dawn" },
  { id: "day", label: "Day" },
  { id: "dusk", label: "Dusk" },
  { id: "night", label: "Night" },
];
const MODES: { id: TimeMode; label: string; hint: string }[] = [
  { id: "cycle", label: "Day passes", hint: "A full day every 24 minutes." },
  { id: "clock", label: "My clock", hint: "The sky follows the time where you are." },
  { id: "paused", label: "Paused", hint: "The sun and moon stay put." },
];

/** The city's time, refreshed a few times a second for the menu and the button. */
function useClock(ms = 500) {
  const [hours, setHours] = useState(env.hours);
  useEffect(() => {
    const id = setInterval(() => setHours(env.hours), ms);
    return () => clearInterval(id);
  }, [ms]);
  return hours;
}

/** Quick weather and time-of-day options: a HUD button that opens a small panel. */
export function WeatherButton() {
  const weather = useGame((s) => s.weather);
  const timeMode = useGame((s) => s.timeMode);
  const setWeather = useGame((s) => s.setWeather);
  const setTimeMode = useGame((s) => s.setTimeMode);
  const jumpTo = useGame((s) => s.jumpTo);
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const hours = useClock();
  const isDay = daylight(sunDir(hours)[1]) > 0.5;

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
        aria-label={`Weather and time: ${WEATHER_LABEL[weather]}, ${formatClock(hours)}`}
        className="hud-frame flex items-center gap-2 px-3 py-1.5 text-[12px] text-hud hover:text-cyan"
        title="Weather and time (T, Y)"
      >
        <span className="kanji text-cyan">{WEATHER_GLYPH[weather]}</span>
        <span className="tabular-nums">{formatClock(hours)}</span>
        <span aria-hidden className={isDay ? "text-amber" : "text-hud-dim"}>
          {isDay ? "☀" : "☾"}
        </span>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            ref={panel}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            role="dialog"
            aria-label="Weather and time"
            className="fixed top-[calc(env(safe-area-inset-top)+4.75rem)] right-3 left-3 z-50 border border-hud/20 bg-[#0b0c18]/95 p-4 text-hud backdrop-blur sm:absolute sm:top-full sm:right-0 sm:left-auto sm:mt-2 sm:w-[320px]"
          >
            <p className="kanji text-[12px] text-cyan">天気と時間</p>
            <p className="display text-[1.8rem] leading-none">Weather and time</p>

            <p className="mt-3 text-[12px] text-hud-dim">Weather</p>
            <div className="mt-1 grid grid-cols-5 gap-1" role="radiogroup" aria-label="Weather">
              {WEATHERS.map((w) => (
                <button
                  key={w}
                  role="radio"
                  aria-checked={weather === w}
                  onClick={() => setWeather(w)}
                  className={`flex flex-col items-center gap-0.5 border py-1.5 text-[11px] ${weather === w ? "border-cyan bg-cyan/15 text-cyan" : "border-hud/20 text-hud hover:border-hud/60"}`}
                >
                  <span className="kanji text-[15px]">{WEATHER_GLYPH[w]}</span>
                  {WEATHER_LABEL[w]}
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-baseline justify-between">
              <p className="text-[12px] text-hud-dim">Time of day</p>
              <p className="display text-[1.4rem] leading-none tabular-nums">
                {formatClock(hours)} <span className={isDay ? "text-amber" : "text-hud-dim"}>{isDay ? "☀" : "☾"}</span>
              </p>
            </div>
            <div className="mt-1 grid grid-cols-4 gap-1">
              {PRESETS.map((p) => {
                const near = Math.abs(hours - PRESET_TIMES[p.id]) < 0.5;
                return (
                  <button key={p.id} onClick={() => jumpTo(p.id)} className={`border py-1.5 text-[12px] ${near ? "border-amber text-amber" : "border-hud/20 text-hud hover:border-hud/60"}`}>
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1" role="radiogroup" aria-label="How time passes">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  role="radio"
                  aria-checked={timeMode === m.id}
                  onClick={() => setTimeMode(m.id)}
                  title={m.hint}
                  className={`py-1 text-[12px] ${timeMode === m.id ? "bg-hud text-night" : "border border-hud/20 text-hud-dim hover:text-hud"}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-hud-dim">{MODES.find((m) => m.id === timeMode)?.hint} The sun and moon follow New Delhi&rsquo;s sky for today&rsquo;s date, moon phase included.</p>
            <p className="mt-2 text-[11px] text-hud-dim">
              <kbd className="border border-hud/25 px-1">T</kbd> next weather · <kbd className="border border-hud/25 px-1">Y</kbd> next time of day
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
