/**
 * A tiny WebAudio synth for arcade blips. Muted by default; the visitor turns
 * it on. Nothing is loaded from the network.
 */
const KEY = "reality.exe/sound";
let ctx: AudioContext | null = null;

export function soundOn() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setSound(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* no storage: the toggle lasts this visit */
  }
  if (on) ctx ??= new AudioContext();
}

const VOICES: Record<string, [number, number, OscillatorType, number?]> = {
  flap: [520, 0.06, "square"],
  score: [880, 0.08, "square", 1320],
  hit: [140, 0.3, "sawtooth", 60],
  fire: [760, 0.05, "square", 380],
  boom: [220, 0.12, "triangle", 90],
  step: [90, 0.04, "square"],
  rotate: [600, 0.03, "square"],
  lock: [180, 0.05, "triangle"],
  clear: [660, 0.15, "square", 990],
  quad: [440, 0.35, "square", 1760],
  wave: [330, 0.3, "triangle", 990],
};

export function play(event: string, enabled: boolean) {
  const v = VOICES[event];
  if (!enabled || !v) return;
  try {
    ctx ??= new AudioContext();
    const [f0, dur, type, f1] = v;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  } catch {
    /* audio blocked: play silently */
  }
}
