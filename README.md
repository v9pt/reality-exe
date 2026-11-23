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

## Deploy

Vercel (or any Node host) works with no extra setup; three things to set:

| Variable | Needed for |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Your domain, e.g. `https://huzaifa.dev`, for share cards, the sitemap and robots. On Vercel the production URL is used when it's unset. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | The global leaderboard on serverless hosts. A free Upstash database is enough. On Vercel, adding the Upstash (KV) integration sets `KV_REST_API_URL` / `KV_REST_API_TOKEN`, which also work. |
| `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` | The contact form (see below). |

Everything is optional: without them the leaderboard and the contact form say
they're offline and fall back gracefully. The build includes a share image
(`/opengraph-image`), `robots.txt`, `sitemap.xml` and a 404 page, and responses
carry basic security headers (`next.config.ts`).

| Script | What it does |
| --- | --- |
| `npm run check` | Typecheck, lint, test and build: what CI runs |
| `npm test` | Unit tests (Vitest): physics and collision (including a fuzz test that powers never pass through buildings), the circuit and barriers, the world map, every game and the leaderboard stores |
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
| 7, 8, 9, 0 | Travel to the Arcade, Garden, Overlook, Circuit |
| N | Hide or show the quick menu |
| T, Y | Next weather, next time of day |
| Q / Shift+Q, F | Switch power, use power |
| K | Get in or out of the kart |
| `` ` `` | Terminal |
| Esc | Close a sheet |

**Touch:** joystick (push to the edge to run), a look pad that works at the same
time as the joystick, pinch to zoom, two-finger pan in Free camera, and buttons
for camera mode, run lock and jump. The bottom bar holds every section, the
game list and fast travel; its Menu tab folds it away. Phones on their side use the same compact layout.

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

## Powers, the kart and the circuit

Six original abilities share one energy meter that refills on its own.
Q (Shift+Q back) switches, F uses; on touch, Power and Switch buttons.
Every power works anywhere in the city: on foot, in mid-air, mid-swing and
in the kart. Targets are kept inside the city's edge.

| Power | What it does |
| --- | --- |
| Grapple line | Hold F: a line to the nearest rooftop ahead (a courier drone catches it in open sky); swing, let go to fly, fire again mid-swing to chain. In the kart: hops you out and swings |
| Elastic reach | Your arm stretches to a rooftop or landmark and slings you there. In the kart: hops you out and slings |
| Overdrive | Toggle super speed with afterimages; drains energy while on. In the kart: a boost |
| Sky leap | A huge jump, plus one more lift in mid-air; hold F on the way down to glide. In the kart: a kart jump |
| Ground slam | Dive and land with a shockwave; from the ground you spring up first. Works in the kart too |
| Blink | Flash up to twelve metres forward. In the kart: a dash |

The city is free roam: rooftops, landmarks, the overlook and the elevated
highway are all surfaces you can land on, and nothing passes through walls:
every power moves you through the same collision as walking, and the frame
loop moves you out if anything ever overlaps (landing in the pond, say).
Physics lives in `src/lib/motion.ts` (pure, tested).

**Kart:** K (or the Kart button) brings a go-kart to you. W/S drive, A steers
left and D right, Space drifts, Overdrive boosts. **Circuit:** press 0. Cross the start line to
time a lap; every checkpoint must be passed without leaving the track. Low
red-and-white barriers line both edges (karts bounce off them; on foot you can
jump them), with an opening where the south avenue comes in. Track
data and the lap timer are in `src/lib/circuit.ts`.

## Global leaderboard

Every finished arcade game and every clean lap is posted to `/api/scores`
under the visitor's callsign (pick one in the arcade, on the kart lap board, or
with `callsign` in the terminal). The board keeps **each player's best** per
game, so one driver can't fill the top ten, and counts every run. Your own row
is marked, and your rank shows even when you're outside the top ten. Open the
lap board from the **Lap board** button at the circuit, the arcade's game list
or `leaderboard kart` in the terminal.

A player is a random id made on the visitor's device. It is never shown and
only keeps two people with the same callsign apart. The server stores the id,
callsign, score and time, never IP addresses. It refuses impossible scores
(laps under four seconds, for instance), limits each address to 20 posts a
minute and caps request size.

Storage: set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (or
Vercel's `KV_REST_API_URL` / `KV_REST_API_TOKEN`) for serverless hosting.
Without them scores go to `.data/scores.json` (`SCORES_FILE` to move it), which
suits development and an always-on Node server. If the store can't be written,
the board says it is offline and scores stay on the visitor's device.

## Weather, day and night

The **天 Weather** button (top right) switches the weather and the time:

- **Weather:** Clear, Rain, Storm (with soft lightning), Fog and Snow. Each
  blends in over a few seconds; puddles dry out slowly and snow settles on
  roofs, the ground and the track. T cycles through them.
- **Time:** the sun and moon follow real solar geometry for New Delhi on the
  visitor's date, so sunrise and sunset shift with the seasons, and the moon
  shows its real phase. By default a day passes every 24 minutes; switch to
  **My clock** to match the visitor's local time, or **Paused**. Dawn, Day,
  Dusk and Night jump straight there (Y steps through them).
- The choice and the time are remembered. First visits start at 19:30 in the
  rain, so the city still opens at night.

Everything is uniforms in the existing shaders (`src/lib/sky.ts` for the maths,
`SkyDriver.tsx` writes them once a frame): no textures, no extra draw calls
except the snowflakes. Lightning is off with reduced motion.
Terminal: `weather snow`, `time dusk`, `time clock`.

## Cat café

North-east of the plaza, past the ring road (fast travel: **Cat café** in the
menu, or `travel cafe`). Six original cats (Mochi, Tofu, Nori, Pixel, Kumo and
Byte) wander, nap, groom and watch you. Walk up to one and press E, or click or
tap it: it stops, purrs (a tiny synth purr if you've switched sound on) and
hearts float up. Pet all six for a secret. The cats are a small seeded
simulation in `src/lib/cats.ts` (tested); the café's walls and furniture are
solid like everything else.

## Vex, the guide

On a first visit (after the boot screen, unless a deep link opened a sheet),
Vex asks whether you'd like a tour; Yes starts it, No thanks never asks again.
Vex, a small holo-drone, gives a twelve-step tour: moving, the camera, the six
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

Fourteen of them. The hidden file (秘 counter, top right) lists hints.
