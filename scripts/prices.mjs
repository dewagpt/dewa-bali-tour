#!/usr/bin/env node
/**
 * Lihat & ubah harga tour / kendaraan dari satu tempat.
 *
 *   node scripts/prices.mjs                     # tampilkan harga sekarang
 *   node scripts/prices.mjs ubud=700000         # ubah harga 2 pax
 *   node scripts/prices.mjs ubud=700000+1000000 # ubah 2 pax + 1 pax sekaligus
 *   node scripts/prices.mjs avanza=500000       # ubah harga sewa / hari
 *   node scripts/prices.mjs --push              # kirim ke database produksi
 *
 * Yang diubah: content/content.mjs (sumber tunggal). Setelah itu jalankan
 * `node build.mjs` lalu deploy. Flag --push juga menulis ke D1 supaya
 * angka di panel admin & database tidak ketinggalan.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "content", "content.mjs");

const fmt = (n) => "Rp " + Number(n).toLocaleString("id-ID");
const args = process.argv.slice(2);
const push = args.includes("--push");
const pairs = args.filter((a) => !a.startsWith("--"));

/* ---------- baca struktur: cari blok tiap item ---------- */
function itemBlock(src, id, from = 0) {
  const start = src.indexOf(`id: "${id}"`, from);
  if (start < 0) return null;
  // blok berakhir di "\n  }," (penutup objek item di array top-level)
  const end = src.indexOf("\n  },", start);
  return { start, end: end < 0 ? src.length : end };
}

const src0 = fs.readFileSync(FILE, "utf8");

const toursSec = src0.slice(src0.indexOf("export const tours"), src0.indexOf("export const rentals"));
const rentSec = src0.slice(src0.indexOf("export const rentals"));
const tourIds = [...toursSec.matchAll(/id: "([a-z]+)", soloPrice:/g)].map((m) => m[1]);
const rentIds = [...rentSec.matchAll(/id: "([a-z0-9]+)", type: "([a-z]+)"/g)].map((m) => m[1]);

function readPrice(sec, id) {
  const b = itemBlock(sec, id);
  if (!b) return null;
  const block = sec.slice(b.start, b.end);
  return {
    price: Number(block.match(/\bprice: (\d+)/)?.[1] || 0),
    solo: Number(block.match(/soloPrice: (\d+)/)?.[1] || 0),
    driver: Number(block.match(/driverFee: (\d+)/)?.[1] || 0),
  };
}

/* ---------- mode tampil ---------- */
if (!pairs.length) {
  console.log("\nTOUR — harga per 2 orang (solo = 1 orang)");
  for (const id of tourIds) {
    const p = readPrice(toursSec, id);
    console.log(`  ${id.padEnd(9)} ${fmt(p.price).padStart(14)}   solo ${fmt(p.solo).padStart(14)}`);
  }
  console.log("\nKENDARAAN — sewa / hari (driver = biaya tambahan supir)");
  for (const id of rentIds) {
    const p = readPrice(rentSec, id);
    console.log(`  ${id.padEnd(9)} ${fmt(p.price).padStart(14)}   driver ${fmt(p.driver).padStart(12)}`);
  }
  console.log("\nUbah: node scripts/prices.mjs ubud=700000+1050000   (2 pax + 1 pax)");
  console.log("      node scripts/prices.mjs avanza=500000          (sewa per hari)");
  console.log("      tambahkan --push untuk sekalian menulis ke database produksi\n");
  process.exit(0);
}

/* ---------- mode ubah ---------- */
let src = src0;
const changes = [];

for (const pair of pairs) {
  const [id, spec] = pair.split("=");
  if (!id || !spec) {
    console.error(`✗ Format salah: "${pair}" — pakai id=harga atau id=harga2pax+harga1pax`);
    process.exit(1);
  }
  const nums = spec.split("+").map((n) => Number(n.replace(/[^0-9]/g, "")));
  if (nums.some((n) => !Number.isFinite(n) || n <= 0)) {
    console.error(`✗ Harga tidak valid: "${spec}"`);
    process.exit(1);
  }

  const isTour = tourIds.includes(id);
  const isRent = rentIds.includes(id);
  if (!isTour && !isRent) {
    console.error(`✗ Id tidak dikenal: "${id}". Pilihan: ${[...tourIds, ...rentIds].join(", ")}`);
    process.exit(1);
  }

  const secStart = isTour ? src.indexOf("export const tours") : src.indexOf("export const rentals");
  const secEnd = isTour ? src.indexOf("export const rentals") : src.length;
  const sec = src.slice(secStart, secEnd);
  const b = itemBlock(sec, id);
  let block = sec.slice(b.start, b.end);
  const before = readPrice(sec, id);

  block = block.replace(/\bprice: \d+/, `price: ${nums[0]}`);
  if (isTour && nums[1]) block = block.replace(/soloPrice: \d+/, `soloPrice: ${nums[1]}`);
  if (isRent && nums[1]) block = block.replace(/driverFee: \d+/, `driverFee: ${nums[1]}`);

  src = src.slice(0, secStart) + sec.slice(0, b.start) + block + sec.slice(b.end) + src.slice(secEnd);
  changes.push({ id, before, after: readPrice(block, id) });
}

fs.writeFileSync(FILE, src);

console.log("\n✓ content/content.mjs diperbarui:");
for (const c of changes) {
  const parts = [`${fmt(c.before.price)} → ${fmt(c.after.price)}`];
  if (c.before.solo || c.after.solo) parts.push(`solo ${fmt(c.before.solo)} → ${fmt(c.after.solo)}`);
  if (c.after.driver || c.before.driver) parts.push(`driver ${fmt(c.before.driver)} → ${fmt(c.after.driver)}`);
  console.log(`  ${c.id.padEnd(9)} ${parts.join("  ·  ")}`);
}
console.log("\nLangkah berikutnya:");
console.log("  node build.mjs        # bangun ulang dist/");
console.log("  node scripts/prices.mjs --push   # samakan database produksi (opsional)\n");

/* ---------- dorong ke D1 ---------- */
if (push) {
  const w = fs.readFileSync(path.join(ROOT, "wrangler.toml"), "utf8");
  const dbName = w.match(/database_name\s*=\s*"([^"]*)"/)?.[1] || "dewabalitour";
  let expr = "json";
  const where = [];
  for (const c of changes) {
    const isTour = tourIds.includes(c.id);
    const key = isTour ? "tours" : "rentals";
    const idx = (isTour ? tourIds : rentIds).indexOf(c.id);
    where.push(`json_extract(json, '$.${key}[${idx}].id') = '${c.id}'`);
    expr = `json_set(${expr}, '$.${key}[${idx}].price', ${c.after.price})`;
    if (isTour) expr = `json_set(${expr}, '$.${key}[${idx}].soloPrice', ${c.after.solo})`;
    else if (c.after.driver) expr = `json_set(${expr}, '$.${key}[${idx}].driverFee', ${c.after.driver})`;
  }
  const sql = `UPDATE site_data SET json = (${expr}) WHERE ${where.join(" OR ")}`;
  try {
    console.log("→ menulis ke database produksi…");
    const out = execFileSync(
      "npx",
      ["wrangler", "d1", "execute", dbName, "--remote", "--yes", "--command", sql],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
    console.log(out.split("\n").filter((l) => /changes|executed|rows/i.test(l)).join("\n") || "✓ selesai");
  } catch (e) {
    console.error("✗ Gagal menulis ke database:", (e.stderr || e.stdout || e.message).toString().trim());
    console.error("  Harga di content.mjs TETAP sudah berubah — cukup deploy, lalu samakan lewat panel admin.");
    process.exit(1);
  }
}
