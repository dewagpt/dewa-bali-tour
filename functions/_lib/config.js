/* ============================================================
   Kredensial & konfigurasi admin
   ------------------------------------------------------------
   Nilai di bawah adalah DEFAULT (dipakai kalau env tidak diisi).
   Di Cloudflare, set secret berikut agar lebih aman:
     ADMIN_USER            → ganti username
     ADMIN_PASSWORD_HASH   → hasil `node scripts/hash-password.mjs`
     SESSION_SECRET        → string acak panjang (WAJIB di produksi)
   Cara membuat hash baru:
     node scripts/hash-password.mjs "kata-sandi-baru"
   ============================================================ */

export const DEFAULT_ADMIN_USER = "dewa-200280-bali";

/* PBKDF2-SHA256, 20.000 iterasi, salt acak — hash dari "dewa-200280-bali" */
export const DEFAULT_PASSWORD_HASH =
  "pbkdf2$20000$Er9QDR5g39CC3pfN3CFgkQ$Vi98HClODq-1h23m0OgUym376Z51IyI2awziDSwL9AM";

/* Hanya untuk pengembangan lokal (http://localhost). */
export const DEV_SESSION_SECRET = "dev-secret-dewa-bali-tour-jangan-dipakai-di-produksi";

export const SESSION_TTL = 60 * 60 * 12; // 12 jam
export const MAX_LOGIN_ATTEMPTS = 6;
export const LOGIN_WINDOW_MS = 10 * 60 * 1000;

export function credentials(env = {}) {
  return {
    user: env.ADMIN_USER || DEFAULT_ADMIN_USER,
    hash: env.ADMIN_PASSWORD_HASH || DEFAULT_PASSWORD_HASH,
  };
}

export function sessionSecret(env = {}, isLocal = false) {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  return isLocal ? DEV_SESSION_SECRET : null;
}