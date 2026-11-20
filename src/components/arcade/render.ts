/**
 * Canvas renderers for the arcade games. Each draws a game state in game
 * units; the runtime has already scaled the context for size and DPR.
 * One visual language across the cabinets: dark field, scanlines, neon edges.
 */
import * as Fleet from "@/arcade/nullfleet";
import * as Hop from "@/arcade/skyhop";
import * as Snake from "@/arcade/snake";
import * as Stack from "@/arcade/stackfall";

const INK = "#05060f";
const HUD = "#e9e4d6";
const DIM = "#7d7a90";
const CYAN = "#3ee8e0";
const CRIMSON = "#ff3b4f";
const VIOLET = "#8b6cff";
const AMBER = "#ffb547";

function field(g: CanvasRenderingContext2D, w: number, h: number, tint = "#0b0d1f") {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, tint);
  grd.addColorStop(1, INK);
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
}

function scanlines(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = "rgba(0,0,0,0.18)";
  for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
}

function glowRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, blur = 10) {
  g.save();
  g.shadowColor = color;
  g.shadowBlur = blur;
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
  g.restore();
}

let family: string | null = null;
/** Canvas can't read CSS variables in a font string, so resolve the display face once. */
function display() {
  if (family) return family;
  const v = typeof window === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue("--font-saira").trim();
  family = v ? `${v}, sans-serif` : "sans-serif";
  return family;
}

function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = HUD, align: CanvasTextAlign = "center") {
  g.font = `800 ${size}px ${display()}`;
  g.textAlign = align;
  g.textBaseline = "middle";
  g.fillStyle = color;
  g.fillText(s, x, y);
}

/* ───────────────────────── Skyhop ───────────────────────── */

export function drawSkyhop(g: CanvasRenderingContext2D, s: Hop.State) {
  const { W, H, GROUND } = Hop;
  field(g, W, H, "#140c2a");
  // Far skyline drifting slower than the pylons.
  const off = (s.t * 18) % 48;
  g.fillStyle = "#151733";
  for (let i = -1; i < 8; i++) {
    const x = i * 48 - off;
    const h = 60 + ((i * 37 + 11) % 5) * 22;
    g.fillRect(x, GROUND - h, 40, h);
  }
  for (const p of s.pylons) {
    const top = p.gapY - Hop.GAP / 2;
    const bot = p.gapY + Hop.GAP / 2;
    g.fillStyle = "#1c1f3a";
    g.fillRect(p.x, 0, Hop.PYLON_W, top);
    g.fillRect(p.x, bot, Hop.PYLON_W, GROUND - bot);
    glowRect(g, p.x - 3, top - 8, Hop.PYLON_W + 6, 8, CYAN);
    glowRect(g, p.x - 3, bot, Hop.PYLON_W + 6, 8, CYAN);
    g.fillStyle = "rgba(62,232,224,0.25)";
    for (let y = 12; y < top - 12; y += 18) g.fillRect(p.x + 8, y, Hop.PYLON_W - 16, 3);
    for (let y = bot + 20; y < GROUND - 10; y += 18) g.fillRect(p.x + 8, y, Hop.PYLON_W - 16, 3);
  }
  // Ground strip.
  g.fillStyle = "#0d0f20";
  g.fillRect(0, GROUND, W, H - GROUND);
  glowRect(g, 0, GROUND, W, 2, CRIMSON, 8);
  const dash = (s.t * s.speed) % 24;
  g.fillStyle = "rgba(233,228,214,0.25)";
  for (let x = -dash; x < W; x += 24) g.fillRect(x, GROUND + 18, 12, 2);
  // Drone: a body, two rotors, a visor, tilted with velocity.
  g.save();
  g.translate(Hop.DRONE_X, s.y);
  g.rotate(Math.max(-0.5, Math.min(0.9, s.vy / 700)));
  g.shadowColor = CRIMSON;
  g.shadowBlur = 12;
  g.fillStyle = "#2a2f52";
  g.fillRect(-12, -7, 24, 14);
  g.fillStyle = CRIMSON;
  g.fillRect(-14, -10, 9, 3);
  g.fillRect(5, -10, 9, 3);
  g.fillStyle = CYAN;
  g.fillRect(3, -3, 8, 3);
  g.restore();
  scanlines(g, W, H);
  text(g, String(s.score), W / 2, 50, 44);
  if (s.phase === "ready") {
    text(g, "SKYHOP", W / 2, H * 0.25, 46, CYAN);
    text(g, "Tap or press Space to thrust", W / 2, H * 0.62, 18, DIM);
  }
  const b = Hop.badge(s.score);
  if (s.phase === "over" && b) text(g, `Rank: ${b}`, W / 2, 86, 18, AMBER);
}

/* ───────────────────────── Null Fleet ───────────────────────── */

export function drawNullFleet(g: CanvasRenderingContext2D, s: Fleet.State) {
  const { W, H } = Fleet;
  field(g, W, H, "#1a0b18");
  // Star dust.
  g.fillStyle = "rgba(233,228,214,0.35)";
  for (let i = 0; i < 40; i++) g.fillRect((i * 83) % W, (i * 131 + s.t * 8 * ((i % 3) + 1)) % H, 1, 1);
  // Formation: data packets drawn as geometric glyphs (core, diamond, ring), pulsing.
  const pulse = 0.85 + Math.sin(s.t * 5) * 0.15;
  const colors = [AMBER, CRIMSON, VIOLET, CYAN];
  s.alive.forEach((a, i) => {
    if (!a) return;
    const [x, y] = Fleet.enemyPos(s, i);
    const row = Math.floor(i / Fleet.COLS);
    const c = colors[row];
    const cx = x + Fleet.EW / 2;
    const cy = y + Fleet.EH / 2;
    const r = (Fleet.EW / 2) * pulse;
    g.save();
    g.shadowColor = c;
    g.shadowBlur = 8;
    g.strokeStyle = c;
    g.fillStyle = c;
    g.lineWidth = 2;
    g.beginPath();
    if (row === 0) {
      // Hexagonal core with a dark centre.
      for (let k = 0; k < 6; k++) g.lineTo(cx + Math.cos((k / 6) * Math.PI * 2) * r, cy + Math.sin((k / 6) * Math.PI * 2) * r * 0.8);
      g.closePath();
      g.fill();
      g.fillStyle = INK;
      g.fillRect(cx - 2, cy - 2, 4, 4);
    } else if (row === 1) {
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r, cy);
      g.lineTo(cx, cy + r);
      g.lineTo(cx - r, cy);
      g.closePath();
      g.stroke();
      g.fillRect(cx - 2, cy - 2, 4, 4);
    } else {
      g.arc(cx, cy, r * 0.75, 0, Math.PI * 2);
      g.stroke();
      g.fillRect(cx - r, cy - 1, r * 2, 2);
    }
    g.restore();
  });
  // Shields.
  for (const sh of s.shields) {
    g.fillStyle = "rgba(255,59,79,0.7)";
    sh.cells.forEach(
      (on, k) =>
        on && g.fillRect(sh.x + (k % Fleet.SHIELD_COLS) * Fleet.CELL, sh.y + Math.floor(k / Fleet.SHIELD_COLS) * Fleet.CELL, Fleet.CELL - 1, Fleet.CELL - 1),
    );
  }
  // Shots.
  if (s.shot) glowRect(g, s.shot.x - 1, s.shot.y - 8, 2, 8, CYAN);
  for (const b of s.enemyShots) glowRect(g, b.x - 1.5, b.y - 6, 3, 6, CRIMSON);
  // Ship (blinks while invulnerable).
  if (!(s.invuln > 0 && Math.floor(s.t * 12) % 2)) {
    g.save();
    g.translate(s.ship, Fleet.SHIP_Y);
    g.shadowColor = CYAN;
    g.shadowBlur = 10;
    g.fillStyle = HUD;
    g.beginPath();
    g.moveTo(0, -10);
    g.lineTo(12, 6);
    g.lineTo(-12, 6);
    g.closePath();
    g.fill();
    g.fillStyle = CYAN;
    g.fillRect(-2, -4, 4, 6);
    g.restore();
  }
  glowRect(g, 0, H - 10, W, 1, CRIMSON, 6);
  scanlines(g, W, H);
  text(g, `SCORE ${s.score}`, 10, 14, 16, HUD, "left");
  text(g, `WAVE ${s.wave}`, W / 2, 14, 16, DIM);
  text(g, "▲".repeat(Math.max(0, s.lives)), W - 10, 14, 14, CYAN, "right");
}

/* ───────────────────────── Stackfall ───────────────────────── */

/** District palette, not the usual falling-block colours. */
const PIECE_COLOR: Record<Stack.Kind, string> = {
  I: CRIMSON,
  O: HUD,
  T: CYAN,
  S: AMBER,
  Z: VIOLET,
  J: "#5fa8ff",
  L: "#ff6ec7",
};

function block(g: CanvasRenderingContext2D, x: number, y: number, c: string, size: number, alpha = 1) {
  g.globalAlpha = alpha;
  g.fillStyle = c;
  g.fillRect(x + 1, y + 1, size - 2, size - 2);
  g.fillStyle = "rgba(255,255,255,0.25)";
  g.fillRect(x + 1, y + 1, size - 2, 3);
  g.fillStyle = "rgba(0,0,0,0.3)";
  g.fillRect(x + 1, y + size - 4, size - 2, 3);
  g.globalAlpha = 1;
}

export function drawStackfall(g: CanvasRenderingContext2D, s: Stack.State) {
  const C = Stack.CELL;
  const w = Stack.COLS * C;
  const h = (Stack.ROWS - Stack.HIDDEN) * C;
  field(g, w, h, "#100d24");
  g.strokeStyle = "rgba(139,108,255,0.08)";
  for (let x = 0; x <= Stack.COLS; x++) {
    g.beginPath();
    g.moveTo(x * C + 0.5, 0);
    g.lineTo(x * C + 0.5, h);
    g.stroke();
  }
  for (let y = 0; y <= Stack.ROWS - Stack.HIDDEN; y++) {
    g.beginPath();
    g.moveTo(0, y * C + 0.5);
    g.lineTo(w, y * C + 0.5);
    g.stroke();
  }
  s.board.forEach((row, y) => {
    if (y < Stack.HIDDEN) return;
    row.forEach((k, x) => k && block(g, x * C, (y - Stack.HIDDEN) * C, PIECE_COLOR[k], C));
  });
  if (!s.dead) {
    const cells = Stack.cellsOf(s.piece.kind, s.piece.rot);
    const gy = Stack.ghostY(s);
    g.strokeStyle = PIECE_COLOR[s.piece.kind];
    g.globalAlpha = 0.5;
    for (const [cx, cy] of cells) {
      const y = gy + cy - Stack.HIDDEN;
      if (y >= 0) g.strokeRect((s.piece.x + cx) * C + 2.5, y * C + 2.5, C - 5, C - 5);
    }
    g.globalAlpha = 1;
    for (const [cx, cy] of cells) {
      const y = s.piece.y + cy - Stack.HIDDEN;
      if (y >= 0) block(g, (s.piece.x + cx) * C, y * C, PIECE_COLOR[s.piece.kind], C);
    }
  }
  if (s.flashT > 0) {
    g.fillStyle = `rgba(233,228,214,${s.flashT * 3})`;
    // Rows have already collapsed; flash the bottom band where they were.
    g.fillRect(0, h - s.flash.length * C, w, s.flash.length * C);
  }
  scanlines(g, w, h);
}

/** Small preview of a piece for the hold and next panels (drawn in DOM canvases). */
export function drawMini(g: CanvasRenderingContext2D, kind: Stack.Kind | null, size: number, dim = false) {
  g.clearRect(0, 0, size * 4, size * 2.5);
  if (!kind) return;
  const cells = Stack.cellsOf(kind, 0);
  const minX = Math.min(...cells.map((c) => c[0]));
  const maxX = Math.max(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  const ox = (4 - (maxX - minX + 1)) / 2 - minX;
  for (const [x, y] of cells) block(g, (x + ox) * size, (y - minY + 0.25) * size, PIECE_COLOR[kind], size, dim ? 0.4 : 1);
}

/* ───────────────────────── Signal Snake ───────────────────────── */

export function drawSnake(g: CanvasRenderingContext2D, s: Snake.State, t: number) {
  const C = Snake.CELL;
  const w = Snake.COLS * C;
  const h = Snake.ROWS * C;
  field(g, w, h, "#1b1308");
  g.fillStyle = "rgba(255,181,71,0.07)";
  for (let x = 0; x < Snake.COLS; x++) for (let y = 0; y < Snake.ROWS; y++) if ((x + y) % 2) g.fillRect(x * C, y * C, C, C);
  // Packet, pulsing.
  const pulse = 3 + Math.sin(t * 6) * 1.5;
  glowRect(g, s.food[0] * C + pulse, s.food[1] * C + pulse, C - pulse * 2, C - pulse * 2, CYAN, 12);
  // Trace: brighter at the head.
  s.body.forEach(([x, y], i) => {
    const k = 1 - i / (s.body.length + 4);
    g.save();
    g.globalAlpha = 0.35 + k * 0.65;
    g.shadowColor = AMBER;
    g.shadowBlur = i === 0 ? 14 : 4;
    g.fillStyle = i === 0 ? HUD : AMBER;
    g.fillRect(x * C + 2, y * C + 2, C - 4, C - 4);
    g.restore();
  });
  g.strokeStyle = "rgba(255,181,71,0.5)";
  g.strokeRect(0.5, 0.5, w - 1, h - 1);
  scanlines(g, w, h);
  text(g, String(s.score), w - 8, 14, 16, HUD, "right");
  if (!s.started && !s.dead) text(g, "Press an arrow key or swipe", w / 2, h * 0.7, 18, DIM);
}
