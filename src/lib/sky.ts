/**
 * Time of day and weather for District V9, as pure maths: where the sun and
 * moon are, how bright and what colour the sky, fog and light are, and what
 * each weather looks like. No three.js; the world reads these every frame.
 *
 * The sun follows real solar geometry for New Delhi's latitude, using the
 * visitor's date for the season, so sunrise and sunset drift through the
 * year. The moon shows its real phase for the date.
 */

export type Rgb = [number, number, number];
export type V3 = [number, number, number];

export type Weather = "clear" | "rain" | "storm" | "fog" | "snow";
export const WEATHERS: Weather[] = ["clear", "rain", "storm", "fog", "snow"];
export const WEATHER_LABEL: Record<Weather, string> = { clear: "Clear", rain: "Rain", storm: "Storm", fog: "Fog", snow: "Snow" };
export const WEATHER_GLYPH: Record<Weather, string> = { clear: "晴", rain: "雨", storm: "雷", fog: "霧", snow: "雪" };

export type TimeMode = "cycle" | "clock" | "paused";
/** Real seconds per game minute in the cycle: 1 s = 1 min, so a day takes 24 minutes. */
export const CYCLE_MINUTES_PER_SECOND = 1;
export const PRESET_TIMES = { dawn: 6.25, day: 12, dusk: 18.25, night: 23 } as const;
export type PresetTime = keyof typeof PRESET_TIMES;

const LATITUDE = (28.6 * Math.PI) / 180; // New Delhi
const TAU = Math.PI * 2;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/** Solar declination (radians) for a date: about +23.4° in June, −23.4° in December. */
export function declination(date: Date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = (date.getTime() - start) / 86_400_000;
  return ((-23.44 * Math.PI) / 180) * Math.cos((TAU / 365) * (day + 10));
}

/**
 * Direction to a body in the sky (unit vector, world space: east is +x, up is
 * +y, north is −z) at local solar time `hours`, for a declination.
 */
export function skyDir(hours: number, decl: number): V3 {
  const H = ((hours - 12) / 24) * TAU; // hour angle: 0 at local noon
  const sinAlt = Math.sin(LATITUDE) * Math.sin(decl) + Math.cos(LATITUDE) * Math.cos(decl) * Math.cos(H);
  const east = -Math.cos(decl) * Math.sin(H);
  const north = Math.cos(LATITUDE) * Math.sin(decl) - Math.sin(LATITUDE) * Math.cos(decl) * Math.cos(H);
  const l = Math.hypot(east, sinAlt, north) || 1;
  return [east / l, sinAlt / l, -north / l];
}

export const sunDir = (hours: number, date = new Date()) => skyDir(hours, declination(date));

/** Moon phase for a date: 0 new, 0.5 full, back to 1. From a known new moon and the synodic month. */
export const SYNODIC_DAYS = 29.530588;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
export function moonPhase(date: Date) {
  const days = (date.getTime() - KNOWN_NEW_MOON) / 86_400_000;
  return (((days / SYNODIC_DAYS) % 1) + 1) % 1;
}

/** The moon trails the sun by its phase: a full moon rises at sunset, a new moon travels with the sun. */
export const moonDir = (hours: number, phase: number) => skyDir(hours - phase * 24, 0);

/** 0 at night, 1 in full day; the change happens around sunrise and sunset. */
export const daylight = (sunY: number) => smoothstep(-0.12, 0.22, sunY);
/** Peaks when the sun is at the horizon: drives the dawn and dusk colours. */
export const twilight = (sunY: number) => Math.exp(-(((sunY - 0.02) / 0.13) ** 2));

/* ───────────────────────── Weather ───────────────────────── */

/** What a weather looks like. Every field blends smoothly when the weather changes. */
export type WeatherState = {
  /** Share of drops or flakes shown (0 none). */
  precip: number;
  /** 0 rain, 1 snow. */
  snowMode: number;
  /** Fall speed, metres per second. */
  speed: number;
  /** Multiplier on fog density. */
  fog: number;
  /** Wet ground (reflections, ripples). */
  wet: number;
  /** Cloud cover: dims and greys the day. */
  cloud: number;
  /** Lightning on (storms). */
  lightning: number;
  /** Snow lying on roofs and ground. */
  snow: number;
};

export const WEATHER: Record<Weather, WeatherState> = {
  clear: { precip: 0, snowMode: 0, speed: 24, fog: 0.7, wet: 0, cloud: 0.08, lightning: 0, snow: 0 },
  rain: { precip: 0.75, snowMode: 0, speed: 24, fog: 1, wet: 1, cloud: 0.65, lightning: 0, snow: 0 },
  storm: { precip: 1, snowMode: 0, speed: 32, fog: 1.2, wet: 1, cloud: 0.95, lightning: 1, snow: 0 },
  fog: { precip: 0, snowMode: 0, speed: 24, fog: 2.6, wet: 0.45, cloud: 0.6, lightning: 0, snow: 0 },
  snow: { precip: 0.85, snowMode: 1, speed: 3.2, fog: 1.35, wet: 0.15, cloud: 0.8, lightning: 0, snow: 1 },
};

/** Seconds for each field to get most of the way to its new value. Puddles dry and snow settles slowly. */
const BLEND_SECONDS: Record<keyof WeatherState, number> = { precip: 2.5, snowMode: 1.5, speed: 1.5, fog: 3, wet: 18, cloud: 4, lightning: 1, snow: 14 };

/** Ease `cur` toward `target` by one frame (in place). Falling rain swaps to snow only while little is falling. */
export function blendWeather(cur: WeatherState, target: WeatherState, dt: number) {
  for (const k of Object.keys(BLEND_SECONDS) as (keyof WeatherState)[]) {
    let goal = target[k];
    // Change rain into snow (or back) only once the old kind has mostly stopped.
    if (k === "precip" && Math.abs(cur.snowMode - target.snowMode) > 0.05) goal = 0;
    if (k === "snowMode" && cur.precip > 0.08 && Math.abs(cur.snowMode - target.snowMode) > 0.05) goal = cur.snowMode;
    const rate = 1 - Math.exp((-3 * dt) / BLEND_SECONDS[k]);
    cur[k] += (goal - cur[k]) * rate;
  }
  return cur;
}

/* ───────────────────────── Colour ───────────────────────── */

export type SkyLook = {
  top: Rgb;
  horizon: Rgb;
  fog: Rgb;
  /** Hemisphere light: sky colour, ground colour, intensity. */
  hemiSky: Rgb;
  hemiGround: Rgb;
  hemi: number;
  /** The directional key light: colour, intensity, direction (sun by day, moon by night). */
  key: Rgb;
  keyI: number;
  keyDir: V3;
  sunCol: Rgb;
  day: number;
  dusk: number;
};

const NIGHT_TOP: Rgb = [0.016, 0.02, 0.052];
const NIGHT_HOR: Rgb = [0.15, 0.06, 0.21];
const DAY_TOP: Rgb = [0.2, 0.42, 0.82];
const DAY_HOR: Rgb = [0.64, 0.78, 0.94];
const DUSK_TOP: Rgb = [0.16, 0.12, 0.34];
const DUSK_HOR: Rgb = [1.0, 0.45, 0.24];
const NIGHT_FOG: Rgb = [0.071, 0.059, 0.141]; // #120f24, the original night haze
const DAY_FOG: Rgb = [0.6, 0.67, 0.76];
const DUSK_FOG: Rgb = [0.5, 0.3, 0.33];

function grey(c: Rgb, amount: number, level: number): Rgb {
  const l = (c[0] * 0.3 + c[1] * 0.55 + c[2] * 0.15) * level;
  return mixRgb(c, [l, l, l * 1.04], amount);
}

/** The full look of the sky and its light for a moment, given the sun, moon and weather. */
export function skyLook(sun: V3, moon: V3, phase: number, w: WeatherState): SkyLook {
  const day = daylight(sun[1]);
  const dusk = twilight(sun[1]) * (1 - w.cloud * 0.7);
  const cloud = w.cloud;
  let top = mixRgb(mixRgb(NIGHT_TOP, DAY_TOP, day), DUSK_TOP, dusk * 0.6);
  let horizon = mixRgb(mixRgb(NIGHT_HOR, DAY_HOR, day), DUSK_HOR, dusk * 0.8);
  let fog = mixRgb(mixRgb(NIGHT_FOG, DAY_FOG, day), DUSK_FOG, dusk * 0.7);
  // Overcast: greyer and a little darker by day. Snow brightens the haze.
  top = grey(top, cloud * 0.75, 1 - cloud * 0.25 * day);
  horizon = grey(horizon, cloud * 0.7, 1 - cloud * 0.15 * day);
  fog = grey(fog, cloud * 0.6, 1 + w.snow * 0.25);
  // Thick fog pulls everything toward the fog colour.
  const thick = clamp01((w.fog - 1) / 1.6);
  top = mixRgb(top, fog, thick * 0.6);
  horizon = mixRgb(horizon, fog, thick * 0.8);

  const sunCol = mixRgb([1, 0.96, 0.88], [1, 0.55, 0.3], clamp01(dusk * 1.3));
  const moonUp = smoothstep(-0.05, 0.15, moon[1]);
  const moonLight = (0.25 + 0.75 * Math.sin(phase * Math.PI)) * moonUp;
  const sunUp = smoothstep(-0.04, 0.1, sun[1]);
  const useSun = sunUp > 0.02;
  const keyDir = useSun ? sun : moon[1] > 0 ? moon : ([-0.4, 0.8, 0.3] as V3);
  const key: Rgb = useSun ? sunCol : [0.62, 0.72, 1];
  const keyI = useSun ? 1.9 * sunUp * (1 - cloud * 0.6) : 0.25 + 0.45 * moonLight;

  return {
    top,
    horizon,
    fog,
    hemiSky: mixRgb([0.42, 0.36, 1], [0.72, 0.8, 1], day),
    hemiGround: mixRgb([0.1, 0.05, 0.12], [0.36, 0.34, 0.31], day),
    hemi: mix(0.55, 1.15, day) * (1 - cloud * 0.25 * day),
    key,
    keyI,
    keyDir,
    sunCol,
    day,
    dusk,
  };
}

/** "18:42" */
export function formatClock(hours: number) {
  const total = ((Math.floor(hours * 60 + 1e-6) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Local time of a date in hours, for "Match my clock". */
export const clockHours = (d: Date) => d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;

/** The next preset after `hours` (for the Y hotkey). */
export function nextPreset(hours: number): PresetTime {
  const order: PresetTime[] = ["dawn", "day", "dusk", "night"];
  const h = ((hours % 24) + 24) % 24;
  return order.find((p) => PRESET_TIMES[p] > h + 0.05) ?? "dawn";
}
