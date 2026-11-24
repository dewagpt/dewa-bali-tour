/* ============================================================
   API admin & data publik — satu handler untuk Pages Functions
   dan untuk dev server lokal (lihat scripts/dev-server.mjs).
   ============================================================ */

import { copy, durationForms, langs, site } from "./content.js";
import { DEFAULT_ADMIN_USER, DEFAULT_PASSWORD_HASH, sessionSecret } from "./config.js";
import { hashPassword, timingSafeStrings, verifyPassword } from "./crypto.js";
import { mailConfigured, resetEmailHtml, sendMail } from "./mail.js";
import {
  clearSessionCookie,
  clientIp,
  forgotBlocked,
  noteForgot,
  createSession,
  isLocalRequest,
  loginBlocked,
  noteLoginFailure,
  readSession,
  resetLoginFailures,
  sessionCookie,
} from "./auth.js";
import { D1Store, ensureData, saveData } from "./store.js";
import { EXT_BY_TYPE, MEDIA_KEY_RE, R2Media } from "./media.js";
import { revOfAsync } from "./util.js";
import { TRANSLATE_SHAPES, TRANSLATE_TARGETS, translateAll } from "./translate.js";

const ART = ["terrace", "island", "volcano", "temple", "river", "gate", "car", "bike"];
const TOUR_CATS = ["culture", "adventure", "island"];
const RENT_TYPES = ["car", "bike"];
const MAX_BODY = 96 * 1024;
const MAX_UPLOAD = 4 * 1024 * 1024;
const RESET_TTL_MS = 30 * 60 * 1000;

const sha256Hex = async (text) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

const randomToken = () =>
  [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");

const HEAD = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "cache-control": "no-store",
};

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...HEAD, ...headers },
  });

const fail = (message, status = 400) => json({ error: message }, status);

const localeOf = { id: "id-ID", en: "en-GB", de: "de-DE", fr: "fr-FR", es: "es-ES", ru: "ru-RU" };
const nf = (n, lang) => new Intl.NumberFormat(localeOf[lang] || "en-GB").format(n);
const money = (idr, lang) => (lang === "id" ? `Rp ${nf(idr, lang)}` : `IDR ${nf(idr, lang)}`);

/* ---------------- validasi ---------------- */
const isStr = (v, max) => typeof v === "string" && v.trim().length > 0 && v.trim().length <= max;

function safePhoto(v) {
  if (typeof v !== "string") return "";
  const s = v.trim();
  if (!s) return "";
  if (s.length > 300) return "";
  if (s.startsWith("/")) return s.includes("..") ? "" : s;
  if (/^https?:\/\//i.test(s)) return s;
  return "";
}

function slug(v) {
  return String(v || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function validateLangMap(map) {
  if (!map || typeof map !== "object") return "Data terjemahan tidak ditemukan.";
  for (const l of langs) {
    const c = map[l.code];
    const label = l.short;
    if (!c || !isStr(c.name, 120)) return `Nama (${label}) wajib diisi, maksimal 120 karakter.`;
    if (!isStr(c.tagline, 240)) return `Deskripsi singkat (${label}) wajib diisi, maksimal 240 karakter.`;
    if (!Array.isArray(c.includes) || c.includes.length < 1 || c.includes.length > 6) {
      return `"Sudah termasuk" (${label}) harus 1–6 baris.`;
    }
    if (c.includes.some((x) => !isStr(x, 120))) return `Poin "sudah termasuk" (${label}) maksimal 120 karakter.`;

    if (c.description !== undefined && c.description !== null && String(c.description).length > 1200) {
      return `Penjelasan (${label}) maksimal 1200 karakter.`;
    }
    if (c.itinerary !== undefined && c.itinerary !== null) {
      if (!Array.isArray(c.itinerary) || c.itinerary.length > 12) {
        return `Rencana perjalanan (${label}) maksimal 12 baris.`;
      }
      if (c.itinerary.some((x) => !isStr(x, 200))) {
        return `Baris rencana perjalanan (${label}) maksimal 200 karakter dan tidak boleh kosong.`;
      }
    }
  }
  return null;
}

function cleanLangMap(map) {
  const out = {};
  for (const l of langs) {
    const c = map[l.code];
    out[l.code] = {
      name: c.name.trim(),
      tagline: c.tagline.trim(),
      includes: c.includes.map((x) => x.trim()).filter(Boolean),
      ...(typeof c.description === "string" ? { description: c.description.trim() } : {}),
      ...(Array.isArray(c.itinerary)
        ? { itinerary: c.itinerary.map((x) => String(x).trim()).filter(Boolean) }
        : {}),
    };
  }
  return out;
}

function validateTour(input) {
  const id = slug(input.id);
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(id)) return { error: "ID paket wajib huruf kecil/angka/tanda hubung (2–40)." };
  if (!TOUR_CATS.includes(input.category)) return { error: "Kategori paket tidak dikenal." };
  if (!ART.includes(input.art)) return { error: "Ilustrasi tidak dikenal." };
  const price = Number(input.price);
  const hours = Number(input.hours);
  if (!Number.isFinite(price) || price < 1000 || price > 100000000) return { error: "Harga tidak valid." };
  if (!Number.isFinite(hours) || hours < 1 || hours > 72) return { error: "Durasi harus 1–72 jam." };
  const soloRaw = Number(input.soloPrice || 0);
  if (!Number.isFinite(soloRaw) || soloRaw < 0 || soloRaw > 100000000) {
    return { error: "Harga solo (1 orang) tidak valid." };
  }
  const langErr = validateLangMap(input.t);
  if (langErr) return { error: langErr };

  return {
    value: {
      id,
      category: input.category,
      art: input.art,
      price: Math.round(price),
      soloPrice: Math.round(soloRaw),
      hours: Math.round(hours),
      featured: Boolean(input.featured),
      photo: safePhoto(input.photo),
      sort: Number(input.sort) || 0,
      t: cleanLangMap(input.t),
    },
  };
}

function validateRental(input) {
  const id = slug(input.id);
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(id)) return { error: "ID kendaraan wajib huruf kecil/angka/tanda hubung (2–40)." };
  if (!RENT_TYPES.includes(input.type)) return { error: "Jenis kendaraan harus Mobil atau Motor." };
  const price = Number(input.price);
  if (!Number.isFinite(price) || price < 1000 || price > 100000000) return { error: "Harga harian tidak valid." };
  const driverFee = Number(input.driverFee || 0);
  if (!Number.isFinite(driverFee) || driverFee < 0 || driverFee > 2000000) {
    return { error: "Biaya sopir tidak valid (0–2.000.000)." };
  }
  const langErr = validateLangMap(input.t);
  if (langErr) return { error: langErr };

  return {
    value: {
      id,
      type: input.type,
      art: input.type,
      price: Math.round(price),
      featured: Boolean(input.featured),
      photo: safePhoto(input.photo),
      driverFee: Math.round(driverFee),
      sort: Number(input.sort) || 0,
      t: cleanLangMap(input.t),
    },
  };
}

/** Validasi path/URL foto yang diisi admin.
    Hanya menerima path lokal ("/…") atau http(s) — menolak javascript:, data:, dll. */
function safeImageUrl(raw) {
  const v = String(raw ?? "").trim();
  if (!v || v.length > 300) return "";
  if (v.startsWith("/")) return /^\/[^\s"'<>\\]*$/.test(v) ? v : "";
  if (/^https?:\/\//i.test(v)) return /^https?:\/\/[^\s"'<>\\]+$/i.test(v) ? v : "";
  return "";
}

function validateSettings(input) {
  const phone = String(input.phoneE164 || "").replace(/[^\d]/g, "");
  if (!/^\d{8,15}$/.test(phone)) return { error: "Nomor WhatsApp harus 8–15 digit (format internasional tanpa +)." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input.email || ""))) return { error: "Email tidak valid." };
  const address = {};
  const hours = {};
  for (const l of langs) {
    const a = input.address?.[l.code];
    const h = input.hours?.[l.code];
    if (typeof a !== "string" || typeof h !== "string") return { error: `Alamat & jam (${l.short}) wajib berupa teks.` };
    if (a.length > 200 || h.length > 120) return { error: `Alamat/jam (${l.short}) terlalu panjang.` };
    address[l.code] = a.trim();
    hours[l.code] = h.trim();
  }
  return {
    value: {
      phoneE164: phone,
      phoneDisplay: String(input.phoneDisplay || "").trim() || `+${phone}`,
      email: String(input.email).trim(),
      address,
      hours,
      instagram: String(input.instagram || "").trim(),
      facebook: String(input.facebook || "").trim(),
      heroPhoto: safeImageUrl(input.heroPhoto),
      rentalHeroPhoto: safeImageUrl(input.rentalHeroPhoto),
    },
  };
}

/* ---------------- data publik ---------------- */
async function publicPayload(data, lang) {
  const L = langs.some((l) => l.code === lang) ? lang : "id";
  const t = (k) => copy[L]?.[k] ?? copy.en[k] ?? k;
  const rate = Number(site.usdRate) || 16200;

  const addr = data.settings.address;
  const hrs = data.settings.hours;
  const settings = {
    phoneE164: data.settings.phoneE164,
    phoneDisplay: data.settings.phoneDisplay,
    email: data.settings.email,
    address: typeof addr === "string" ? addr : addr?.[L] || addr?.id || "",
    hours: typeof hrs === "string" ? hrs : hrs?.[L] || hrs?.id || "",
    instagram: data.settings.instagram,
    facebook: data.settings.facebook,
    heroPhoto: data.settings.heroPhoto || "",
    rentalHeroPhoto: data.settings.rentalHeroPhoto || "",
  };

  const wa = (msg) => `https://wa.me/${settings.phoneE164}?text=${encodeURIComponent(msg)}`;

  const tours = (data.tours || []).map((tr) => {
    const c = tr.t?.[L] || tr.t?.en || tr.t?.id || {};
    return {
      id: tr.id,
      cat: tr.category,
      catLabel: t(`tours.${tr.category}`),
      art: tr.art,
      name: c.name || tr.id,
      tagline: c.tagline || "",
      includes: c.includes || [],
      description: c.description || "",
      itinerary: c.itinerary || [],
      price: tr.price,
      priceText: money(tr.price, L),
      soloPrice: Number(tr.soloPrice) || 0,
      perText: L === "id" ? t("tours.per") : `${t("tours.per")} · ≈ US$${Math.round(tr.price / rate)}`,
      durationText: durationForms[L](tr.hours),
      photo: tr.photo || "",
      featured: Boolean(tr.featured),
      waHref: wa(`${t("wa.hi")} ${t("wa.want")} ${c.name || tr.id} ${t("wa.for")} 2 ${t("wa.ppl")}.`),
    };
  });

  const rentals = (data.rentals || []).map((r) => {
    const c = r.t?.[L] || r.t?.en || r.t?.id || {};
    return {
      id: r.id,
      type: r.type,
      typeLabel: t(`rental.${r.type}`),
      art: r.art || r.type,
      name: c.name || r.id,
      tagline: c.tagline || "",
      includes: c.includes || [],
      description: c.description || c.tagline || "",
      price: r.price,
      priceText: money(r.price, L),
      perText: L === "id" ? t("rental.perDay") : `${t("rental.perDay")} · ≈ US$${Math.round(r.price / rate)}`,
      unitText: t("rental.perDay"),
      photo: r.photo || "",
      featured: Boolean(r.featured),
      driverFee: Number(r.driverFee) || 0,
      waHref: wa(`${t("wa.hi")} ${t("rental.book")} ${c.name || r.id}`),
    };
  });

  const rev = await revOfAsync({ settings: data.settings, tours: data.tours, rentals: data.rentals });
  return { rev, lang: L, settings, tours, rentals };
}

/* ---------------- kredensial aktif ---------------- */
const authVersion = (hash = "", user = "") => `${user}|${String(hash).slice(-16)}`;

async function resolveAuth(env, store) {
  const data = await ensureData(store);
  const panel = data.auth && data.auth.passwordHash ? data.auth : null;
  const useEnv = !panel || env.ADMIN_RESET === "1";
  return {
    data,
    user: useEnv ? env.ADMIN_USER || DEFAULT_ADMIN_USER : panel.user,
    hash: useEnv ? env.ADMIN_PASSWORD_HASH || DEFAULT_PASSWORD_HASH : panel.passwordHash,
    source: useEnv ? "server" : "panel",
    updatedAt: panel ? panel.updatedAt : null,
  };
}

/* ---------------- util request ---------------- */
async function readJson(request) {
  const text = await request.text();
  if (!text) return {};
  if (text.length > MAX_BODY) throw new Error("too large");
  return JSON.parse(text);
}

function csrfOk(request) {
  const origin = request.headers.get("origin");
  const host = new URL(request.url).host;
  if (!origin) return request.headers.get("x-requested-with") === "fetch";
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/* ---------------- handler utama ---------------- */
export async function handleApi(request, env = {}) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, "").replace(/\/+$/, "");
  const method = request.method.toUpperCase();

  const local = isLocalRequest(request);
  const secret = sessionSecret(env, local);
  const store = env.__store || (env.DB ? new D1Store(env.DB) : null);
  const media = env.__media || (env.BUCKET ? new R2Media(env.BUCKET) : null);

  /* --- media publik (foto hasil unggah admin) --- */
  if (path.startsWith("media/") && method === "GET") {
    const key = decodeURIComponent(path.slice("media/".length));
    if (!MEDIA_KEY_RE.test(key)) return new Response("Not found", { status: 404 });
    if (!media) return new Response("Penyimpanan media belum aktif.", { status: 501 });
    const obj = await media.get(key);
    if (!obj) return new Response("Not found", { status: 404 });
    return new Response(obj.body, {
      headers: {
        "content-type": obj.contentType,
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  }

  if (!store) {
    return json(
      { error: "Database belum terhubung. Lokal: pakai npm run dev. Produksi: binding D1 bernama DB." },
      500
    );
  }

  /* --- publik --- */
  if (path === "data" && method === "GET") {
    const data = await ensureData(store);
    const payload = await publicPayload(data, url.searchParams.get("lang") || "id");
    return json(payload);
  }

  /* --- sesi --- */
  if (path === "login" && method === "POST") {
    if (!secret) return json({ error: "SESSION_SECRET belum diset di server." }, 500);
    const ip = clientIp(request);
    const blocked = loginBlocked(ip);
    if (blocked) return json({ error: `Terlalu banyak percobaan. Coba lagi dalam ${blocked} detik.` }, 429);

    let body;
    try {
      body = await readJson(request);
    } catch {
      return fail("Permintaan tidak valid.");
    }

    const auth = await resolveAuth(env, store);
    const okUser = timingSafeStrings(String(body.username || "").trim(), auth.user);
    const okPass = await verifyPassword(String(body.password || ""), auth.hash);

    if (!okUser || !okPass) {
      noteLoginFailure(ip);
      return json({ error: "Nama pengguna atau kata sandi salah." }, 401);
    }

    resetLoginFailures(ip);
    const token = await createSession(secret, auth.user, authVersion(auth.hash, auth.user));
    return json({ ok: true, user: auth.user }, 200, { "set-cookie": sessionCookie(request, token) });
  }

  if (path === "logout" && method === "POST") {
    return json({ ok: true }, 200, { "set-cookie": clearSessionCookie(request) });
  }

  if (path === "session" && method === "GET") {
    const session = await readSession(request, secret);
    if (!session) return json({ ok: false }, 401);
    const auth = await resolveAuth(env, store);
    if (session.v !== authVersion(auth.hash, auth.user)) return json({ ok: false, stale: true }, 401);
    return json({ ok: true, user: session.u, exp: session.exp });
  }

  /* --- lupa kata sandi: kirim tautan reset ke email --- */
  if (path === "admin/forgot" && method === "POST") {
    const ip = clientIp(request);
    const blocked = forgotBlocked(ip);
    if (blocked) return json({ error: `Terlalu banyak permintaan. Coba lagi dalam ${blocked} detik.` }, 429);

    let body;
    try {
      body = await readJson(request);
    } catch {
      return fail("Permintaan tidak valid.");
    }

    const auth = await resolveAuth(env, store);
    const generic = {
      ok: true,
      message: "Kalau nama pengguna cocok, tautan reset sudah dikirim ke email admin.",
    };

    const okUser = timingSafeStrings(String(body.username || "").trim(), auth.user);
    if (!okUser) return json(generic);

    noteForgot(ip);

    const to = env.ADMIN_EMAIL || auth.data.settings?.email;
    if (!to) {
      return json({ error: "Alamat email admin belum diset (env ADMIN_EMAIL)." }, 500);
    }

    const token = randomToken();
    const data = auth.data;
    data.auth = {
      ...(data.auth || { user: auth.user }),
      user: auth.user,
      passwordHash: data.auth?.passwordHash || auth.hash,
      reset: { hash: await sha256Hex(token), exp: Date.now() + RESET_TTL_MS },
    };
    await saveData(store, data);

    const origin = new URL(request.url).origin;
    const link = `${origin}${site.adminPath}?reset=${token}`;
    const minutes = Math.round(RESET_TTL_MS / 60000);

    if (!mailConfigured(env)) {
      // Lokal: tautan dikembalikan agar bisa diuji tanpa layanan email.
      if (local) return json({ ...generic, devLink: link, mailConfigured: false });
      return json(
        {
          error:
            "Pengiriman email belum aktif. Set RESEND_API_KEY + ADMIN_EMAIL di Cloudflare, atau pakai pemulihan lewat ADMIN_PASSWORD_HASH.",
        },
        501
      );
    }

    try {
      await sendMail(env, {
        to,
        subject: `${site.name} — reset kata sandi panel admin`,
        html: resetEmailHtml({ name: site.name, link, minutes }),
        text: `Reset kata sandi panel admin ${site.name}: ${link} (berlaku ${minutes} menit, sekali pakai).`,
      });
    } catch (err) {
      return json({ error: err.message }, 502);
    }

    return json(generic);
  }

  /* --- pakai token reset untuk membuat kata sandi baru --- */
  if (path === "admin/reset" && method === "POST") {
    let body;
    try {
      body = await readJson(request);
    } catch {
      return fail("Permintaan tidak valid.");
    }

    const token = String(body.token || "").trim();
    const pass = String(body.password || "");
    const confirm = String(body.confirm || "");
    if (!token) return fail("Tautan reset tidak lengkap.");

    const auth = await resolveAuth(env, store);
    const data = auth.data;
    const reset = data.auth?.reset;
    if (!reset || !reset.hash || !reset.exp) return fail("Tautan reset tidak berlaku lagi. Minta tautan baru.");
    if (Date.now() > Number(reset.exp)) return fail("Tautan reset sudah kedaluwarsa. Minta tautan baru.");
    if ((await sha256Hex(token)) !== reset.hash) return fail("Tautan reset tidak valid.");

    if (pass.length < 10) return fail("Kata sandi baru minimal 10 karakter.");
    if (pass.length > 200) return fail("Kata sandi terlalu panjang.");
    if (pass !== confirm) return fail("Ulangi kata sandi tidak sama.");

    const currentUser = data.auth.user || auth.user;
    const newUser = String(body.username || "").trim();
    const user = newUser || currentUser;

    if (newUser && !/^[a-zA-Z0-9._@-]{3,40}$/.test(newUser)) {
      return fail("Nama pengguna 3–40 karakter (huruf, angka, titik, _ @ -).");
    }
    if (pass === user) return fail("Kata sandi tidak boleh sama dengan nama pengguna.");

    const passwordHash = await hashPassword(pass, 20000);
    data.auth = { user, passwordHash, updatedAt: new Date().toISOString() };
    await saveData(store, data);

    return json({ ok: true, user, usernameChanged: user !== currentUser });
  }

  /* --- butuh login --- */
  if (path.startsWith("admin")) {
    const session = await readSession(request, secret);
    if (!session) return json({ error: "Sesi berakhir. Silakan masuk lagi." }, 401);
    const guardAuth = await resolveAuth(env, store);
    if (session.v !== authVersion(guardAuth.hash, guardAuth.user)) {
      return json({ error: "Kredensial berubah. Silakan masuk lagi." }, 401);
    }
    if (method !== "GET" && !csrfOk(request)) return json({ error: "Permintaan ditolak (origin)." }, 403);
  }

  if (path === "admin/data" && method === "GET") {
    const auth = await resolveAuth(env, store);
    const data = auth.data;
    const rev = await revOfAsync({ settings: data.settings, tours: data.tours, rentals: data.rentals });
    const { auth: _hidden, ...safe } = data;
    return json({
      ...safe,
      rev,
      security: {
        user: auth.user,
        source: auth.source,
        updatedAt: auth.updatedAt,
        envUser: env.ADMIN_USER || DEFAULT_ADMIN_USER,
        resetFlag: env.ADMIN_RESET === "1",
      },
    });
  }

  /* --- ganti username & kata sandi --- */
  if (path === "admin/credentials" && method === "PUT") {
    const auth = await resolveAuth(env, store);
    const ip = clientIp(request);
    const blocked = loginBlocked(ip);
    if (blocked) return json({ error: `Terlalu banyak percobaan. Coba lagi dalam ${blocked} detik.` }, 429);

    let body;
    try {
      body = await readJson(request);
    } catch {
      return fail("Permintaan tidak valid.");
    }

    const okCurrent = await verifyPassword(String(body.currentPassword || ""), auth.hash);
    if (!okCurrent) {
      noteLoginFailure(ip);
      return json({ error: "Kata sandi saat ini salah." }, 401);
    }

    const user = String(body.username || "").trim();
    const pass = String(body.password || "");
    const confirm = String(body.confirm || "");

    if (!/^[a-zA-Z0-9._@-]{3,40}$/.test(user)) {
      return fail("Nama pengguna 3–40 karakter (huruf, angka, titik, _ @ -).");
    }
    if (pass.length < 10) return fail("Kata sandi baru minimal 10 karakter.");
    if (pass.length > 200) return fail("Kata sandi terlalu panjang.");
    if (pass === user) return fail("Kata sandi tidak boleh sama dengan nama pengguna.");
    if (pass !== confirm) return fail("Ulangi kata sandi tidak sama.");

    const passwordHash = await hashPassword(pass, 20000);
    const data = auth.data;
    const updatedAt = new Date().toISOString();
    data.auth = { user, passwordHash, updatedAt };
    await saveData(store, data);

    resetLoginFailures(ip);
    const token = await createSession(secret, user, authVersion(passwordHash, user));
    return json(
      { ok: true, user, source: "panel", updatedAt },
      200,
      { "set-cookie": sessionCookie(request, token) }
    );
  }

  /* --- unggah foto (admin) --- */
  if (path === "admin/upload" && method === "POST") {
    if (!media) {
      return json(
        {
          error:
            "Penyimpanan media belum aktif. Tambahkan binding R2 bernama BUCKET di Cloudflare, atau jalankan npm run dev untuk menyimpan ke folder lokal.",
        },
        501
      );
    }
    const declared = Number(request.headers.get("content-length") || 0);
    if (declared > MAX_UPLOAD + 512 * 1024) return json({ error: "Ukuran file terlalu besar (maks 4 MB)." }, 413);

    let form;
    try {
      form = await request.formData();
    } catch {
      return fail("Berkas upload tidak valid.");
    }

    const file = form.get("file");
    if (!file || typeof file === "string") return fail("Tidak ada berkas yang dikirim.");

    const type = String(file.type || "").toLowerCase();
    const ext = EXT_BY_TYPE[type];
    if (!ext) return json({ error: "Format harus JPG, PNG, WebP, atau AVIF." }, 415);
    if (Number(file.size) > MAX_UPLOAD) return json({ error: "Ukuran maksimal 4 MB." }, 413);

    const rand = [...crypto.getRandomValues(new Uint8Array(6))]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const key = `img/${Date.now().toString(36)}-${rand}.${ext}`;

    await media.put(key, file.stream(), type);
    return json({ ok: true, url: `/api/media/${key}`, key, size: file.size }, 201);
  }

  /* --- terjemahan otomatis (Indonesia → 5 bahasa) --- */
  if (path === "admin/translate" && method === "POST") {
    let body;
    try {
      body = await readJson(request);
    } catch {
      return fail("Permintaan tidak valid.");
    }

    if (!env.AI && !env.__ai) {
      return json(
        { error: "Terjemahan otomatis belum aktif. Aktifkan binding AI (lihat README)." },
        501
      );
    }

    const kind = String(body.kind || "tour");
    if (!TRANSLATE_SHAPES[kind]) return fail("Jenis konten tidak dikenal.");

    const source = body.source && typeof body.source === "object" ? body.source : null;
    if (!source) return fail("Teks bahasa Indonesia belum diisi.");

    const shape = TRANSLATE_SHAPES[kind];
    const targets = Array.isArray(body.targets) && body.targets.length
      ? body.targets.filter((c) => TRANSLATE_TARGETS.includes(c))
      : TRANSLATE_TARGETS;
    if (!targets.length) return fail("Tidak ada bahasa tujuan yang valid.");

    try {
      const translations = await translateAll(env.AI || env.__ai, source, shape, targets);
      return json({ ok: true, translations });
    } catch (err) {
      return json(
        { error: `Terjemahan gagal: ${err && err.message ? err.message : "tidak diketahui"}` },
        502
      );
    }
  }

  if (path === "admin/settings" && method === "PUT") {
    let body;
    try {
      body = await readJson(request);
    } catch {
      return fail("Permintaan tidak valid.");
    }
    const res = validateSettings(body);
    if (res.error) return fail(res.error);
    const data = await ensureData(store);
    data.settings = res.value;
    const saved = await saveData(store, data);
    return json({ ok: true, settings: saved.settings });
  }

  /* --- CRUD tour --- */
  const tourMatch = path.match(/^admin\/tours(?:\/([a-z0-9-]+))?$/);
  if (tourMatch && ["POST", "PUT", "DELETE"].includes(method)) {
    const target = tourMatch[1];
    let body = {};
    if (method !== "DELETE") {
      try {
        body = await readJson(request);
      } catch {
        return fail("Permintaan tidak valid.");
      }
    }
    const data = await ensureData(store);

    if (method === "POST") {
      const res = validateTour(body);
      if (res.error) return fail(res.error);
      if (data.tours.some((t) => t.id === res.value.id)) return fail("ID paket sudah dipakai.", 409);
      data.tours.push(res.value);
      await saveData(store, data);
      return json({ ok: true, tour: res.value }, 201);
    }

    const idx = data.tours.findIndex((t) => t.id === target);
    if (idx < 0) return fail("Paket tidak ditemukan.", 404);

    if (method === "PUT") {
      const res = validateTour({ ...body, id: target });
      if (res.error) return fail(res.error);
      data.tours[idx] = res.value;
      await saveData(store, data);
      return json({ ok: true, tour: res.value });
    }

    data.tours.splice(idx, 1);
    await saveData(store, data);
    return json({ ok: true, deleted: target });
  }

  /* --- CRUD rental --- */
  const rentMatch = path.match(/^admin\/rentals(?:\/([a-z0-9-]+))?$/);
  if (rentMatch && ["POST", "PUT", "DELETE"].includes(method)) {
    const target = rentMatch[1];
    let body = {};
    if (method !== "DELETE") {
      try {
        body = await readJson(request);
      } catch {
        return fail("Permintaan tidak valid.");
      }
    }
    const data = await ensureData(store);

    if (method === "POST") {
      const res = validateRental(body);
      if (res.error) return fail(res.error);
      if (data.rentals.some((r) => r.id === res.value.id)) return fail("ID kendaraan sudah dipakai.", 409);
      data.rentals.push(res.value);
      await saveData(store, data);
      return json({ ok: true, rental: res.value }, 201);
    }

    const idx = data.rentals.findIndex((r) => r.id === target);
    if (idx < 0) return fail("Kendaraan tidak ditemukan.", 404);

    if (method === "PUT") {
      const res = validateRental({ ...body, id: target });
      if (res.error) return fail(res.error);
      data.rentals[idx] = res.value;
      await saveData(store, data);
      return json({ ok: true, rental: res.value });
    }

    data.rentals.splice(idx, 1);
    await saveData(store, data);
    return json({ ok: true, deleted: target });
  }

  return json({ error: "Endpoint tidak ditemukan." }, 404);
}