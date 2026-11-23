import * as THREE from "three";
import { AVENUE_HALF, MAP_HALF, RING_R0, RING_R1, fillZones } from "@/lib/world-map";

/** Read the self-hosted font family next/font generated, so canvas text matches the UI. */
function fontFamily(variable: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return v ? `${v}, ${fallback}` : fallback;
}

const cache = new Map<string, THREE.Texture>();

function remember(key: string, make: () => THREE.Texture) {
  const hit = cache.get(key);
  if (hit) return hit;
  const t = make();
  cache.set(key, t);
  return t;
}

/** A small heart for petted cats. */
export function heartTexture() {
  return remember("heart", () => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    g.fillStyle = "#ff5a7a";
    g.beginPath();
    g.moveTo(32, 54);
    g.bezierCurveTo(6, 36, 6, 14, 20, 12);
    g.bezierCurveTo(27, 11, 31, 16, 32, 20);
    g.bezierCurveTo(33, 16, 37, 11, 44, 12);
    g.bezierCurveTo(58, 14, 58, 36, 32, 54);
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

/** Soft radial glow used as a cheap stand-in for bloom. */
export function glowTexture() {
  return remember("glow", () => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.25, "rgba(255,255,255,0.45)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

/** A neon sign face. Vertical signs stack characters top to bottom. */
export function signTexture(text: string, color: string, vertical: boolean) {
  return remember(`sign:${text}:${color}:${vertical}`, () => {
    const chars = [...text];
    const w = vertical ? 128 : Math.max(256, chars.length * 70);
    const h = vertical ? Math.max(256, chars.length * 120) : 128;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d")!;
    g.fillStyle = "rgba(8,6,18,0.92)";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = color;
    g.lineWidth = 4;
    g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = color;
    g.shadowColor = color;
    g.shadowBlur = 18;
    g.textAlign = "center";
    g.textBaseline = "middle";
    const family = fontFamily("--font-zen", '"Hiragino Sans", "Noto Sans JP", sans-serif');
    if (vertical) {
      g.font = `700 86px ${family}`;
      const step = (h - 40) / chars.length;
      chars.forEach((ch, i) => g.fillText(ch, w / 2, 20 + step * (i + 0.5)));
    } else {
      const display = fontFamily("--font-saira", "sans-serif");
      g.font = `800 78px ${/[　-鿿]/.test(text) ? family : display}`;
      g.fillText(text, w / 2, h / 2 + 4);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  });
}

/** Kiosk screen: lines of terminal text that the shader scrolls. */
export function screenTexture() {
  return remember("screen", () => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 512;
    const g = c.getContext("2d")!;
    g.fillStyle = "#03141a";
    g.fillRect(0, 0, 256, 512);
    g.font = `500 15px ${fontFamily("--font-jet", "monospace")}`;
    g.fillStyle = "#3ee8e0";
    const lines = [
      "$ help", "about  skills", "projects  contact", "$ whoami", "visitor@v9",
      "$ ls quests/", "peerfact  voyra", "capsulehub", "$ ping huzaifa", "64 bytes ok",
      "$ cat motd", "walk up and", "press E", "$ uptime", "night, always",
    ];
    lines.forEach((l, i) => g.fillText(l, 14, 28 + i * 32));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapT = THREE.RepeatWrapping;
    return t;
  });
}

/** Small ecru slips for the notice board, each with a few ruled "lines". */
export function slipTexture() {
  return remember("slip", () => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 80;
    const g = c.getContext("2d")!;
    g.fillStyle = "#dcd5c3";
    g.fillRect(0, 0, 64, 80);
    g.fillStyle = "#a3101f";
    g.fillRect(8, 8, 26, 8);
    g.fillStyle = "rgba(26,25,21,0.55)";
    for (let i = 0; i < 5; i++) g.fillRect(8, 26 + i * 9, 48 - (i % 2) * 14, 3);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

/**
 * The walkable map as a texture for the ground shader: red = paving,
 * blue = road markings. Drawn from the same zones the collision uses.
 */
export function mapTexture() {
  return remember("map", () => {
    const N = 1024;
    const c = document.createElement("canvas");
    c.width = c.height = N;
    const g = c.getContext("2d")!;
    g.fillStyle = "#000";
    g.fillRect(0, 0, N, N);
    g.save();
    g.scale(N / (MAP_HALF * 2), N / (MAP_HALF * 2));
    g.translate(MAP_HALF, MAP_HALF);
    g.fillStyle = "#f00";
    fillZones(g);
    // Dashed centre lines down the avenues and round the ring.
    g.globalCompositeOperation = "lighter";
    g.strokeStyle = "#00f";
    g.lineWidth = 0.14;
    g.setLineDash([2, 2]);
    g.beginPath();
    g.moveTo(17, 0);
    g.lineTo(56, 0);
    g.moveTo(-17, 0);
    g.lineTo(-53, 0);
    g.moveTo(0, 17);
    g.lineTo(0, 50);
    g.moveTo(0, -17);
    g.lineTo(0, -52);
    g.stroke();
    g.beginPath();
    g.arc(0, 0, (RING_R0 + RING_R1) / 2, 0, Math.PI * 2);
    g.stroke();
    // Kerb lines either side of each avenue.
    g.setLineDash([]);
    g.lineWidth = 0.08;
    for (const off of [-AVENUE_HALF + 0.6, AVENUE_HALF - 0.6]) {
      g.beginPath();
      g.moveTo(17, off);
      g.lineTo(56, off);
      g.moveTo(-17, off);
      g.lineTo(-53, off);
      g.moveTo(off, 17);
      g.lineTo(off, 50);
      g.moveTo(off, -17);
      g.lineTo(off, -52);
      g.stroke();
    }
    g.restore();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.NoColorSpace;
    // Canvas row 0 is world z = -MAP_HALF, which is uv.y = 0 in the shader.
    t.flipY = false;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.anisotropy = 8;
    return t;
  });
}

/** Screen for an arcade cabinet: the game's glyph and title. */
export function cabinetTexture(title: string, glyph: string, color: string) {
  return remember(`cab:${title}`, () => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 200;
    const g = c.getContext("2d")!;
    g.fillStyle = "#05060f";
    g.fillRect(0, 0, 256, 200);
    g.strokeStyle = color;
    g.globalAlpha = 0.18;
    for (let y = 0; y < 200; y += 4) g.fillRect(0, y, 256, 1);
    g.globalAlpha = 1;
    g.fillStyle = color;
    g.shadowColor = color;
    g.shadowBlur = 16;
    g.textAlign = "center";
    g.font = `700 92px ${fontFamily("--font-zen", '"Hiragino Sans", sans-serif')}`;
    g.fillText(glyph, 128, 100);
    g.font = `800 34px ${fontFamily("--font-saira", "sans-serif")}`;
    g.fillText(title.toUpperCase(), 128, 168);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

export function disposeTextures() {
  cache.forEach((t) => t.dispose());
  cache.clear();
}
