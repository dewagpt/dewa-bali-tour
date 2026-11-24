#!/usr/bin/env node
/* ============================================================
   MAKE ICONS — hasilkan ulang berkas ikon dari satu sumber:
   assets/img/favicon.svg

   Output (ditulis ke assets/img/):
     • apple-touch-icon.png  180×180  (full-bleed, tanpa sudut transparan)
     • favicon.ico           16+32 px (PNG di dalam container ICO)

   Hanya memakai modul bawaan Node + Chrome headless untuk rasterisasi.
   Jalankan: node scripts/make-icons.mjs
   ============================================================ */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IMG = path.join(ROOT, "assets", "img");
const TMP = path.join(ROOT, ".icon-tmp");

const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

function findChrome() {
  for (const p of CHROME_CANDIDATES) if (fs.existsSync(p)) return p;
  throw new Error("Chrome/Chromium tidak ditemukan — tidak bisa rasterisasi ikon.");
}

/* --- SVG sumber, disederhanakan agar bisa dipakai ulang di ukuran apa pun --- */
const GRAD_DEFS = `
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#37E0CE"/>
      <stop offset=".55" stop-color="#12A79A"/>
      <stop offset="1" stop-color="#0A6E6A"/>
    </linearGradient>
    <linearGradient id="h" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".55"/>
      <stop offset=".5" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>`;

const WAVE = `<path d="M12 42.4c7.36-10.24 14.24-10.24 20.8 0 6.4 10.08 13.12 10.08 19.2 0" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".95"/>`;
const SUN = `<circle cx="44" cy="20.16" r="5.6" fill="#FFE9A8"/>`;

/* full-bleed: dipakai untuk apple-touch-icon (iOS membulatkan sendiri) */
const svgFullBleed = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>${GRAD_DEFS}</defs>
  <rect width="64" height="64" fill="url(#g)"/>
  <rect width="64" height="64" fill="url(#h)"/>
  ${WAVE}
  ${SUN}
</svg>`;

/* sudut membulat: dipakai untuk favicon (tab browser) */
const svgRounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>${GRAD_DEFS}</defs>
  <rect width="64" height="64" rx="20" fill="url(#g)"/>
  <rect width="64" height="64" rx="20" fill="url(#h)"/>
  ${WAVE}
  ${SUN}
</svg>`;

function render(svg, size, outFile, transparent) {
  const html = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;${transparent ? "background:transparent" : "background:#0A6E6A"}}
svg{display:block;width:${size}px;height:${size}px}</style>
${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}`;
  const htmlFile = path.join(TMP, `icon-${size}.html`);
  fs.writeFileSync(htmlFile, html);
  execFileSync(findChrome(), [
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-sandbox",
    "--force-device-scale-factor=1",
    ...(transparent ? ["--default-background-color=00000000"] : []),
    `--window-size=${size},${size}`,
    `--screenshot=${outFile}`,
    `file://${htmlFile}`,
  ], { stdio: "ignore" });
  const bytes = fs.statSync(outFile).size;
  if (!bytes) throw new Error(`render ${size}px gagal (0 byte)`);
  console.log(`  ✓ ${path.basename(outFile)}  ${size}×${size}  ${bytes} B`);
}

/* --- container ICO (PNG di dalamnya; didukung semua browser modern) --- */
function buildIco(pngBuffers) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngBuffers.length, 4);

  const entries = [];
  let offset = 6 + pngBuffers.length * 16;
  for (const { size, data } of pngBuffers) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // width
    e.writeUInt8(size >= 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2); // palette
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bit depth
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += data.length;
  }
  return Buffer.concat([header, ...entries, ...pngBuffers.map((p) => p.data)]);
}

/* --- jalankan --- */
fs.mkdirSync(TMP, { recursive: true });
console.log("Rasterisasi ikon …");

const ati = path.join(TMP, "ati.png");
render(svgFullBleed, 180, ati, false);
fs.copyFileSync(ati, path.join(IMG, "apple-touch-icon.png"));

const png16 = path.join(TMP, "f16.png");
const png32 = path.join(TMP, "f32.png");
render(svgRounded, 16, png16, true);
render(svgRounded, 32, png32, true);

const ico = buildIco([
  { size: 16, data: fs.readFileSync(png16) },
  { size: 32, data: fs.readFileSync(png32) },
]);
fs.writeFileSync(path.join(IMG, "favicon.ico"), ico);
console.log(`  ✓ favicon.ico  16+32 px  ${ico.length} B`);

fs.rmSync(TMP, { recursive: true, force: true });
console.log("Selesai.");
