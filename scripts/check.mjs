#!/usr/bin/env node
/* Pemeriksaan cepat sebelum deploy:
   - semua bahasa punya kunci teks yang sama
   - tidak ada placeholder [[...]] di hasil build
   - setiap tour punya terjemahan di 6 bahasa                        */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { langs, tours, rentals, copy, defaultLang } from "../content/content.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
let errors = 0;

const allKeys = new Set();
for (const l of langs) for (const k of Object.keys(copy[l.code] || {})) allKeys.add(k);

for (const l of langs) {
  for (const k of allKeys) {
    if (!copy[l.code]?.[k]) {
      console.error(`✗ ${l.code}: teks "${k}" belum ada`);
      errors++;
    }
  }
}

for (const t of tours) {
  for (const l of langs) {
    const c = t.t[l.code];
    if (!c?.name || !c?.tagline || c?.includes?.length !== 3) {
      console.error(`✗ tour "${t.id}" belum lengkap untuk bahasa "${l.code}"`);
      errors++;
    }
  }
}

for (const r of rentals) {
  for (const l of langs) {
    const c = r.t[l.code];
    if (!c?.name || !c?.tagline || c?.includes?.length !== 3) {
      console.error(`✗ rental "${r.id}" belum lengkap untuk bahasa "${l.code}"`);
      errors++;
    }
  }
}

const dist = path.join(ROOT, "..", "dist");
if (fs.existsSync(dist)) {
  for (const f of fs.readdirSync(dist, { recursive: true })) {
    if (!String(f).endsWith(".html")) continue;
    const html = fs.readFileSync(path.join(dist, String(f)), "utf8");
    if (html.includes("[[")) {
      console.error(`✗ ${f}: masih ada placeholder [[...]]`);
      errors++;
    }
  }
  for (const l of langs) {
    if (!fs.existsSync(path.join(dist, l.code, "index.html"))) {
      console.error(`✗ halaman /${l.code}/ belum dibangun — jalankan "node build.mjs"`);
      errors++;
    }
  }
}

if (errors) {
  console.error(`\n${errors} masalah ditemukan.`);
  process.exit(1);
}
console.log(
  `✓ semua teks lengkap (${allKeys.size} kunci × ${langs.length} bahasa, ${tours.length} paket, ${rentals.length} kendaraan)`
);