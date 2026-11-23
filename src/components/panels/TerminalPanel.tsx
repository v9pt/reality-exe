"use client";

import { useEffect, useRef, useState } from "react";
import { achievements, profile, quests, roles, skillTree } from "@/config/portfolio";
import { JOKES } from "@/lib/jokes";
import { GAMES, gameById } from "@/lib/arcade";
import { formatLap } from "@/lib/circuit";
import { BOARD_GAMES, LOWER_IS_BETTER, callsign, fetchBoard, setCallsign, type BoardGame } from "@/lib/leaderboard";
import { POWERS } from "@/lib/powers";
import { PRESET_TIMES, WEATHERS, WEATHER_LABEL, formatClock, type PresetTime, type TimeMode, type Weather } from "@/lib/sky";
import { TRACKS, music } from "@/lib/music/engine";
import { DISTRICTS, SECTIONS, districtById, sectionById, type PanelId } from "@/lib/sections";
import { SECRET_LABELS, env, useGame } from "@/store/game";
import { Sheet } from "../ui/Sheet";

type Out = { id: number; kind: "in" | "out" | "err" | "sys"; body: React.ReactNode };

type Ctx = {
  args: string[];
  print: (body: React.ReactNode, kind?: Out["kind"]) => void;
  clear: () => void;
  go: (p: PanelId) => void;
  history: string[];
};

type Command = { help?: string; hidden?: boolean; args?: () => string[]; run: (c: Ctx) => void };

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="text-cyan underline decoration-cyan/40 underline-offset-2 hover:decoration-cyan">
    {children}
  </a>
);

const Go = ({ to, children }: { to: PanelId; children: React.ReactNode }) => (
  <button onClick={() => useGame.getState().open(to)} className="text-amber underline decoration-amber/40 underline-offset-2 hover:decoration-amber">
    {children}
  </button>
);

const openUrl = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

const COMMANDS: Record<string, Command> = {
  help: {
    help: "List commands",
    run: ({ print }) =>
      print(
        <div className="grid grid-cols-[9rem_1fr] gap-x-4">
          {Object.entries(COMMANDS)
            .filter(([, c]) => !c.hidden)
            .map(([k, c]) => (
              <div key={k} className="contents">
                <span className="text-cyan">{k}</span>
                <span className="text-hud-dim">{c.help}</span>
              </div>
            ))}
          <span className="col-span-2 mt-2 text-hud-dim">Tab completes, ↑ ↓ walk history, Ctrl+L clears. Not everything is listed.</span>
        </div>,
      ),
  },
  about: {
    help: "Who this is",
    run: ({ print }) =>
      print(
        <div>
          <p className="text-hud">
            {profile.name}, {profile.title}. {profile.location}.
          </p>
          {profile.bio.map((b) => (
            <p key={b} className="mt-1 max-w-[70ch] text-hud-dim">
              {b}
            </p>
          ))}
          <p className="mt-1 text-hud-dim">
            {profile.education.degree}, {profile.education.school} ({profile.education.period}).
          </p>
        </div>,
      ),
  },
  skills: {
    help: "Technology by branch",
    run: ({ print }) =>
      print(
        <div className="grid grid-cols-[12rem_1fr] gap-x-4">
          {skillTree.map((c) => (
            <div key={c.id} className="contents">
              <span className="text-violet">{c.name}</span>
              <span className="text-hud-dim">{c.skills.map((s) => s.name).join(", ")}</span>
            </div>
          ))}
          <span className="col-span-2 mt-1">
            <Go to="skills">Open the skill tree</Go>
          </span>
        </div>,
      ),
  },
  projects: {
    help: "List quests; `projects <name>` for one",
    args: () => quests.map((q) => q.slug),
    run: ({ print, args }) => {
      const q = args[0] && quests.find((x) => x.slug === args[0] || x.title.toLowerCase() === args.join(" ").toLowerCase());
      if (args[0] && !q) return print(`No quest called "${args.join(" ")}". Try: ${quests.map((x) => x.slug).join(", ")}`, "err");
      if (q) {
        return print(
          <div>
            <p className="text-hud">
              {q.title} <span className="text-hud-dim">({[q.kind, q.period].filter(Boolean).join(", ")})</span>
            </p>
            <p className="max-w-[70ch] text-hud-dim">{q.description ?? q.tagline}</p>
            {q.stack?.length ? <p className="text-hud-dim">stack: {q.stack.join(", ")}</p> : null}
            <button onClick={() => useGame.getState().openQuest(q.slug)} className="text-amber underline decoration-amber/40 underline-offset-2">
              Open the briefing
            </button>
          </div>,
        );
      }
      print(
        <div className="grid grid-cols-[10rem_1fr] gap-x-4">
          {quests.map((x) => (
            <div key={x.slug} className="contents">
              <button onClick={() => useGame.getState().openQuest(x.slug)} className="text-left text-cyan hover:underline">
                {x.slug}
              </button>
              <span className="text-hud-dim">{x.tagline}</span>
            </div>
          ))}
        </div>,
      );
    },
  },
  experience: {
    help: "Roles and education",
    run: ({ print }) =>
      print(
        <div>
          {roles.map((r) => (
            <p key={r.id}>
              <span className="text-hud">{r.role}</span>, {r.organisation} <span className="text-hud-dim">({r.period})</span>
            </p>
          ))}
          <p>
            <span className="text-hud">{profile.education.degree}</span>, {profile.education.short} <span className="text-hud-dim">({profile.education.period})</span>
          </p>
          <p className="text-hud-dim">feats: {achievements.map((a) => a.title).join("; ")}</p>
          <Go to="log">Open the archive</Go>
        </div>,
      ),
  },
  contact: {
    help: "Ways to reach me",
    run: ({ print }) =>
      print(
        <div className="grid grid-cols-[6rem_1fr] gap-x-4">
          <span>email</span>
          <A href={`mailto:${profile.contact.email}`}>{profile.contact.email}</A>
          <span>github</span>
          <A href={profile.contact.github}>{profile.contact.github.replace("https://", "")}</A>
          {profile.contact.linkedin ? (
            <>
              <span>linkedin</span>
              <A href={profile.contact.linkedin}>{profile.contact.linkedin.replace("https://www.", "")}</A>
            </>
          ) : null}
          {profile.contact.leetcode ? (
            <>
              <span>leetcode</span>
              <A href={profile.contact.leetcode}>{profile.contact.leetcode.replace("https://", "")}</A>
            </>
          ) : null}
          <span className="col-span-2 mt-1">
            <Go to="contact">Open comms to send a message</Go>
          </span>
        </div>,
      ),
  },
  github: {
    help: "Open GitHub",
    run: ({ print }) => {
      openUrl(profile.contact.github);
      print(<>Opening <A href={profile.contact.github}>{profile.contact.github}</A></>);
    },
  },
  leetcode: {
    help: "Open LeetCode",
    run: ({ print }) => {
      if (!profile.contact.leetcode) return print("No LeetCode profile configured.", "err");
      openUrl(profile.contact.leetcode);
      print(<>Opening <A href={profile.contact.leetcode}>{profile.contact.leetcode}</A></>);
    },
  },
  resume: {
    help: "Download the resume",
    run: ({ print }) => {
      if (!profile.contact.resume) return print(<>No resume file is published yet. <Go to="contact">Comms</Go> has every other channel.</>, "err");
      openUrl(profile.contact.resume);
      print("Opening the resume.");
    },
  },
  goto: {
    help: "Walk to a section: goto quests",
    args: () => SECTIONS.map((s) => s.id),
    run: ({ args, go, print }) => {
      const s = sectionById(args[0] ?? "");
      if (!s) return print(`Where to? ${SECTIONS.map((x) => x.id).join(", ")}`, "err");
      go(s.id);
    },
  },
  whoami: {
    help: "Who you are",
    run: ({ print }) => print("visitor@district-v9. Probably a recruiter. Possibly a fellow engineer. Definitely welcome."),
  },
  history: { help: "Commands you've run", run: ({ print, history }) => print(history.length ? history.map((h, i) => `${i + 1}  ${h}`).join("\n") : "Nothing yet.") },
  clear: { help: "Clear the screen", run: ({ clear }) => clear() },
  exit: { help: "Back to the city", run: () => useGame.getState().close() },
  powers: {
    help: "List your superpowers",
    run: ({ print }) =>
      print(
        <div className="grid grid-cols-[10rem_1fr] gap-x-4">
          {POWERS.map((p) => (
            <div key={p.id} className="contents">
              <span className="text-cyan">
                {p.glyph} {p.name}
              </span>
              <span className="text-hud-dim">
                {p.how} In the kart: {p.kart}.
              </span>
            </div>
          ))}
        </div>,
      ),
  },
  kart: {
    help: "How to drive, and the circuit",
    run: ({ print }) => print("Press K for the go-kart (it comes to you). W/S drive, A steers left, D steers right, Space drifts, K gets out. Every power works in the kart too. Press 0 for the circuit south of the plaza: every clean lap is timed and posted. Try `leaderboard kart`."),
  },
  leaderboard: {
    help: "Global top 10: leaderboard <game>",
    args: () => BOARD_GAMES,
    run: ({ print, args }) => {
      const game = (args[0] ?? "kart") as BoardGame;
      if (!BOARD_GAMES.includes(game)) return print(`Boards: ${BOARD_GAMES.join(", ")}`, "err");
      print(`Fetching the ${game} board…`, "sys");
      void fetchBoard(game).then((r) => {
        if (!r.ok) return print(r.message, "err");
        if (!r.board.length) return print("Nobody has posted yet. Be the first.");
        const fmt = (n: number) => (LOWER_IS_BETTER[game] ? formatLap(n) : String(n));
        const mine = r.you && !r.board.some((e) => e.you) ? `\nYou: #${r.you.rank}  ${fmt(r.you.score)}` : "";
        print(r.board.map((e, i) => `${String(i + 1).padStart(2)}. ${e.name.padEnd(16)} ${fmt(e.score)}${e.you ? "  ← you" : ""}`).join("\n") + mine + `\n${r.players} players, ${r.runs} runs logged.`);
      });
    },
  },
  weather: {
    help: "Change the weather: weather clear | rain | storm | fog | snow",
    args: () => WEATHERS,
    run: ({ print, args }) => {
      const g = useGame.getState();
      if (!args.length) return print(`It's ${WEATHER_LABEL[g.weather].toLowerCase()} in District V9. Try \`weather ${WEATHERS.filter((w) => w !== g.weather).join(" | ")}\`.`);
      const w = args[0].toLowerCase() as Weather;
      if (!WEATHERS.includes(w)) return print(`Weathers: ${WEATHERS.join(", ")}`, "err");
      g.setWeather(w);
      print(`Weather set to ${WEATHER_LABEL[w].toLowerCase()}.`, "sys");
    },
  },
  time: {
    help: "Set the time of day: time dawn | day | dusk | night | clock | cycle | pause",
    args: () => ["dawn", "day", "dusk", "night", "clock", "cycle", "pause"],
    run: ({ print, args }) => {
      const g = useGame.getState();
      const a = (args[0] ?? "").toLowerCase();
      const mode = g.timeMode === "clock" ? "following your clock" : g.timeMode === "paused" ? "paused" : "a day every 24 minutes";
      if (!a) return print(`It's ${formatClock(env.hours)} in District V9 (${mode}).`);
      if (a in PRESET_TIMES) {
        g.jumpTo(a as PresetTime);
        return print(`Skipped to ${a}: ${formatClock(env.hours)}.`, "sys");
      }
      if (a === "clock" || a === "cycle" || a === "pause" || a === "paused") {
        g.setTimeMode(a === "pause" ? "paused" : (a as TimeMode));
        return print(a === "clock" ? `The sky now follows your clock: ${formatClock(env.hours)}.` : a === "cycle" ? "A day now passes every 24 minutes." : "Time is paused.", "sys");
      }
      print("Usage: time dawn | day | dusk | night | clock | cycle | pause", "err");
    },
  },
  callsign: {
    help: "Set the name your scores go under",
    run: ({ print, args }) => {
      if (!args.length) return print(`Your callsign is ${callsign()}. Change it with \`callsign <name>\`.`);
      const n = setCallsign(args.join(" "));
      print(n ? `Callsign set to ${n}.` : "Callsigns are 2 to 16 letters, digits, spaces, dots or dashes.", n ? "sys" : "err");
    },
  },
  vex: {
    help: "Replay the guided tour",
    run: ({ print }) => {
      print("Calling Vex.", "sys");
      setTimeout(() => useGame.getState().startTour(), 400);
    },
  },
  tour: { hidden: true, run: (c) => COMMANDS.vex.run(c) },
  music: {
    help: "Jukebox: music, music next, music list, music stop",
    args: () => ["next", "prev", "list", "stop", ...TRACKS.map((t) => t.id)],
    run: ({ print, args }) => {
      const a = (args[0] ?? "").toLowerCase();
      const now = () => TRACKS[music.getState().index];
      if (a === "list") return print(TRACKS.map((t, i) => `${i + 1}. ${t.title}  (${t.mood})`).join("\n"));
      if (a === "stop" || a === "pause") {
        music.pause();
        return print("Music stopped.", "sys");
      }
      const pick = TRACKS.findIndex((t) => t.id === a || t.title.toLowerCase().startsWith(a) || String(TRACKS.indexOf(t) + 1) === a);
      const go = a === "next" ? music.next() : a === "prev" ? music.prev() : pick >= 0 && a ? music.play(pick) : music.play();
      void go.then(() => print(`Now playing: ${now().title}, ${now().mood}.`, "sys"));
      useGame.getState().unlock("jukebox");
    },
  },
  travel: {
    help: "Go to a district: arcade, garden, overlook, circuit or cafe",
    args: () => DISTRICTS.map((d) => d.id),
    run: ({ print, args }) => {
      const d = districtById(args[0] ?? "") ?? DISTRICTS.find((x) => args[0] && x.name.toLowerCase().startsWith(args[0].toLowerCase()));
      if (!d) return print(`Usage: travel ${DISTRICTS.map((x) => x.id).join(" | ")}`, "err");
      print(`Travelling to the ${d.name.toLowerCase()}. ${d.blurb}`, "sys");
      setTimeout(() => useGame.getState().travel(d.id), 500);
    },
  },
  play: {
    help: "Start an arcade game",
    args: () => GAMES.map((g) => g.id),
    run: ({ print, args }) => {
      const g = gameById(args[0] ?? "") ?? GAMES.find((x) => args[0] && x.title.toLowerCase().startsWith(args[0].toLowerCase()));
      if (!g) return print(`Games: ${GAMES.map((x) => x.id).join(", ")}. Try \`play stackfall\`.`, args[0] ? "err" : "out");
      useGame.getState().openGame(g.id);
    },
  },

  /* ── Not listed in help ── */
  ls: {
    hidden: true,
    run: ({ print, args }) =>
      print(`${args.includes("-a") || args.includes("-la") ? ".  ..  .secret  " : ""}about  quests/  skills/  archive/  comms/  arcade/  garden/  overlook/`),
  },
  cat: {
    hidden: true,
    args: () => [".secret", "about"],
    run: ({ print, args }) => {
      if (args[0] === ".secret") return print("The old code still works here. Up, up, down, down... you know the rest. Press it anywhere in the city.", "sys");
      if (args[0] === "about") return COMMANDS.about.run({ print, args: [], clear: () => {}, go: () => {}, history: [] });
      print(`cat: ${args[0] ?? ""}: No such file`, "err");
    },
  },
  cd: {
    hidden: true,
    args: () => ["backroom", ...SECTIONS.map((s) => s.id), ...DISTRICTS.map((d) => d.id)],
    run: ({ print, args, go }) => {
      const t = (args[0] ?? "").replace(/^\/|\/$/g, "");
      if (t === "backroom" || t === "alley") {
        useGame.getState().openBackroom();
        print("You slip through a gap between two buildings. Something purrs.", "sys");
        setTimeout(() => go("backroom"), 600);
        return;
      }
      const d = districtById(t);
      if (d) return COMMANDS.travel.run({ print, args: [d.id], clear: () => {}, go, history: [] });
      const s = sectionById(t) ?? SECTIONS.find((x) => x.name.toLowerCase().startsWith(t.toLowerCase()) && t);
      if (s) return go(s.id);
      print(t ? `cd: ${t}: No such place. There might be an alley somewhere, though.` : "You're already home.", t ? "err" : "out");
    },
  },
  sudo: {
    hidden: true,
    run: ({ print, args }) => {
      useGame.getState().unlock("sudo");
      if (args.join(" ").includes("hire")) {
        print("Permission granted. Routing you to comms.", "sys");
        setTimeout(() => useGame.getState().open("contact"), 700);
        return;
      }
      print("visitor is not in the sudoers file. This incident will be reported. (To a cat.)", "err");
    },
  },
  hire: { hidden: true, run: ({ print, go }) => (print("Excellent instinct. Opening comms.", "sys"), setTimeout(() => go("contact"), 500)) },
  joke: { hidden: true, run: ({ print }) => print(JOKES[Math.floor(Math.random() * JOKES.length)]) },
  coffee: { hidden: true, run: ({ print }) => print("418 I'm a teapot. Try the vending machine by the street terminal.", "err") },
  rm: { hidden: true, run: ({ print }) => print("Nice try. This city is read-only.", "err") },
  vim: { hidden: true, run: ({ print }) => print("You are now trapped in vim. Type :q to... oh wait, this isn't vim. You're free.") },
  ping: { hidden: true, run: ({ print }) => print(`PING ${profile.handle}: 64 bytes, time=1ms. Huzaifa is reachable. Run \`contact\`.`) },
  echo: { hidden: true, run: ({ print, args }) => print(args.join(" ")) },
  date: { hidden: true, run: ({ print }) => print(`${new Date().toString()}. In District V9 it's always night.`) },
  hello: { hidden: true, run: ({ print }) => print("Hi. Type `help` to see what I can do.") },
  "42": { hidden: true, run: ({ print }) => print("Correct. Now what was the question?") },
  konami: { hidden: true, run: ({ print }) => print("Close. It isn't typed, it's pressed.", "sys") },
  secrets: {
    hidden: true,
    run: ({ print }) => {
      const found = useGame.getState().secrets;
      print(`${found.length} of ${Object.keys(SECRET_LABELS).length} found${found.length ? ": " + found.map((s) => SECRET_LABELS[s].toLowerCase()).join("; ") : ""}.`);
    },
  },
  wireframe: {
    hidden: true,
    run: ({ print }) => {
      useGame.getState().toggleDevMode();
      print(`Developer view ${useGame.getState().devMode ? "on" : "off"}. The city is just boxes and shaders.`, "sys");
    },
  },
  neofetch: {
    hidden: true,
    run: ({ print }) =>
      print(
        <div className="flex gap-6">
          <pre className="text-crimson leading-tight">{"  /\\\n /  \\\n/ V9 \\\n‾‾‾‾‾‾"}</pre>
          <div>
            <p>
              <span className="text-cyan">{profile.handle}</span>@reality.exe
            </p>
            <p>os: District V9 (always night)</p>
            <p>shell: rsh (reality shell)</p>
            <p>renderer: three.js, react-three-fiber</p>
            <p>quests: {quests.length}</p>
            <p>quality: {useGame.getState().quality}</p>
          </div>
        </div>,
      ),
  },
};

const NAMES = Object.keys(COMMANDS);
let outId = 0;

function complete(line: string): { value: string; options: string[] } {
  const parts = line.split(" ");
  if (parts.length === 1) {
    const opts = NAMES.filter((n) => n.startsWith(parts[0]) && !COMMANDS[n].hidden);
    const all = opts.length ? opts : NAMES.filter((n) => n.startsWith(parts[0]));
    if (all.length === 1) return { value: all[0] + " ", options: [] };
    return { value: commonPrefix(all) || line, options: all };
  }
  const cmd = COMMANDS[parts[0]];
  const pool = cmd?.args?.() ?? [];
  const last = parts[parts.length - 1];
  const opts = pool.filter((p) => p.startsWith(last));
  if (opts.length === 1) return { value: [...parts.slice(0, -1), opts[0]].join(" "), options: [] };
  const pre = commonPrefix(opts);
  return { value: pre ? [...parts.slice(0, -1), pre].join(" ") : line, options: opts };
}

function commonPrefix(list: string[]) {
  if (!list.length) return "";
  let p = list[0];
  for (const s of list) while (!s.startsWith(p)) p = p.slice(0, -1);
  return p;
}

export function TerminalPanel() {
  const [lines, setLines] = useState<Out[]>(() => [
    { id: ++outId, kind: "sys", body: `reality shell, District V9. Signed in as visitor.` },
    { id: ++outId, kind: "sys", body: "Type `help` and press Enter. Tab completes." },
  ]);
  const [value, setValue] = useState("");
  const [hist, setHist] = useState<string[]>([]);
  const [cursor, setCursor] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const seed = useGame((s) => s.terminalSeed);

  const print = (body: React.ReactNode, kind: Out["kind"] = "out") => setLines((l) => [...l.slice(-200), { id: ++outId, kind, body }]);

  const run = (raw: string) => {
    const line = raw.trim();
    print(line, "in");
    if (!line) return;
    const nextHist = [...hist, line].slice(-50);
    setHist(nextHist);
    setCursor(-1);
    useGame.getState().countCommand();
    const [name, ...args] = line.split(/\s+/);
    const cmd = COMMANDS[name.toLowerCase()];
    if (!cmd) {
      const guess = NAMES.find((n) => n.startsWith(name.slice(0, 2).toLowerCase()) && !COMMANDS[n].hidden);
      print(`${name}: command not found.${guess ? ` Did you mean \`${guess}\`?` : " Try `help`."}`, "err");
      return;
    }
    try {
      cmd.run({ args, print, clear: () => setLines([]), go: (p) => useGame.getState().open(p), history: nextHist });
    } catch (e) {
      print(`Something broke running ${name}: ${(e as Error).message}`, "err");
    }
  };

  useEffect(() => {
    if (seed) {
      // A command handed over from elsewhere (map, quest links) runs once on arrival.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      run(seed);
      useGame.getState().seedTerminal(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      run(value);
      setValue("");
    } else if (e.key === "Tab") {
      e.preventDefault();
      const { value: v, options } = complete(value);
      setValue(v);
      if (options.length > 1) print(options.join("   "), "sys");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!hist.length) return;
      const c = cursor === -1 ? hist.length - 1 : Math.max(0, cursor - 1);
      setCursor(c);
      setValue(hist[c]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (cursor === -1) return;
      const c = cursor + 1;
      if (c >= hist.length) {
        setCursor(-1);
        setValue("");
      } else {
        setCursor(c);
        setValue(hist[c]);
      }
    } else if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      setLines([]);
    } else if (e.ctrlKey && e.key.toLowerCase() === "c") {
      e.preventDefault();
      print(value + "^C", "in");
      setValue("");
    } else if (e.ctrlKey && e.key.toLowerCase() === "u") {
      e.preventDefault();
      setValue("");
    }
  };

  const quick = ["help", "about", "projects", "skills", "experience", "contact"];

  return (
    <Sheet glyph={SECTIONS[4].glyph} title="Terminal" subtitle="A working shell for the portfolio. Commands open sections and links." tone="dark" wide>
      <div className="flex h-full min-h-[60vh] flex-col font-mono text-[13px] leading-6" onClick={() => inputRef.current?.focus()}>
        <div className="flex-1" role="log" aria-live="polite" aria-label="Terminal output">
          {lines.map((l) => (
            <div key={l.id} className={`whitespace-pre-wrap ${l.kind === "err" ? "text-crimson" : l.kind === "sys" ? "text-amber/90" : l.kind === "in" ? "text-hud" : "text-hud/85"}`}>
              {l.kind === "in" ? <span className="text-cyan">visitor@v9 ~ $ </span> : null}
              {l.body}
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <label className="mt-3 flex items-center gap-2 border-t border-hud/15 pt-3">
          <span className="shrink-0 text-cyan">visitor@v9 ~ $</span>
          <input
            ref={inputRef}
            data-autofocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKey}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Terminal command"
            className="min-w-0 flex-1 bg-transparent text-hud caret-cyan outline-none"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Common commands">
          {quick.map((q) => (
            <button key={q} onClick={() => run(q)} className="border border-hud/20 px-2 py-0.5 text-[12px] text-hud-dim hover:border-cyan hover:text-cyan">
              {q}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
