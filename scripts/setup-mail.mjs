#!/usr/bin/env node
/* Nyalakan fitur "Lupa kata sandi" (reset lewat email) memakai Resend.

   Pakai:
     node scripts/setup-mail.mjs

   Skrip ini:
     1. meminta API key Resend (input disembunyikan, tidak masuk riwayat shell)
     2. memeriksa key + status verifikasi domain di Resend
     3. menyimpan RESEND_API_KEY, ADMIN_EMAIL, MAIL_FROM ke Pages (Production)
     4. build ulang + deploy
     5. menguji endpoint /api/admin/forgot

   Hanya memakai modul bawaan Node (node:*). Tanpa dependensi.
*/

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const PROJECT = "dewabalitour";
const SITE = "https://dewabalitour.com";
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const RESEND = "https://api.resend.com";

const c = {
  b: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  y: (s) => `\x1b[33m${s}\x1b[0m`,
  r: (s) => `\x1b[31m${s}\x1b[0m`,
  c: (s) => `\x1b[36m${s}\x1b[0m`,
};

const ok = (m) => console.log(`  ${c.g("✓")} ${m}`);
const warn = (m) => console.log(`  ${c.y("!")} ${m}`);
const bad = (m) => console.log(`  ${c.r("✗")} ${m}`);
const step = (n, m) => console.log(`\n${c.b(`${n}. ${m}`)}`);

/* ---------- input ---------- */

function askVisible(question, fallback = "") {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (a) => {
      rl.close();
      resolve(String(a).trim() || fallback);
    });
  });
}

function askHidden(question) {
  // Di terminal sungguhan: sembunyikan ketikan. Di pipe: baca baris biasa.
  if (!process.stdin.isTTY) {
    return new Promise((resolve) => {
      const rl = createInterface({ input: process.stdin });
      rl.once("line", (l) => {
        rl.close();
        resolve(String(l).trim());
      });
    });
  }
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.resume();
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    let buf = "";
    const done = (value) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      process.stdout.write("\n");
      resolve(value);
    };
    const onData = (ch) => {
      if (ch === "\u0003") {
        process.stdout.write("\n");
        process.exit(130);
      }
      if (ch === "\r" || ch === "\n" || ch === "\u0004") return done(buf.trim());
      if (ch === "\u007f" || ch === "\b") {
        buf = buf.slice(0, -1);
        return;
      }
      buf += ch;
    };
    stdin.on("data", onData);
  });
}

/* ---------- Resend ---------- */

async function resendGet(key, path) {
  const res = await fetch(`${RESEND}${path}`, {
    headers: { authorization: `Bearer ${key}` },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function checkKey(key) {
  const { status, body } = await resendGet(key, "/domains");
  const msg = JSON.stringify(body || {});
  const invalidKey =
    /invalid|unauthor|not valid|api key/i.test(msg) ||
    status === 401 ||
    status === 403;
  if (invalidKey) {
    bad("API key ditolak Resend.");
    console.log(c.dim(`     ${msg.slice(0, 200)}`));
    console.log(c.dim("     Pastikan key bertipe Full access (bukan hanya inbound), dan belum dihapus."));
    return null;
  }
  if (status !== 200) {
    bad(`Resend membalas ${status}.`);
    console.log(c.dim(`     ${msg.slice(0, 200)}`));
    return null;
  }
  ok("API key valid.");
  return Array.isArray(body.data) ? body.data : [];
}

function showDomains(domains) {
  if (!domains.length) {
    warn("Belum ada domain di akun Resend.");
    return null;
  }
  console.log(c.dim("     Domain di akun Resend:"));
  for (const d of domains) {
    const good = d.status === "verified";
    console.log(
      `     ${good ? c.g("✓") : c.y("•")} ${String(d.name).padEnd(28)} ${d.status}`
    );
  }
  return domains.find((d) => d.status === "verified") || null;
}

/* ---------- wrangler ---------- */

function run(args, { input, quiet = false } = {}) {
  const r = spawnSync("npx", ["wrangler", ...args], {
    cwd: ROOT,
    input,
    encoding: "utf8",
    stdio: quiet ? ["pipe", "pipe", "pipe"] : ["pipe", "inherit", "inherit"],
  });
  return { code: r.status ?? 1, out: `${r.stdout || ""}${r.stderr || ""}` };
}

function putSecret(name, value) {
  const r = run(["pages", "secret", "put", name, "--project-name", PROJECT], {
    input: `${value}\n`,
  });
  if (r.code === 0) ok(`${name} tersimpan di Production.`);
  else {
    bad(`${name} gagal disimpan.`);
    console.log(c.dim(`     ${r.out.trim().split("\n").slice(-4).join("\n     ")}`));
  }
  return r.code === 0;
}

/* ---------- main ---------- */

async function main() {
  console.log(c.b("\nSetup reset kata sandi lewat email (Resend)"));
  console.log(c.dim("Key hanya dikirim ke Cloudflare sebagai secret; tidak ditulis ke file repo.\n"));

  if (!existsSync(`${ROOT}wrangler.toml`)) {
    bad("Jalankan dari folder project (wrangler.toml tidak ditemukan).");
    process.exit(1);
  }

  step(1, "API key Resend");
  console.log(c.dim("   Ambil di https://resend.com/api-keys (biasanya mulai dengan re_)"));
  const key = await askHidden("   Tempel API key (tidak akan terlihat): ");
  if (!key) {
    bad("API key kosong. Dibatalkan.");
    process.exit(1);
  }
  if (!/^re_[A-Za-z0-9_-]{8,}$/.test(key)) {
    warn("Format key tidak seperti biasanya (re_...). Tetap dicoba.");
  }

  step(2, "Periksa key & domain");
  const domains = await checkKey(key);
  if (!domains) process.exit(1);
  const verified = showDomains(domains);

  let fromDomain = "dewabalitour.com";
  if (!verified) {
    warn("Belum ada domain terverifikasi di Resend.");
    console.log(c.dim("   Resend hanya bisa mengirim dari domain yang sudah diverifikasi."));
    console.log(c.dim("   Tanpa itu, pengiriman akan gagal (403)."));
    const lanjut = await askVisible("   Lanjut tetap set secret? (y/N) ", "n");
    if (!/^y/i.test(lanjut)) {
      console.log(c.dim("\n   Buka https://resend.com/domains → Add Domain → dewabalitour.com,"));
      console.log(c.dim("   lalu tambahkan record DNS yang diberikan, kemudian jalankan skrip ini lagi."));
      process.exit(0);
    }
  } else {
    fromDomain = verified.name;
    ok(`Domain siap dipakai: ${fromDomain}`);
  }

  step(3, "Alamat tujuan & pengirim");
  const to = await askVisible(
    "   Email penerima tautan reset [admin@dewabalitour.com]: ",
    "admin@dewabalitour.com"
  );
  const from = await askVisible(
    `   Alamat pengirim [no-reply@${fromDomain}]: `,
    `no-reply@${fromDomain}`
  );
  const mailFrom = `Dewa Bali Tour <${from}>`;

  console.log(c.dim(`\n   RESEND_API_KEY : ${key.slice(0, 6)}…${key.slice(-4)} (disembunyikan)`));
  console.log(c.dim(`   ADMIN_EMAIL    : ${to}`));
  console.log(c.dim(`   MAIL_FROM      : ${mailFrom}`));
  const go = await askVisible("\n   Simpan ke Cloudflare sekarang? (Y/n) ", "y");
  if (!/^y/i.test(go)) {
    console.log(c.dim("   Dibatalkan."));
    process.exit(0);
  }

  step(4, "Simpan secret");
  const a = putSecret("RESEND_API_KEY", key);
  const b = putSecret("ADMIN_EMAIL", to);
  const d = putSecret("MAIL_FROM", mailFrom);
  if (!(a && b && d)) {
    bad("Ada secret yang gagal. Perbaiki lalu ulangi.");
    process.exit(1);
  }

  step(5, "Build & deploy");
  const dirty = spawnSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" });
  const dirtyFiles = String(dirty.stdout || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (dirtyFiles.length) {
    warn(`Ada ${dirtyFiles.length} perubahan belum di-commit (ikut ter-deploy):`);
    for (const f of dirtyFiles.slice(0, 8)) console.log(c.dim(`     ${f}`));
    if (dirtyFiles.length > 8) console.log(c.dim(`     …dan ${dirtyFiles.length - 8} lainnya`));
    console.log(c.dim("   Deploy membawa isi working tree apa adanya — termasuk file yang belum di-commit."));
    const lanjutDeploy = await askVisible("   Lanjut deploy seperti ini? (Y/n) ", "y");
    if (!/^y/i.test(lanjutDeploy)) {
      console.log(c.dim("\n   Secret sudah tersimpan, tapi deploy dibatalkan."));
      console.log(c.dim("   Commit dulu, lalu jalankan:"));
      console.log(c.dim("     node build.mjs && npx wrangler pages deploy dist --project-name dewabalitour"));
      process.exit(0);
    }
  }
  const build = spawnSync("node", ["build.mjs"], { cwd: ROOT, stdio: "inherit" });
  if (build.status !== 0) {
    bad("Build gagal.");
    process.exit(1);
  }
  const dep = run([
    "pages",
    "deploy",
    "dist",
    "--project-name",
    PROJECT,
    "--branch",
    "main",
    "--commit-dirty=true",
  ]);
  if (dep.code !== 0) {
    bad("Deploy gagal.");
    console.log(c.dim(`     ${dep.out.trim().split("\n").slice(-6).join("\n     ")}`));
    process.exit(1);
  }
  const url = (dep.out.match(/https:\/\/[a-z0-9]+\.dewabalitour\.pages\.dev/i) || [])[0];
  ok(`Deploy selesai${url ? `: ${url}` : ""}`);

  step(6, "Uji endpoint live");
  console.log(c.dim("   Menunggu propagasi…"));
  let live = null;
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await fetch(`${SITE}/api/admin/forgot`, {
      method: "POST",
      headers: {
        origin: SITE,
        "content-type": "application/json",
        "x-requested-with": "fetch",
      },
      body: JSON.stringify({ username: "dewa-200280-bali" }),
    }).catch(() => null);
    if (!res) continue;
    const body = await res.json().catch(() => ({}));
    if (res.status === 501) {
      warn("Masih 501 — secret belum terbaca (deploy mungkin belum aktif).");
      continue;
    }
    live = { status: res.status, body };
    break;
  }

  if (!live) {
    warn("Endpoint belum merespons seperti yang diharapkan. Cek lagi beberapa menit lagi.");
  } else if (live.status === 200) {
    ok("Endpoint aktif (200).");
    console.log(c.g(`\n   Email reset sudah dikirim ke ${to}.`));
    console.log(c.dim("   Buka kotak masuk, klik tombol 'Buat kata sandi baru' (berlaku 30 menit)."));
  } else if (live.status === 502) {
    bad("Endpoint aktif tapi Resend menolak pengiriman (502).");
    console.log(c.dim(`     ${JSON.stringify(live.body).slice(0, 300)}`));
    console.log(c.dim("     Biasanya karena domain pengirim belum terverifikasi di Resend."));
  } else {
    warn(`Endpoint membalas ${live.status}.`);
    console.log(c.dim(`     ${JSON.stringify(live.body).slice(0, 300)}`));
  }

  console.log(c.b("\nSelesai."));
  console.log(c.dim("Tombol 'Lupa kata sandi?' di halaman admin sekarang berfungsi.\n"));
}

main().catch((e) => {
  bad(e.message);
  process.exit(1);
});
