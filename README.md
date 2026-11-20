# REALITY.EXE

Huzaifa Mulla's portfolio as a city you can walk through. A night district
(District V9) rendered in WebGL: six landmarks round a plaza open the
portfolio sections as paper "field manual" sheets, and avenues lead out to an
arcade, a garden and a raised overlook.

## Run it

```bash
npm install
npm run dev        # http://localhost:3100
```

Production: `npm run build && npm start`.

| Script | What it does |
| --- | --- |
| `npm run check` | Typecheck, lint, test and build: what CI runs |
| `npm test` | Unit tests (Vitest) for collision, the world map, every game and the score table |
| `npm run coverage` | Tests with coverage for `src/lib` and `src/arcade` |
| `npm run lint` | ESLint (Next.js core web vitals + TypeScript rules) |
| `npm run format` | Prettier |

CI (`.github/workflows/ci.yml`) runs typecheck, lint, tests and the production build on every push and pull request.

## Edit the content

Everything a visitor reads is in **`src/config/portfolio.ts`**: profile, bio,
contact links, quests (projects), roles, achievements and the skill tree.
Optional fields are hidden when left out, so nothing renders as filler.

- **Resume:** put a PDF in `public/` and set `profile.contact.resume` (e.g. `"/resume.pdf"`).
  The button appears in Comms and `resume` works in the terminal.
- **Screenshots:** add `images: [{ src, alt }]` to a quest. Without images,
  each quest shows its own procedurally drawn scene.
- **New project:** add an entry to `quests`. Lower `openQuestSlots` as you fill them.
- **Skill evidence** is derived automatically: a skill node is filled when its
  name (or an alias) appears in a quest's stack/write-up or a role. Nothing is scored by hand.

## Contact form

Sends through [Resend](https://resend.com) (free tier) when these are set
(see `.env.example`):

```
RESEND_API_KEY=...
CONTACT_TO_EMAIL=...
CONTACT_FROM_EMAIL="Portfolio <portfolio@your-verified-domain>"
```

Without them the form validates, then says the relay is offline and offers to
open the visitor's email app with the message filled in. The success animation
only plays after the server confirms a send.

## Controls

**Keyboard and mouse**

| Input | Action |
| --- | --- |
| WASD / arrows, Shift | Walk, run |
| Space | Jump |
| Drag | Orbit the camera |
| Scroll, `-` `=` | Zoom |
| `[` `]` | Turn the camera |
| C | Camera mode: Follow → Free → Overview |
| Right-drag or Shift-drag | Pan (Free camera); double-click to recentre |
| E | Open what you're next to (landmark, cabinet, jukebox, alley) |
| M | Play or pause music |
| 1 to 6 | Open a section |
| 7, 8, 9 | Travel to the Arcade, Garden, Overlook |
| `` ` `` | Terminal |
| Esc | Close a sheet |

**Touch:** joystick (push to the edge to run), a look pad that works at the same
time as the joystick, pinch to zoom, two-finger pan in Free camera, and buttons
for camera mode, run lock and jump. The bottom bar holds every section, the
game list and fast travel. Phones on their side use the same compact layout.

**Camera modes:** *Follow* is a third-person chase camera over the right
shoulder: it swings back behind the character while you run (unless you're
running toward it), dragging only changes where you look, and the character's
head turns to look the same way; *Free* orbits from
straight down to street level and pulls back to 70 m, with pan; *Overview*
frames the whole district from above and drifts slowly. A spring arm keeps the
camera out of buildings and above the ground, and fog thins as it pulls back.

Deep links: `/?go=quests` (or `profile`, `skills`, `log`, `terminal`,
`contact`, `arcade`), `/?go=garden` and `/?go=overlook` travel there.
Test the fallback with `/?nowebgl=1`.

## Arcade

Five original games (genres you'll recognise; names, art and rules are this
project's own). Walk up to a cabinet on the arcade strip and press E, open the
game list from the nav, or type `play <game>` in the terminal.

| Game | Genre | Keys |
| --- | --- | --- |
| Skyhop | Gap runner | Space / W / click |
| Null Fleet | Fixed shooter | A D or arrows, Space |
| Stackfall | Falling blocks (7-bag, SRS kicks, hold, ghost) | arrows, Up/X, Z, Space, C |
| Signal Snake | Snake | WASD or arrows |
| Bug Hunt | Reflex (from the back alley) | click |

P pauses; games also pause when the tab is hidden. Best scores (top five per
game) stay in `localStorage`. Sound is off until you turn it on; it's a tiny
WebAudio synth, nothing downloaded.

**Adding a game:** write the rules as a pure module in `src/arcade/` exporting a
`GameLogic` (`create(seed)`, `update(state, controls, dt)`, `score`, `over`),
add a renderer to `components/arcade/render.ts`, register it in
`lib/arcade.ts` and `ArcadePanel.tsx`, and add touch buttons in `TouchPad.tsx`.
Logic runs at a fixed 60 Hz, so tests can drive it step by step with
`scripted()` controls.

## Vex, the guide

On a first visit (after the boot screen, unless a deep link opened a sheet),
Vex, a small holo-drone, gives a ten-step tour: moving, the camera, the six
sections, travel, the minimap, the arcade, the jukebox and secrets. Each step
spotlights the real control it describes, and the Overview camera shows the
districts. Back, Next, Enter, arrow keys and Esc all work; reduced motion
shows the text at once. Replay it from **Controls → Take the tour with Vex**
or `vex` in the terminal. Steps live in `src/components/ui/Vex.tsx`; HUD
elements carry `data-tour` attributes so the spotlight finds them on any layout.

## Jukebox

Twelve original tracks (synthwave, lo-fi, ambient, chiptune, house, breakbeat, city pop, darksynth and more) written as
data in `src/lib/music/tracks.ts` (tempo, key, chords and a 16-step pattern per
instrument) and performed live by a small WebAudio synth and sequencer in
`src/lib/music/engine.ts`. Nothing is downloaded and nothing plays until the
visitor presses play: the 音 Jukebox button (top right), the jukebox on the
plaza, M, or `music` in the terminal. Music continues across sheets, the arcade
and camera modes; volume and last track are remembered. The plaza jukebox's
neon pulses with the output level.

## Architecture

```
src/
  config/          portfolio.ts (content), types.ts
  lib/
    world-map.ts   the district as data: zones, ramps, solids, buildings, camera obstacles
    walk.ts        collision API used by the avatar
    sections.ts    landmarks and districts (shared by world, nav, terminal, maps)
    arcade.ts      game catalogue
    camera.ts      camera input helpers (three-free, used by the HUD)
    evidence, device, contact, jokes
  arcade/          pure game logic + tests: skyhop, nullfleet, stackfall, snake, highscores
  store/game.ts    zustand state; `input`, `avatar` and `view` are mutable singletons for the frame loop
  components/
    Experience.tsx   boot → world orchestration, WebGL detection, error boundary
    boot/            boot sequence (progress waits on the real world chunk)
    world/           three.js layer, dynamically imported
      City.tsx         sky, map-driven ground, chunked instanced buildings, signs, rain
      Districts.tsx    arcade strip, garden, overlook, street lamps, highway and traffic
      Landmarks.tsx    six locations, vending machine, back alley, cat
      Avatar.tsx       avatar, movement, jumping, ramps, proximity
      CameraRig.tsx    follow / free / overview camera with spring arm
      shaders.ts       hand-written shaders with baked lighting, GPU-driven traffic
      AdaptiveQuality  keeps 60 fps (or near the display rate) by stepping DPR, then tier
      PerfProbe        the ?perf=1 readout
    arcade/          game runtime: fixed-step loop, input, touch pad, renderers, sheet
    ui/              HUD, sheet, overlays, keyboard controls, flat map fallback
    panels/          section sheets and the secret ones
```

## Performance

Open **`/?perf=1`** for a live readout: frame rate, average and worst frame
time, draw calls, triangles, pixel ratio, quality tier and the measured display
refresh rate.

- The frame loop is uncapped: it runs at the display's refresh rate (60, 120,
  144 Hz) when the GPU allows. Adaptive quality judges the median of 2-second
  windows, lowers the pixel ratio before it drops a tier when frames fall under
  55 fps, and climbs back when they sit near the refresh rate. Hidden or
  throttled tabs are ignored so they can't drag the tier down.
- Buildings: one shared shader, split into a 4 × 4 grid of instanced meshes so
  whole chunks are culled when off screen. A low-detail skyline ring fills the
  horizon past the detailed city.
- Highway traffic is placed entirely in the vertex shader; lamps, trees,
  benches and pillars are instanced.
- No textures are downloaded: signs, cabinet screens and the ground map are
  drawn to canvas at runtime from the same data as the collision.
- Five real lights in total (two follow the avatar); glows are additive sprites
  instead of post-processing bloom.
- The canvas stops rendering while a full-screen sheet covers it on phones, and
  on every screen while an arcade game is running.

Measured in development on this machine's 60 Hz display: 60 fps at the high
tier, about 50–220 draw calls depending on the view.

## Secrets

Ten of them. The hidden file (秘 counter, top right) lists hints.
