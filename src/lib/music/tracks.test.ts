import { describe, expect, it } from "vitest";
import { noteFor, parseLead } from "./engine";
import { TRACKS } from "./tracks";

describe("jukebox tracks", () => {
  it.each(TRACKS.map((t) => [t.title, t] as const))("%s: every pattern is one bar and every note resolves", (_, t) => {
    for (const p of [t.kick, t.snare, t.hat, t.bass, t.arp, t.bell]) if (p) expect(p).toHaveLength(16);
    for (const p of t.lead ?? []) {
      expect(p).toHaveLength(16);
      for (const e of parseLead(p)) for (const c of t.chords) expect(noteFor(c, e.ch, t.root)).not.toBeNull();
    }
    expect(t.bpm).toBeGreaterThan(40);
    expect(t.chords.length).toBeGreaterThan(0);
  });

  it("has at least ten songs", () => {
    expect(TRACKS.length).toBeGreaterThanOrEqual(10);
  });

  it("ids are unique", () => {
    expect(new Set(TRACKS.map((t) => t.id)).size).toBe(TRACKS.length);
  });

  it("maps chord tones and octaves", () => {
    const am = [0, 3, 7];
    expect(noteFor(am, "0", 57)).toBe(57);
    expect(noteFor(am, "2", 57)).toBe(64);
    expect(noteFor(am, "-", 57)).toBe(45);
    expect(noteFor(am, "3", 57)).toBe(69); // wraps to the root an octave up
    expect(noteFor(am, ".", 57)).toBeNull();
  });

  it("reads +N as an octave-up note on that step", () => {
    expect(parseLead("0...+2..........")).toEqual([
      { step: 0, ch: "0", up: false },
      { step: 4, ch: "2", up: true },
    ]);
  });
});
