#!/usr/bin/env node
/**
 * Pemeriksaan kesiapan deploy — jalankan sebelum `npx wrangler pages deploy dist`.
 *
 *   node scripts/predeploy.mjs
 *
 * Skrip ini TIDAK mengubah apa pun. Ia hanya memberi tahu hal yang masih
 * perlu diisi/diperbaiki supaya situs tidak naik ke produksi dalam keadaan
 * setengah jadi (mis. database_id masih placeholder, foto belum ada).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const checks = [];
const add = (level, title, detail, fix) => checks.push({ level, title, detail, fix });

/* ---------- 1. wrangler.toml ---------- */
const wranglerPath = path.join(ROOT, "wrangler.toml");
if (!fs.existsSync(wranglerPath)) {
  add("error", "wrangler.toml tidak ditemukan", "Konfigurasi Cloudflare hilang.", "Buat wrangler.toml (lihat README §7).");
} else {
  const w = fs.readFileSync(wranglerPath, "utf8");
  const m = w.match(/database_id\s*=\s*"([^"]*)"/);
  const id = m ? m[1] : "";
  if (!id || /^GANTI/i.test(id)) {
    add(
      "error",
      "database_id D1 masih placeholder",
      `Nilai sekarang: "${id || "(kosong)"}". Situs akan error 500 saat menyimpan data.`,
      "npx wrangler d1 list → salin database_id ke wrangler.toml"
    );
  } else {
    add("ok", "database_id D1 terisi", id.slice(0, 12) + "…");
  }
  if (!/bucket_name\s*=/.test(w)) {
    add("warn", "R2 bucket belum dikonfigurasi", "Unggah foto dari admin tidak akan bekerja.", "Tambahkan [[r2_buckets]] di wrangler.toml.");
  }
}

/* ---------- 2. token analytics ---------- */
try {
  const content = fs.readFileSync(path.join(ROOT, "content/content.mjs"), "utf8");
  const t = content.match(/cfBeaconToken:\s*"([^"]*)"/)?.[1] || "";
  if (!t || /^GANTI/i.test(t)) {
    add("warn", "Token Cloudflare Web Analytics kosong", "Statistik kunjungan tidak tercatat.", "Isi site.cfBeaconToken di content/content.mjs.");
  } else {
    add("ok", "Token analytics terisi");
  }
} catch {
  add("warn", "content/content.mjs tidak terbaca", "Tidak bisa memeriksa token analytics.");
}

/* ---------- 3. foto ---------- */
const imgDir = path.join(ROOT, "assets/img");
let siteCfg = null;
try {
  siteCfg = fs.readFileSync(path.join(ROOT, "content/content.mjs"), "utf8");
} catch {}

for (const [key, file, what] of [
  ["heroPhoto", "hero.jpg", "foto hero halaman tour"],
  ["rentalHeroPhoto", "rental-hero.jpg", "foto hero halaman rental"],
]) {
  const set = siteCfg ? (siteCfg.match(new RegExp(`${key}:\\s*"([^"]*)"`))?.[1] || "") : "";
  const onDisk = fs.existsSync(path.join(imgDir, file));
  if (!set && !onDisk) {
    add("info", `${what} memakai ilustrasi bawaan`, "Tampilan tetap rapi — bukan error.", `Unggah lewat panel admin → Pengaturan → Foto hero.`);
  } else if (set && !set.startsWith("http") && !set.startsWith("/api/") && !onDisk) {
    add("warn", `${key} menunjuk file yang belum ada`, `Nilai: "${set}".`, `Simpan file ke assets/img/${file}, atau kosongkan kolomnya di admin.`);
  } else {
    add("ok", `${what} sudah diatur`);
  }
}
for (const [dir, label] of [["tours", "tour"], ["rental", "kendaraan"]]) {
  const d = path.join(imgDir, dir);
  const count = fs.existsSync(d) ? fs.readdirSync(d).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).length : 0;
  if (count === 0) {
    add("warn", `Folder assets/img/${dir} kosong`, `Foto ${label} memakai ilustrasi SVG.`, "Unggah foto per item di panel admin.");
  } else {
    add("ok", `Foto ${label}: ${count} file`);
  }
}

/* ---------- 4. hasil build ---------- */
const dist = path.join(ROOT, "dist");
if (!fs.existsSync(dist)) {
  add("error", "dist/ belum ada", "Belum ada hasil build untuk di-deploy.", "node build.mjs");
} else {
  const need = ["index.html", "id", "en", "_headers", "assets/js/app.js"];
  const missing = need.filter((f) => !fs.existsSync(path.join(dist, f)));
  if (missing.length) add("error", "Hasil build tidak lengkap", `Hilang: ${missing.join(", ")}`, "node build.mjs");
  else add("ok", "dist/ lengkap dan siap deploy");
}

/* ---------- 5. secret produksi ---------- */
add(
  "info",
  "Secret produksi diisi di dashboard Cloudflare",
  "SESSION_SECRET (wajib), ADMIN_EMAIL, RESEND_API_KEY, MAIL_FROM",
  "Settings → Environment variables → tambahkan sebagai Secret"
);
add(
  "info",
  "Ganti kata sandi admin bawaan",
  "Saat ini memakai kredensial awal. Siapa pun yang tahu akan bisa masuk.",
  "Panel admin → Keamanan → ganti nama pengguna & kata sandi"
);

/* ---------- laporan ---------- */
const icon = { error: "✗", warn: "!", ok: "✓", info: "i" };
let errors = 0;
let warns = 0;
for (const c of checks) {
  if (c.level === "error") errors++;
  if (c.level === "warn") warns++;
}
console.log("\nPemeriksaan kesiapan deploy\n" + "=".repeat(46));
for (const c of checks) {
  console.log(`${icon[c.level]} ${c.title}`);
  if (c.detail) console.log(`    ${c.detail}`);
  if (c.fix && c.level !== "ok") console.log(`    → ${c.fix}`);
}
console.log("=".repeat(46));
if (errors) {
  console.log(`${errors} masalah wajib diperbaiki${warns ? `, ${warns} peringatan` : ""}. Belum aman untuk deploy.`);
  process.exit(1);
}
console.log(warns ? `Siap deploy — ${warns} peringatan (tidak menghalangi).` : "Siap deploy — semua pemeriksaan lolos.");
