#!/usr/bin/env node
/* Buat hash kata sandi admin baru.
   Pakai: node scripts/hash-password.mjs "kata-sandi-baru"
   Tempel hasilnya ke Cloudflare → Settings → Environment variables → ADMIN_PASSWORD_HASH */

import { hashPassword } from "../functions/_lib/crypto.js";

const password = process.argv[2];

if (!password || password.length < 8) {
  console.error("Kata sandi minimal 8 karakter.\nContoh: node scripts/hash-password.mjs \"sandi-panjang-anda\"");
  process.exit(1);
}

const hash = await hashPassword(password, 20000);
console.log("\nADMIN_PASSWORD_HASH:\n" + hash + "\n");
console.log("Simpan sebagai secret di Cloudflare (jangan commit ke repo publik).");