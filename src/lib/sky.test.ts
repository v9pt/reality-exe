import { describe, expect, it } from "vitest";
import { SYNODIC_DAYS, WEATHER, blendWeather, clockHours, daylight, formatClock, moonDir, moonPhase, nextPreset, skyLook, sunDir, type WeatherState } from "./sky";

const equinox = new Date(Date.UTC(2026, 2, 20, 12));
const june = new Date(Date.UTC(2026, 5, 21, 12));
const december = new Date(Date.UTC(2026, 11, 21, 12));

/** First time of day (to the minute) the sun's height crosses zero going up, or down. */
function crossing(date: Date, rising: boolean) {
  for (let m = 1; m < 24 * 60; m++) {
    const a = sunDir((m - 1) / 60, date)[1];
    const b = sunDir(m / 60, date)[1];
    if (rising ? a < 0 && b >= 0 : a >= 0 && b < 0) return m / 60;
  }
  return NaN;
}

describe("sun", () => {
  it("is up at noon and down at midnight, all year", () => {
    for (const d of [equinox, june, december]) {
      expect(sunDir(12, d)[1]).toBeGreaterThan(0.6);
      expect(sunDir(0, d)[1]).toBeLessThan(-0.3);
    }
  });

  it("rises in the east around six and sets in the west around six", () => {
    const rise = crossing(equinox, true);
    const set = crossing(equinox, false);
    expect(rise).toBeGreaterThan(5.5);
    expect(rise).toBeLessThan(6.5);
    expect(set).toBeGreaterThan(17.5);
    expect(set).toBeLessThan(18.5);
    expect(sunDir(rise, equinox)[0]).toBeGreaterThan(0.9); // east is +x
    expect(sunDir(set, equinox)[0]).toBeLessThan(-0.9);
  });

  it("days are longer in June than in December (New Delhi's latitude)", () => {
    const length = (d: Date) => crossing(d, false) - crossing(d, true);
    expect(length(june)).toBeGreaterThan(13.5);
    expect(length(december)).toBeLessThan(10.8);
  });

  it("stands to the south at noon in winter (north is −z)", () => {
    expect(sunDir(12, december)[2]).toBeGreaterThan(0.3);
  });

  it("daylight rises steadily through dawn", () => {
    let prev = -1;
    for (let h = 4; h <= 9; h += 0.25) {
      const d = daylight(sunDir(h, equinox)[1]);
      expect(d).toBeGreaterThanOrEqual(prev);
      prev = d;
    }
    expect(daylight(sunDir(3, equinox)[1])).toBe(0);
    expect(daylight(sunDir(10, equinox)[1])).toBe(1);
  });
});

describe("moon", () => {
  it("knows its phase from the date", () => {
    expect(moonPhase(new Date(Date.UTC(2000, 0, 6, 18, 14)))).toBeCloseTo(0, 5);
    const full = new Date(Date.UTC(2000, 0, 6, 18, 14) + (SYNODIC_DAYS / 2) * 86_400_000);
    expect(moonPhase(full)).toBeCloseTo(0.5, 5);
    // A full moon is high at midnight; a new moon is down then.
    expect(moonDir(0, 0.5)[1]).toBeGreaterThan(0.5);
    expect(moonDir(0, 0)[1]).toBeLessThan(0);
  });
});

describe("weather", () => {
  it("blends to the target and swaps rain for snow only once the rain has stopped", () => {
    const w: WeatherState = { ...WEATHER.rain };
    let sawSnowWhileRaining = false;
    for (let i = 0; i < 60 * 60; i++) {
      blendWeather(w, WEATHER.snow, 1 / 60);
      if (w.snowMode > 0.5 && w.precip > 0.3 && i < 60) sawSnowWhileRaining = true;
    }
    expect(sawSnowWhileRaining).toBe(false);
    expect(w.snowMode).toBeCloseTo(1, 2);
    expect(w.precip).toBeCloseTo(WEATHER.snow.precip, 2);
    expect(w.snow).toBeGreaterThan(0.95);
  });

  it("lights the city by the sun by day and the moon by night", () => {
    const noon = skyLook(sunDir(12, equinox), moonDir(12, 0.5), 0.5, WEATHER.clear);
    const midnight = skyLook(sunDir(0, equinox), moonDir(0, 0.5), 0.5, WEATHER.clear);
    expect(noon.day).toBe(1);
    expect(noon.keyI).toBeGreaterThan(1.5);
    expect(midnight.day).toBe(0);
    expect(midnight.keyDir[1]).toBeGreaterThan(0);
    expect(midnight.keyI).toBeLessThan(1);
    const storm = skyLook(sunDir(12, equinox), moonDir(12, 0.5), 0.5, WEATHER.storm);
    expect(storm.keyI).toBeLessThan(noon.keyI);
  });
});

describe("clock", () => {
  it("formats and picks presets", () => {
    expect(formatClock(18.7)).toBe("18:42");
    expect(formatClock(24.5)).toBe("00:30");
    expect(clockHours(new Date(2026, 0, 1, 9, 30))).toBeCloseTo(9.5);
    expect(nextPreset(5)).toBe("dawn");
    expect(nextPreset(13)).toBe("dusk");
    expect(nextPreset(23.5)).toBe("dawn");
  });
});
