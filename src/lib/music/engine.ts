import { TRACKS, type Track } from "./tracks";

/**
 * A small WebAudio synth and step sequencer that plays the jukebox tracks
 * live. One instance for the whole site, so music carries on across sheets,
 * camera changes and the arcade. Never starts on its own: browsers only
 * allow sound after a visitor's gesture, and the brief rules out autoplay.
 */

export type MusicState = { playing: boolean; index: number; volume: number };

const KEY = "reality.exe/music";
const LOOKAHEAD = 0.14; // seconds scheduled ahead of the clock
const TICK_MS = 25;

const midiHz = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/** Note for a pattern character against a chord: "0"–"3" chord tones, "-" low root, "+" octave up next char. */
export function noteFor(chord: number[], ch: string, base: number) {
  if (ch === "-") return base + chord[0] - 12;
  const i = Number(ch);
  if (Number.isNaN(i)) return null;
  const tone = chord[i % chord.length] + Math.floor(i / chord.length) * 12;
  return base + tone;
}

/** Turn a lead pattern into [step, char, octaveUp] events ("+0" means chord tone 0, an octave up). */
export function parseLead(p: string): { step: number; ch: string; up: boolean }[] {
  const out: { step: number; ch: string; up: boolean }[] = [];
  for (let i = 0; i < p.length; i++) {
    if (p[i] === ".") continue;
    if (p[i] === "+" && i + 1 < p.length) {
      out.push({ step: i, ch: p[i + 1], up: true });
      i++;
      continue;
    }
    out.push({ step: i, ch: p[i], up: false });
  }
  return out;
}

function load(): Pick<MusicState, "index" | "volume"> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw);
      return { index: Math.max(0, Math.min(TRACKS.length - 1, v.index | 0)), volume: Math.max(0, Math.min(1, Number(v.volume ?? 0.6))) };
    }
  } catch {
    /* no storage */
  }
  return { index: 0, volume: 0.6 };
}

class Engine {
  state: MusicState = { playing: false, index: 0, volume: 0.6 };
  private listeners = new Set<() => void>();
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private bus!: BiquadFilterNode;
  private delay!: DelayNode;
  private analyser!: AnalyserNode;
  private noise!: AudioBuffer;
  private timer: number | undefined;
  private step = 0;
  private nextTime = 0;
  private arpIndex = 0;
  private levelBuf: Uint8Array<ArrayBuffer> | null = null;
  private loaded = false;

  get track(): Track {
    return TRACKS[this.state.index];
  }

  subscribe = (fn: () => void) => {
    this.ensureLoaded();
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };

  getState = () => {
    this.ensureLoaded();
    return this.state;
  };

  private ensureLoaded() {
    if (this.loaded || typeof window === "undefined") return;
    this.loaded = true;
    this.state = { ...this.state, ...load() };
  }

  private set(patch: Partial<MusicState>) {
    this.state = { ...this.state, ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify({ index: this.state.index, volume: this.state.volume }));
    } catch {
      /* no storage */
    }
    this.listeners.forEach((l) => l());
  }

  private setup() {
    if (this.ctx) return this.ctx;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    this.bus = ctx.createBiquadFilter();
    this.bus.type = "lowpass";
    this.bus.frequency.value = 6000;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.bus.connect(comp).connect(this.master).connect(this.analyser).connect(ctx.destination);
    // A soft echo for the lead and bells.
    this.delay = ctx.createDelay(1);
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const wet = ctx.createGain();
    wet.gain.value = 0.28;
    this.delay.connect(fb).connect(this.delay);
    this.delay.connect(wet).connect(this.bus);
    // White noise for drums.
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return ctx;
  }

  /** Overall loudness right now, 0–1, for visuals that pulse with the music. */
  level() {
    if (!this.ctx || !this.state.playing) return 0;
    this.levelBuf ??= new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(this.levelBuf);
    let sum = 0;
    for (const v of this.levelBuf) sum += ((v - 128) / 128) ** 2;
    return Math.min(1, Math.sqrt(sum / this.levelBuf.length) * 10);
  }

  async play(index = this.state.index) {
    this.ensureLoaded();
    const ctx = this.setup();
    if (ctx.state === "suspended") await ctx.resume();
    const switching = index !== this.state.index || !this.state.playing;
    if (switching) {
      this.step = 0;
      this.arpIndex = 0;
      this.nextTime = ctx.currentTime + 0.08;
    }
    this.applyTrack(TRACKS[index]);
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setTargetAtTime(this.state.volume * 0.55, ctx.currentTime, 0.08);
    this.set({ playing: true, index });
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.schedule(), TICK_MS);
  }

  pause() {
    if (this.ctx) {
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      const ctx = this.ctx;
      window.setTimeout(() => !this.state.playing && ctx.suspend(), 300);
    }
    window.clearInterval(this.timer);
    this.set({ playing: false });
  }

  toggle() {
    return this.state.playing ? this.pause() : this.play();
  }

  next() {
    return this.play((this.state.index + 1) % TRACKS.length);
  }

  prev() {
    return this.play((this.state.index - 1 + TRACKS.length) % TRACKS.length);
  }

  /** Change track without starting playback if paused. */
  select(index: number) {
    if (this.state.playing) return this.play(index);
    this.set({ index });
  }

  setVolume(v: number) {
    const volume = Math.max(0, Math.min(1, v));
    if (this.ctx && this.state.playing) this.master.gain.setTargetAtTime(volume * 0.55, this.ctx.currentTime, 0.05);
    this.set({ volume });
  }

  private applyTrack(t: Track) {
    if (!this.ctx) return;
    this.bus.frequency.setTargetAtTime(t.tone ?? 6000, this.ctx.currentTime, 0.2);
    this.delay.delayTime.value = (60 / t.bpm) * 0.75; // dotted eighth
  }

  /* ───────────── Sequencer ───────────── */

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.state.playing) return;
    const t = this.track;
    const sixteenth = 60 / t.bpm / 4;
    // After a stall (a long frame, a throttled tab), skip ahead instead of firing a burst of late notes.
    if (this.nextTime < ctx.currentTime - sixteenth) {
      const behind = Math.ceil((ctx.currentTime - this.nextTime) / sixteenth);
      this.step += behind;
      this.nextTime += behind * sixteenth;
    }
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      const s = this.step % 16;
      const bar = Math.floor(this.step / 16);
      const swing = s % 2 === 1 ? (t.swing ?? 0) * sixteenth : 0;
      this.playStep(t, s, bar, this.nextTime + swing, sixteenth);
      this.nextTime += sixteenth;
      this.step++;
    }
  }

  private playStep(t: Track, s: number, bar: number, at: number, sixteenth: number) {
    const chord = t.chords[bar % t.chords.length];
    const hit = (p?: string) => (p ? p[s] : ".");
    if (hit(t.kick) !== ".") this.kick(at);
    if (hit(t.snare) !== ".") this.snare(at);
    const h = hit(t.hat);
    if (h !== ".") this.hat(at, h === "o");
    const b = hit(t.bass);
    if (b !== ".") {
      const n = noteFor(chord, b, t.root - 12);
      if (n !== null) this.bass(at, n, sixteenth * 1.8, t.bassWave ?? "sawtooth");
    }
    if (t.arp && t.arp[s] === "a") {
      // Up then down through the chord, an octave above the root.
      const tones = [...chord, chord[0] + 12];
      const cycle = [...tones, ...tones.slice(1, -1).reverse()];
      const n = t.root + 12 + cycle[this.arpIndex++ % cycle.length];
      this.pluck(at, n, sixteenth * 0.9, "square", 0.035);
    }
    if (t.lead) {
      const pattern = t.lead[bar % t.lead.length];
      for (const e of parseLead(pattern)) {
        if (e.step !== s) continue;
        const n = noteFor(chord, e.ch, t.root + 12);
        if (n !== null) this.pluck(at, n + (e.up ? 12 : 0), sixteenth * 3, t.leadWave ?? "triangle", 0.06, true);
      }
    }
    if (t.bell && t.bell[s] === "x") {
      const n = t.root + 24 + chord[(bar + s) % chord.length];
      this.bellNote(at, n);
    }
    if (t.pad && s === 0) this.padChord(at, chord, t.root, sixteenth * 16);
  }

  /* ───────────── Instruments ───────────── */

  private env(at: number, peak: number, attack: number, decay: number) {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    return g;
  }

  private kick(at: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(140, at);
    o.frequency.exponentialRampToValueAtTime(42, at + 0.12);
    const g = this.env(at, 0.9, 0.002, 0.28);
    o.connect(g).connect(this.bus);
    o.start(at);
    o.stop(at + 0.32);
  }

  private noiseHit(at: number, freq: number, type: BiquadFilterType, peak: number, decay: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.env(at, peak, 0.001, decay);
    src.connect(f).connect(g).connect(this.bus);
    src.start(at, Math.random() * 0.5);
    src.stop(at + decay + 0.02);
  }

  private snare(at: number) {
    this.noiseHit(at, 1800, "bandpass", 0.5, 0.16);
    const o = this.ctx!.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(220, at);
    const g = this.env(at, 0.18, 0.001, 0.08);
    o.connect(g).connect(this.bus);
    o.start(at);
    o.stop(at + 0.1);
  }

  private hat(at: number, open: boolean) {
    this.noiseHit(at, 7500, "highpass", open ? 0.16 : 0.1, open ? 0.18 : 0.04);
  }

  private bass(at: number, note: number, dur: number, wave: OscillatorType) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = wave;
    o.frequency.value = midiHz(note);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(900, at);
    f.frequency.exponentialRampToValueAtTime(220, at + dur);
    const g = this.env(at, 0.22, 0.006, dur);
    o.connect(f).connect(g).connect(this.bus);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  private pluck(at: number, note: number, dur: number, wave: OscillatorType, peak: number, echo = false) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = wave;
    o.frequency.value = midiHz(note);
    const g = this.env(at, peak, 0.005, dur);
    o.connect(g).connect(this.bus);
    if (echo) g.connect(this.delay);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  private bellNote(at: number, note: number) {
    const ctx = this.ctx!;
    for (const [mult, peak] of [
      [1, 0.05],
      [2.76, 0.015],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = midiHz(note) * mult;
      const g = this.env(at, peak, 0.004, 1.6);
      o.connect(g).connect(this.bus);
      g.connect(this.delay);
      o.start(at);
      o.stop(at + 1.7);
    }
  }

  private padChord(at: number, chord: number[], root: number, dur: number) {
    const ctx = this.ctx!;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 1100;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.05, at + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur * 1.05);
    f.connect(g).connect(this.bus);
    for (const tone of chord) {
      for (const detune of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = midiHz(root + tone);
        o.detune.value = detune;
        o.connect(f);
        o.start(at);
        o.stop(at + dur * 1.1);
      }
    }
  }
}

/** The site's one jukebox. */
export const music = new Engine();

const SERVER_STATE: MusicState = { playing: false, index: 0, volume: 0.6 };
/** Snapshot for server rendering (nothing plays there). */
export const serverMusicState = () => SERVER_STATE;
export { TRACKS };
