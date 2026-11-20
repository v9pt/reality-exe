"use client";

import { create } from "zustand";
import type { GameId } from "@/lib/arcade";
import { districtById, type DistrictId, type PanelId, type SectionId } from "@/lib/sections";
import { music } from "@/lib/music/engine";
import { groundHeight } from "@/lib/world-map";

export type Phase = "boot" | "world";
export type Quality = "low" | "medium" | "high";
export type CameraMode = "follow" | "free" | "overview";
/** What the avatar is standing next to: a section, the alley, a district or an arcade cabinet. */
export type NearId = SectionId | "backroom" | DistrictId | "jukebox" | `cab:${GameId}`;
export type FocusId = SectionId | "backroom" | null;

export type SecretId =
  | "konami"
  | "backroom"
  | "cat"
  | "vending"
  | "sign"
  | "sudo"
  | "devmode"
  | "arcade"
  | "overlook"
  | "jukebox";

export const SECRET_LABELS: Record<SecretId, string> = {
  konami: "Entered the old code",
  backroom: "Found the back alley",
  cat: "Made a friend",
  vending: "Bought a can of null",
  sign: "Fixed the flickering sign",
  sudo: "Asked for root, politely",
  devmode: "Saw the wireframe",
  arcade: "Played every cabinet",
  overlook: "Saw the whole district",
  jukebox: "Put a song on",
};

export type Toast = { id: number; title: string; body?: string; tone: "secret" | "info" };

type State = {
  phase: Phase;
  panel: PanelId | null;
  /** Section the camera should frame (set together with panel, or on hover in the map). */
  focus: FocusId;
  /** Thing the avatar is standing next to. */
  near: NearId | null;
  camMode: CameraMode;
  /** Game to start when the arcade sheet opens (null shows the picker). */
  arcadeGame: GameId | null;
  quality: Quality;
  /** Pixel ratio chosen by adaptive quality within the tier's range (null = tier default). */
  dpr: number | null;
  reducedMotion: boolean;
  devMode: boolean;
  visited: SectionId[];
  secrets: SecretId[];
  backroomOpen: boolean;
  commandsRun: number;
  catPets: number;
  enteredAt: number;
  toasts: Toast[];
  /** Pending terminal input injected from elsewhere (e.g. map → terminal). */
  terminalSeed: string | null;
  /** Selected quest on the board, so other sections can link straight to one. */
  questSlug: string | null;

  /** Vex's guided tour is on screen. */
  tour: boolean;
  startTour: () => void;
  endTour: () => void;
  setCamMode: (m: CameraMode) => void;
  cycleCamMode: () => void;
  openGame: (g: GameId | null) => void;
  /** Act on whatever the avatar is near: open a section, a cabinet or the alley. */
  interact: (n: NearId) => void;
  travel: (d: DistrictId) => void;
  enterWorld: () => void;
  open: (panel: PanelId) => void;
  close: () => void;
  setNear: (n: State["near"]) => void;
  setQuality: (q: Quality) => void;
  setDpr: (d: number | null) => void;
  setReducedMotion: (v: boolean) => void;
  toggleDevMode: () => void;
  unlock: (s: SecretId) => void;
  openBackroom: () => void;
  countCommand: () => void;
  petCat: () => void;
  toast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
  seedTerminal: (cmd: string | null) => void;
  openQuest: (slug: string) => void;
  setQuest: (slug: string | null) => void;
};

const STORAGE_KEY = "reality.exe/v1";
export const TOUR_KEY = "reality.exe/tour-seen";

type Saved = Pick<State, "secrets" | "visited" | "backroomOpen" | "catPets">;

function load(): Partial<Saved> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<Saved>) : {};
  } catch {
    return {};
  }
}

function save(s: Saved) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* private mode: progress just isn't kept */
  }
}

let toastId = 0;

export const useGame = create<State>()((set, get) => ({
  phase: "boot",
  panel: null,
  focus: null,
  near: null,
  camMode: "follow",
  arcadeGame: null,
  tour: false,
  quality: "medium",
  dpr: null,
  reducedMotion: false,
  devMode: false,
  visited: [],
  secrets: [],
  backroomOpen: false,
  commandsRun: 0,
  catPets: 0,
  enteredAt: 0,
  toasts: [],
  terminalSeed: null,
  questSlug: null,

  enterWorld: () => {
    const saved = load();
    set({
      phase: "world",
      enteredAt: Date.now(),
      secrets: saved.secrets ?? [],
      visited: saved.visited ?? [],
      backroomOpen: saved.backroomOpen ?? false,
      catPets: saved.catPets ?? 0,
    });
  },

  open: (panel) => {
    const isSection = panel !== "secret" && panel !== "backroom" && panel !== "arcade";
    const visited =
      isSection && !get().visited.includes(panel as SectionId)
        ? [...get().visited, panel as SectionId]
        : get().visited;
    set({
      panel,
      focus: panel === "secret" ? get().focus : panel === "arcade" ? null : (panel as SectionId | "backroom"),
      visited,
    });
    persist();
  },

  close: () => set({ panel: null, focus: null }),
  setNear: (near) => {
    if (get().near !== near) set({ near });
  },
  setQuality: (quality) => set({ quality, dpr: null }),
  setDpr: (dpr) => set({ dpr }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  toggleDevMode: () => {
    set({ devMode: !get().devMode });
    if (get().devMode) get().unlock("devmode");
  },

  unlock: (s) => {
    if (get().secrets.includes(s)) return;
    const secrets = [...get().secrets, s];
    set({ secrets });
    persist();
    get().toast({
      tone: "secret",
      title: SECRET_LABELS[s],
      body: `Secret ${secrets.length} of ${Object.keys(SECRET_LABELS).length}`,
    });
  },

  openBackroom: () => {
    if (!get().backroomOpen) {
      set({ backroomOpen: true });
      get().unlock("backroom");
    }
    persist();
  },

  countCommand: () => set({ commandsRun: get().commandsRun + 1 }),
  petCat: () => {
    set({ catPets: get().catPets + 1 });
    persist();
    get().unlock("cat");
  },

  toast: (t) => {
    const id = ++toastId;
    set({ toasts: [...get().toasts.slice(-2), { ...t, id }] });
    window.setTimeout(() => get().dismissToast(id), 4200);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  seedTerminal: (terminalSeed) => set({ terminalSeed }),
  openQuest: (slug) => {
    set({ questSlug: slug });
    get().open("quests");
  },
  setQuest: (questSlug) => set({ questSlug }),

  startTour: () => {
    if (get().panel) get().close();
    set({ tour: true });
  },
  endTour: () => {
    set({ tour: false });
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {
      /* private mode: the tour may show again next visit */
    }
  },
  setCamMode: (camMode) => {
    view.mode = camMode;
    set({ camMode });
  },
  cycleCamMode: () => {
    const order: CameraMode[] = ["follow", "free", "overview"];
    get().setCamMode(order[(order.indexOf(get().camMode) + 1) % order.length]);
  },
  openGame: (arcadeGame) => {
    set({ arcadeGame });
    get().open("arcade");
  },
  interact: (n) => {
    if (n === "jukebox") {
      void (music.getState().playing ? music.next() : music.play());
      get().unlock("jukebox");
      return;
    }
    if (n.startsWith("cab:")) get().openGame(n.slice(4) as GameId);
    else if (n === "arcade") get().openGame(null);
    else if (n === "garden" || n === "overlook") return;
    else get().open(n as PanelId);
  },
  travel: (id) => {
    const d = districtById(id);
    if (!d) return;
    if (get().panel) get().close();
    avatar.x = d.spawn[0];
    avatar.z = d.spawn[1];
    avatar.ground = groundHeight(avatar.x, avatar.z);
    avatar.heading = d.face;
    // Put the camera behind the avatar, looking the way it faces.
    view.yaw = d.face + Math.PI;
    view.snap = true;
    view.intro = 0;
    if (get().camMode === "overview") get().setCamMode("follow");
  },
}));

function persist() {
  const { secrets, visited, backroomOpen, catPets } = useGame.getState();
  save({ secrets, visited, backroomOpen, catPets });
}

/**
 * Movement input shared between keyboard, touch joystick and the render loop.
 * Kept outside React state so the frame loop reads it without re-renders.
 */
/**
 * `jump` is a one-shot request: set by Space or the touch button, consumed by the avatar.
 * `runLock` is the touch run toggle. `rot` and `zoom` are held camera keys (-1, 0, 1).
 */
export const input = { x: 0, z: 0, run: false, runLock: false, jump: false, rot: 0, zoom: 0 };
/**
 * Avatar position, written by the render loop, read by the map.
 * `ground` is the surface height under the avatar; `y` is the jump height above it.
 */
export const avatar = { x: 0, z: 2, y: 0, ground: 0, heading: Math.PI, speed: 0 };

/**
 * Camera state, mutated by pointer input and the camera rig every frame.
 * Each mode keeps its own pitch and distance so switching back restores them.
 */
export const view = {
  mode: "follow" as CameraMode,
  yaw: 0,
  pitch: { follow: 0.3, free: 0.55, overview: 0.95 } as Record<CameraMode, number>,
  dist: { follow: 6.5, free: 16, overview: 110 } as Record<CameraMode, number>,
  /** When the visitor last moved the camera by hand (ms). The follow camera waits before swinging back. */
  lookT: 0,
  /** Free-camera pan offset from the avatar. */
  panX: 0,
  panZ: 0,
  idle: 0,
  intro: 1,
  /** Skip the smoothing for one frame (after fast travel). */
  snap: false,
};

export const CAMERA_LIMITS: Record<CameraMode, { pitch: [number, number]; dist: [number, number] }> = {
  follow: { pitch: [0.02, 1.1], dist: [3.5, 12] },
  free: { pitch: [-0.1, 1.5], dist: [3, 70] },
  overview: { pitch: [0.45, 1.5], dist: [50, 150] },
};

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  // Handy in dev tools: __reality.game.getState(), __reality.avatar
  (window as unknown as Record<string, unknown>).__reality = { game: useGame, avatar, input, view, music };
}
