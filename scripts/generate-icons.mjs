// Renders the site icons from src/app/icon.svg. Run after changing the SVG:
//   node scripts/generate-icons.mjs
// Writes PNGs at multiples of 48px (Google's favicon rule), an Apple touch
// icon and a favicon.ico (one 48px PNG inside an ICO container).
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const app = new URL("../src/app/", import.meta.url);
const svg = await readFile(new URL("icon.svg", app));
const png = (size) => sharp(svg, { density: 1200 }).resize(size, size).png().toBuffer();

const sizes = { "icon1.png": 48, "icon2.png": 96, "icon3.png": 192, "apple-icon.png": 180 };
for (const [name, size] of Object.entries(sizes)) await writeFile(new URL(name, app), await png(size));

const ico48 = await png(48);
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // one image
header.writeUInt8(48, 6); // width
header.writeUInt8(48, 7); // height
header.writeUInt8(0, 8); // no palette
header.writeUInt8(0, 9); // reserved
header.writeUInt16LE(1, 10); // colour planes
header.writeUInt16LE(32, 12); // bits per pixel
header.writeUInt32LE(ico48.length, 14); // image size
header.writeUInt32LE(22, 18); // image offset
await writeFile(new URL("favicon.ico", app), Buffer.concat([header, ico48]));
console.log("icons written:", [...Object.keys(sizes), "favicon.ico"].join(", "));
