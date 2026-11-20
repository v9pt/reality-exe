/**
 * The jukebox's songs, written as data: tempo, key, a chord progression and
 * a pattern for each instrument. All original; the synth in engine.ts
 * performs them live, so nothing is downloaded.
 *
 * Patterns are 16 steps (one bar of sixteenth notes):
 *   drums  "x" hit, "o" accent/open, "." rest
 *   bass   a digit is a chord tone (0 root, 1 third, 2 fifth, 3 seventh), "-" octave root, "." rest
 *   lead   same as bass, one octave up, "+" adds an octave, "." rest
 *   arp    "a" plays the next chord tone in an up/down cycle
 */
export type Chord = number[]; // semitones above the key root

export type Track = {
  id: string;
  title: string;
  mood: string;
  bpm: number;
  /** MIDI note of the key root (e.g. 57 = A3). */
  root: number;
  /** One chord per bar, looped. */
  chords: Chord[];
  /** Swing amount for odd sixteenths, 0–0.3. */
  swing?: number;
  kick?: string;
  snare?: string;
  hat?: string;
  bass?: string;
  lead?: string[];
  arp?: string;
  pad?: boolean;
  bell?: string;
  /** Instrument colours. */
  leadWave?: OscillatorType;
  bassWave?: OscillatorType;
  /** Low-pass ceiling for the mix, Hz. */
  tone?: number;
};

const m = (r: number) => [0, 3, 7, 10].map((x) => x + r); // minor seventh
const M = (r: number) => [0, 4, 7, 11].map((x) => x + r); // major seventh
const d7 = (r: number) => [0, 4, 7, 10].map((x) => x + r); // dominant seventh
const tri = (r: number, minor = false) => [0, minor ? 3 : 4, 7].map((x) => x + r);

export const TRACKS: Track[] = [
  {
    id: "neon-rain",
    title: "Neon Rain",
    mood: "Synthwave, 96 bpm",
    bpm: 96,
    root: 57, // A
    chords: [tri(0, true), tri(-4), tri(3), tri(-2)], // Am F C G
    kick: "x...x...x...x...",
    snare: "....x.......x...",
    hat: "..x...x...x...x.",
    bass: "0.0-0.0-0.0-2.0-",
    arp: "aaaaaaaaaaaaaaaa",
    lead: ["2...1...0.......", "........0...1.2.", "2...+0..2...1...", "0.......1...0..."],
    pad: true,
    leadWave: "square",
    bassWave: "sawtooth",
    tone: 5200,
  },
  {
    id: "night-market",
    title: "Night Market",
    mood: "Lo-fi, 78 bpm",
    bpm: 78,
    root: 50, // D
    chords: [m(0), d7(5), M(10), m(7)], // Dm7 G7 Cmaj7 Am7
    swing: 0.22,
    kick: "x.....x...x.....",
    snare: "....x.......x..x",
    hat: "x.x.x.x.x.x.x.x.",
    bass: "0.....2...0...3.",
    lead: ["....3...2.1.....", "......2.....1...", "3.......2...1.0.", "........1...0..."],
    pad: true,
    leadWave: "triangle",
    bassWave: "triangle",
    tone: 2400,
  },
  {
    id: "overlook",
    title: "Overlook",
    mood: "Ambient, 64 bpm",
    bpm: 64,
    root: 52, // E
    chords: [M(0), m(-3), M(5), d7(7)], // Emaj7 C#m7 Amaj7 B7
    pad: true,
    bell: "x.......x...x...",
    lead: ["3.......2.......", "........1.......", "2.......+0......", "....1.......0..."],
    leadWave: "sine",
    tone: 3200,
  },
  {
    id: "arcade-rush",
    title: "Arcade Rush",
    mood: "Chiptune, 140 bpm",
    bpm: 140,
    root: 60, // C
    chords: [tri(0), tri(-3, true), tri(5), tri(7)], // C Am F G
    kick: "x...x...x...x...",
    snare: "....x.......x.x.",
    hat: "xxxxxxxxxxxxxxxx",
    bass: "0.0.-.0.0.0.-.2.",
    arp: "aaaaaaaaaaaaaaaa",
    lead: ["0.1.2.+0.2.1.0..", "2.2.1.0.1...0...", "0.1.2.+0.+0.2.1.", "2...1...0.1.2..."],
    leadWave: "square",
    bassWave: "square",
    tone: 7000,
  },
  {
    id: "back-alley",
    title: "Back Alley",
    mood: "Dark, 88 bpm",
    bpm: 88,
    root: 54, // F#
    chords: [tri(0, true), tri(-4), tri(3), tri(-2)], // F#m D A E
    kick: "x.......x.x.....",
    snare: "........x.......",
    hat: "....x.......x...",
    bass: "0..0..0.0..0..2.",
    lead: ["........2...1...", "0...............", "........2...+0..", "1.......0......."],
    pad: true,
    leadWave: "sawtooth",
    bassWave: "sawtooth",
    tone: 1800,
  },
  {
    id: "rooftop-signal",
    title: "Rooftop Signal",
    mood: "Downtempo, 90 bpm",
    bpm: 90,
    root: 55, // G
    chords: [m(0), M(-4), M(3), d7(-2)], // Gm7 Ebmaj7 Bbmaj7 F7
    swing: 0.12,
    kick: "x.....x...x.....",
    snare: "....x.......x...",
    hat: "..x...x...x...xo",
    bass: "0...0.3...2...0.",
    lead: ["2...1...........", "....0...1...2...", "+0......2...1...", "3.......2...0..."],
    pad: true,
    leadWave: "triangle",
    bassWave: "sawtooth",
    tone: 3000,
  },
  {
    id: "glass-arcade",
    title: "Glass Arcade",
    mood: "House, 122 bpm",
    bpm: 122,
    root: 48, // C
    chords: [m(0), M(-4), M(3), d7(-2)], // Cm7 Abmaj7 Ebmaj7 Bb7
    kick: "x...x...x...x...",
    snare: "....x.......x...",
    hat: "..o...o...o...o.",
    bass: ".0.0.0.0.2.0.0.3",
    arp: "a.a.a.a.a.a.a.a.",
    lead: ["0.....2.....1...", "........0...2...", "3.....2.....+0..", "2...1...0......."],
    pad: true,
    leadWave: "square",
    bassWave: "square",
    tone: 4800,
  },
  {
    id: "paper-lanterns",
    title: "Paper Lanterns",
    mood: "Calm, 72 bpm",
    bpm: 72,
    root: 50, // D
    chords: [tri(0), tri(-3, true), tri(5), tri(7)], // D Bm G A
    bell: "x...x...x.......",
    bass: "0.......2.......",
    lead: ["2.......1...0...", "........2.......", "1...2...+0......", "........0......."],
    pad: true,
    leadWave: "sine",
    bassWave: "triangle",
    tone: 2600,
  },
  {
    id: "static-bloom",
    title: "Static Bloom",
    mood: "Breakbeat, 132 bpm",
    bpm: 132,
    root: 52, // E
    chords: [tri(0, true), tri(-4), tri(3), tri(-2)], // Em C G D
    kick: "x.....x...x.....",
    snare: "....x..x....x...",
    hat: "x.xxx.xxx.xxx.xx",
    bass: "0.0...0.2...0-..",
    arp: "aaaaaaaaaaaaaaaa",
    lead: ["0...2...+0......", "2.1.0...........", "0...2...+0...2..", "1.......0......."],
    leadWave: "sawtooth",
    bassWave: "sawtooth",
    tone: 5600,
  },
  {
    id: "monorail",
    title: "Monorail",
    mood: "City pop, 108 bpm",
    bpm: 108,
    root: 53, // F
    chords: [M(0), m(-1), m(-3), M(-5)], // Fmaj7 Em7 Dm7 Cmaj7
    swing: 0.08,
    kick: "x.......x.x.....",
    snare: "....x.......x...",
    hat: "x.x.x.x.x.x.x.x.",
    bass: "0..0..2.0..3..2.",
    lead: ["3...2...1...2...", "+0......3.......", "2...1...0...1...", "2...............",],
    pad: true,
    leadWave: "triangle",
    bassWave: "sawtooth",
    tone: 4200,
  },
  {
    id: "last-train",
    title: "Last Train Home",
    mood: "Slow, 70 bpm",
    bpm: 70,
    root: 46, // Bb
    chords: [M(0), m(-3), M(5), d7(7)], // Bbmaj7 Gm7 Ebmaj7 F7
    kick: "x...........x...",
    snare: "........x.......",
    hat: "....x.......x...",
    bass: "0.......2...0...",
    lead: ["3.......2.......", "1.......0.......", "2...3...+0......", "1.......0......."],
    pad: true,
    leadWave: "sine",
    bassWave: "triangle",
    tone: 2200,
  },
  {
    id: "firewall",
    title: "Firewall",
    mood: "Darksynth, 128 bpm",
    bpm: 128,
    root: 45, // A
    chords: [tri(0, true), tri(-2), tri(-4), tri(-5)], // Am G F E
    kick: "x...x...x...x...",
    snare: "....x.......x..x",
    hat: "xxx.xxx.xxx.xxx.",
    bass: "0000000000000020",
    arp: "a.aaa.aaa.aaa.aa",
    lead: ["0.......2.......", "1...0...........", "0.......2...+0..", "2...1...0......."],
    leadWave: "sawtooth",
    bassWave: "sawtooth",
    tone: 3600,
  },
];
