#!/usr/bin/env node
/* ============================================================
   BUILD — menghasilkan situs statis multi-bahasa (6 bahasa)
   Jalankan: node build.mjs
   Output  : dist/
   ============================================================ */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { site, langs, defaultLang, tours, rentals, copy, durationForms, testimonials } from "./content/content.mjs";
import { revOf } from "./functions/_lib/util.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, "dist");
const out = (...p) => path.join(DIST, ...p);

/* ---------- util ---------- */
const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const attr = (s = "") => esc(s).replace(/'/g, "&#39;");
const T = (lang) => (key) => copy[lang]?.[key] ?? copy.en[key] ?? `[[${key}]]`;
const localeOf = { id: "id-ID", en: "en-GB", de: "de-DE", fr: "fr-FR", es: "es-ES", ru: "ru-RU" };
const num = (n, lang) => new Intl.NumberFormat(localeOf[lang]).format(n);

function money(idr, lang) {
  const n = num(idr, lang);
  return lang === "id" ? `Rp ${n}` : `IDR ${n}`;
}
function usd(idr) {
  return `≈ US$${Math.round(idr / site.usdRate)}`;
}
const wa = (text) => `https://wa.me/${site.phoneE164}?text=${encodeURIComponent(text)}`;
const hash = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 8);

/* Foto hero: nilai aslinya datang dari /api/data (diatur di panel admin).
   Saat build kita hanya menaruh src kalau file/path-nya benar-benar ada,
   supaya tidak ada request 404 untuk foto bawaan yang belum diunggah.
   Foto dari R2 (URL http…) atau hasil unggahan admin selalu dipakai. */
const heroSrc = (p) => {
  const v = String(p || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("/")) return fs.existsSync(path.join(ROOT, v.replace(/^\//, ""))) ? v : "";
  return "";
};

const settingsSeed = () => ({
  phoneE164: site.phoneE164,
  phoneDisplay: site.phoneDisplay,
  email: site.email,
  address: Object.fromEntries(langs.map((l) => [l.code, copy[l.code]["contact.address"]])),
  hours: Object.fromEntries(langs.map((l) => [l.code, copy[l.code]["contact.hours"]])),
  instagram: site.instagram,
  facebook: site.facebook,
  tripadvisor: site.tripadvisor,
  heroPhoto: site.heroPhoto || "",
  rentalHeroPhoto: site.rentalHeroPhoto || "",
});

const DATA_REV = revOf({ settings: settingsSeed(), tours, rentals });

/* Path panel admin (dinormalisasi: diawali & diakhiri "/") */
const ADMIN_PATH = (() => {
  const raw = String(site.adminPath || "/admin/").trim();
  const clean = raw.replace(/^\/+|\/+$/g, "").replace(/\s+/g, "-").toLowerCase();
  return `/${clean}/`;
})();
const ADMIN_DIR = ADMIN_PATH.replace(/^\/|\/$/g, "");


const BEACON_READY = Boolean(site.cfBeaconToken) && !/^GANTI/i.test(String(site.cfBeaconToken || ""));
const BEACON_TAG = BEACON_READY
  ? `${BEACON_TAG}`
  : "";

const ASSET_V = hash(
  fs.readFileSync(path.join(ROOT, "assets/css/styles.css"), "utf8") +
    fs.readFileSync(path.join(ROOT, "assets/js/app.js"), "utf8")
);

/* Versi ikon: dihitung dari isi berkas ikon, supaya browser tidak memakai
   favicon lama dari cache-nya sendiri saat logo diperbarui. */
const ICON_V = (() => {
  const parts = ["favicon.svg", "favicon.ico", "apple-touch-icon.png"].map((f) => {
    const p = path.join(ROOT, "assets/img", f);
    return fs.existsSync(p) ? fs.readFileSync(p).toString("base64") : f;
  });
  return hash(parts.join("|")).slice(0, 8);
})();

/* Satu sumber untuk semua tag ikon, dipakai di keempat jenis halaman.
   Ikon SVG + apple-touch-icon dilayani dari /assets/img/ (bukan dari root):
   path root /favicon.svg pernah ter-cache "immutable" 1 tahun di edge dengan
   isi ikon generasi lama, sehingga tidak bisa diperbarui tanpa purge manual.
   /assets/* sudah immutable, jadi aman karena URL-nya diberi ?v=.
   favicon.ico tetap di root: browser memintanya otomatis tanpa <link>. */
const ICON_LINKS = `  <link rel="icon" href="/favicon.ico?v=${ICON_V}" sizes="32x32">
  <link rel="icon" href="/assets/img/favicon.svg?v=${ICON_V}" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png?v=${ICON_V}">`;

const ADMIN_V = (() => {
  const a = path.join(ROOT, "assets/admin/admin.css");
  const b = path.join(ROOT, "assets/admin/admin.js");
  if (!fs.existsSync(a) || !fs.existsSync(b)) return ASSET_V;
  return hash(fs.readFileSync(a, "utf8") + fs.readFileSync(b, "utf8")).slice(0, 8);
})();

/* ---------- ikon ---------- */
const I = {
  check: `<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path d="M20 6.5 9.6 17 4 11.4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  star: `<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path d="m12 3.6 2.5 5.4 5.9.7-4.3 4 1.2 5.8L12 16.6l-5.3 2.9 1.2-5.8-4.3-4 5.9-.7z" fill="currentColor"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path d="M12 3.2 5 6v5.1c0 4.2 2.9 7.6 7 9.7 4.1-2.1 7-5.5 7-9.7V6z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m9 12 2.2 2.2L15.4 10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  key: `<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><circle cx="8.2" cy="12" r="3.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M11.6 12H20m-3 0v3m-3-3v2.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  tag: `<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path d="M20 13.2 13.2 20a2 2 0 0 1-2.8 0l-6.4-6.4V4h9.6l6.4 6.4a2 2 0 0 1 0 2.8Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="8.4" cy="8.4" r="1.5" fill="currentColor"/></svg>`,
  chat: `<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path d="M20 12.4c0 3.9-3.6 7-8 7a9.6 9.6 0 0 1-2.6-.35L5 21l.9-3.5A6.7 6.7 0 0 1 4 12.4c0-3.9 3.6-7 8-7s8 3.1 8 7Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="9" cy="12.4" r="1" fill="currentColor"/><circle cx="12.5" cy="12.4" r="1" fill="currentColor"/><circle cx="16" cy="12.4" r="1" fill="currentColor"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path d="M12 21s6.5-6 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21Z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="10.3" r="2.3" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 7.6V12l3.2 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path d="M7 4h3l1.6 4-2 1.4a11 11 0 0 0 5 5L16 12.4 20 14v3a2 2 0 0 1-2.2 2A15.4 15.4 0 0 1 5 6.2 2 2 0 0 1 7 4Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><rect x="3.6" y="5.6" width="16.8" height="12.8" rx="2.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m4.4 7.6 7.6 5 7.6-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path d="M20 14.4A8.4 8.4 0 0 1 9.6 4a8.6 8.6 0 1 0 10.4 10.4Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  wa: `<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path d="M12 3.8a8.2 8.2 0 0 0-7 12.4L3.8 20.2l4.1-1.1A8.2 8.2 0 1 0 12 3.8Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 8.9c.5-.1.7.1.9.5l.5 1.1c.1.3 0 .5-.2.7l-.4.4c.5 1 1.4 1.9 2.4 2.4l.4-.4c.2-.2.4-.3.7-.2l1.1.5c.4.2.6.4.5.9-.2 1-1.1 1.6-2.1 1.5-2.6-.3-4.7-2.4-5-5-.1-1 .5-1.9 1.5-2.1Z" fill="currentColor"/></svg>`,
  arrow: `<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path d="M5 12h13m0 0-5-5m5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path d="M12 5.5v13M5.5 12h13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
};

/* ---------- klaim rating & ulasan ----------
   Semua bintang dan angka rating di situs hanya dirender kalau
   rating + reviewCount diisi angka di content/content.mjs.
   Selama nilainya 0, tidak ada satu pun klaim rating karangan
   yang tampil (tidak ada risiko melanggar kebijakan Google). */
const RATING = Number(site.rating) || 0;
const REVIEWS = Number(site.reviewCount) || 0;
const reviewsOn = RATING > 0 && REVIEWS > 0;
const TESTIMONIALS = Array.isArray(testimonials) ? testimonials.filter((x) => x && x.quote) : [];
const SHOW_REVIEWS = site.reviewsShow !== false && TESTIMONIALS.length > 0;
const FOUNDED = Number(site.founded) || 2014;
const SINCE = `Bali · since ${FOUNDED}`;
const ratingText = (lang) => {
  const s = RATING.toFixed(1);
  return lang === "en" ? s : s.replace(".", ",");
};
const stars5 = Array.from({ length: 5 }, () => I.star).join("");
const initialsOf = (name = "") =>
  String(name)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => [...word][0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/* ---------- ilustrasi (inline SVG, tanpa file gambar) ---------- */
const palettes = {
  terrace: { sky: ["#FFD8A4", "#FF9C77", "#6B5A8F"], land: ["#1F4638", "#173A2F", "#0E2820"], sun: "#FFF1C9" },
  island: { sky: ["#C3EEFF", "#7FD2E7", "#2A86A0"], land: ["#0E4C5C", "#0A3745", "#062630"], sun: "#FFF6DD" },
  volcano: { sky: ["#FFCB8E", "#FF855A", "#59396C"], land: ["#241C33", "#191226", "#110D19"], sun: "#FFE6AE" },
  temple: { sky: ["#FFB8A2", "#C57BA9", "#473777"], land: ["#221A39", "#181029", "#0E091A"], sun: "#FFE2B4" },
  river: { sky: ["#CFF3DA", "#78C8A4", "#1C6A57"], land: ["#0D3A30", "#092B25", "#051A16"], sun: "#F5FFE6" },
  gate: { sky: ["#BBDCFF", "#8DB3E7", "#5A6EA8"], land: ["#132A4A", "#0C1E36", "#07121F"], sun: "#FFF7DE" },
  car: { sky: ["#CFE3FF", "#9DB9E8", "#485C90"], land: ["#16233C", "#0F1929", "#080F1B"], sun: "#FFF3D6" },
  bike: { sky: ["#FFD9C4", "#F0A78E", "#8A5B6E"], land: ["#2A1A2A", "#1E1220", "#120A15"], sun: "#FFE9C8" },
};

const lOpaque = (hex, alpha = "0.35") => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

function shapes(kind, uid, p) {
  const [l1, l2, l3] = p.land;
  switch (kind) {
    case "terrace":
      return `
      <path d="M0 176c58-26 104-8 148 12s96 22 148 2 104-30 104-30v120H0Z" fill="${l1}"/>
      <path d="M0 205c66-22 118-4 164 14s92 18 142 2 94-18 94-18v77H0Z" fill="${l2}"/>
      <path d="M0 236c70-16 122 2 170 14s94 10 140-2 90-10 90-10v42H0Z" fill="${l3}"/>
      <g stroke="#8FE4C4" stroke-width="1.2" opacity=".45" fill="none">
        <path d="M8 178c58-24 102-7 146 13"/><path d="M40 208c52-16 96 0 138 14"/><path d="M70 238c48-12 90 2 130 10"/>
      </g>
      <path d="M300 150c0-18 14-30 32-30s32 12 32 30z" fill="#123027" opacity=".55"/>`;
    case "island":
      return `
      <path d="M246 150c26-10 52-6 72 12l82 62v56H200l22-84c6-22 12-40 24-46Z" fill="${l1}"/>
      <path d="M236 196c30 6 58 20 82 38l34 26H214l-6-40c4-14 12-26 28-24Z" fill="${l2}"/>
      <path d="M0 236c56-8 104 2 148 12s118 8 168-4 84-10 84-10v46H0Z" fill="${l3}"/>
      <g stroke="#BFF2FF" stroke-width="1.4" opacity=".55" fill="none">
        <path d="M0 214c60-6 110 4 156 12"/><path d="M28 246c64-4 112 4 152 10"/>
      </g>
      <path d="M300 120c10 0 18 8 18 18h-36c0-10 8-18 18-18Z" fill="#0A2A33" opacity=".5"/>
      <path d="M40 196h34l-17 10Z" fill="#0A2A33" opacity=".35"/>`;
    case "volcano":
      return `
      <path d="M170 74 262 244H86Z" fill="${l1}"/>
      <path d="M170 74l26 48-12 22 14 20-20 26-18-30 10-18-12-24Z" fill="${l2}" opacity=".9"/>
      <path d="M262 118 330 244H212Z" fill="${l3}"/>
      <path d="M0 232c54-10 96 4 138 12s96 6 140-4 88-8 88-8H0Z" fill="${l3}"/>
      <g fill="#fff" opacity=".18"><ellipse cx="84" cy="196" rx="46" ry="12"/><ellipse cx="296" cy="212" rx="56" ry="14"/></g>`;
    case "temple":
      return `
      <path d="M0 214c56-10 102 2 146 12s100 8 148-4 86-10 86-10v68H0Z" fill="${l2}"/>
      <g fill="${l1}">
        <path d="M138 92h56l10 22h-76Z"/><path d="M130 114h72l8 20h-88Z"/><path d="M124 134h84v72h-84Z"/>
        <path d="M250 120h34l7 16h-48Z"/><path d="M244 136h46l6 14h-58Z"/><path d="M240 150h54v52h-54Z"/>
      </g>
      <g fill="${l3}" opacity=".85"><path d="M152 152h28v54h-28Z"/><path d="M252 166h30v36h-30Z"/></g>
      <path d="M0 226c64-8 116 2 160 10s108 4 156-6 84-6 84-6" stroke="#FFE0C0" stroke-width="1.2" opacity=".35" fill="none"/>`;
    case "river":
      return `
      <path d="M0 148c42 6 78 30 96 66s58 48 106 42 84-26 118-26h80v50H0Z" fill="${l1}"/>
      <path d="M210 132c-40 22-58 54-52 88 4 24 22 44 48 54l-64 6c-26-18-40-44-40-74 0-40 24-70 66-88Z" fill="${l2}"/>
      <path d="M168 164c-30 26-38 62-20 92" stroke="#7FE3C8" stroke-width="6" stroke-linecap="round" opacity=".55" fill="none"/>
      <g fill="${l3}" opacity=".55"><ellipse cx="64" cy="178" rx="40" ry="16"/><ellipse cx="330" cy="168" rx="46" ry="18"/></g>`;
    case "car":
      return `
      <path d="M0 206h400v74H0Z" fill="${lOpaque(l2)}"/>
      <g>
        <path d="M104 186c0-14 8-22 20-23l20-22c5-6 12-9 20-9h62c9 0 17 4 22 12l14 19 22 4c12 2 20 10 20 21v9c0 5-4 9-9 9H113c-5 0-9-4-9-9Z" fill="${l1}"/>
        <path d="M150 141h44v26h-58Z" fill="#DBEAFB" opacity=".55"/>
        <path d="M204 141h34c6 0 11 2 14 7l10 19h-58Z" fill="#DBEAFB" opacity=".45"/>
        <circle cx="152" cy="196" r="20" fill="#0B1018"/>
        <circle cx="264" cy="196" r="20" fill="#0B1018"/>
        <circle cx="152" cy="196" r="9" fill="#93A6BF"/>
        <circle cx="264" cy="196" r="9" fill="#93A6BF"/>
        <rect x="298" y="166" width="12" height="7" rx="3" fill="#FFE6AE" opacity=".85"/>
      </g>
      <g stroke="${lOpaque(l3)}" stroke-width="3" opacity=".5"><path d="M18 246h54"/><path d="M300 258h64"/></g>`;

    case "bike":
      return `
      <path d="M0 208h400v72H0Z" fill="${l2}"/>
      <g>
        <circle cx="132" cy="198" r="27" fill="none" stroke="#0B1018" stroke-width="9"/>
        <circle cx="268" cy="198" r="27" fill="none" stroke="#0B1018" stroke-width="9"/>
        <path d="M132 198c8-30 30-34 56-30l22 6 22 24" fill="none" stroke="${l1}" stroke-width="12" stroke-linecap="round"/>
        <path d="M186 168h44c10 0 16 6 16 14v8h-60Z" fill="${l1}"/>
        <path d="M178 158h48c8 0 12 4 12 10h-60c0-6 0-10 0-10Z" fill="#0B1018" opacity=".55"/>
        <path d="M246 152v-22c0-6 6-10 12-10s12 4 12 10v18" fill="none" stroke="${l1}" stroke-width="9" stroke-linecap="round"/>
        <path d="M232 128h54" stroke="${l1}" stroke-width="8" stroke-linecap="round"/>
        <circle cx="286" cy="140" r="7" fill="#FFE6AE"/>
      </g>`;
    case "gate":
      return `
      <path d="M0 240c58-14 106-4 150 6s102 6 148-4 102-6 102-6v44H0Z" fill="${l3}"/>
      <g fill="${l1}">
        <path d="M96 244V110l34-22 34 22v134Z"/><path d="M236 244V110l34-22 34 22v134Z"/>
      </g>
      <g fill="${l2}"><path d="M130 244V124l34-18 34 18v120h-14V132l-20-10-20 10v112Z"/><path d="M270 244V124l34-18 34 18v120h-14V132l-20-10-20 10v112Z"/></g>
      <path d="M164 96c0-16 14-28 32-28s32 12 32 28Z" fill="${l1}" opacity=".6"/>`;
    default:
      return "";
  }
}

function art(kind, uid, opts = {}) {
  const p = palettes[kind] || palettes.terrace;
  const gid = `g-${uid}`;
  return `<svg class="art" viewBox="0 0 400 280" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="${gid}-sky" x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0" stop-color="${p.sky[0]}"/><stop offset=".55" stop-color="${p.sky[1]}"/><stop offset="1" stop-color="${p.sky[2]}"/>
      </linearGradient>
      <radialGradient id="${gid}-sun" cx=".5" cy=".5" r=".5">
        <stop offset="0" stop-color="${p.sun}"/><stop offset="1" stop-color="${p.sun}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="${gid}-veil" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity=".18"/>
      </linearGradient>
    </defs>
    <rect width="400" height="280" fill="url(#${gid}-sky)"/>
    <circle cx="${opts.sunX ?? 300}" cy="${opts.sunY ?? 86}" r="90" fill="url(#${gid}-sun)" opacity=".85"/>
    <circle cx="${opts.sunX ?? 300}" cy="${opts.sunY ?? 86}" r="26" fill="${p.sun}" opacity=".9"/>
    ${shapes(kind, gid, p)}
    <rect width="400" height="280" fill="url(#${gid}-veil)"/>
  </svg>`;
}

/* ---------- komponen ---------- */
// id gradien dibuat unik per instance: logo dipakai lebih dari sekali dalam
// satu halaman, dan id SVG duplikat membuat referensi url(#…) menunjuk
// definisi yang salah (mis. logo footer kehilangan gradiennya).
let brandSeq = 0;
const brandMark = (size = 40) => {
  const n = ++brandSeq;
  const gA = `lm${n}`;
  const gB = `lmh${n}`;
  return `<svg class="logomark" viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true">
  <defs>
    <linearGradient id="${gA}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#37E0CE"/><stop offset=".55" stop-color="#12A79A"/><stop offset="1" stop-color="#0A6E6A"/>
    </linearGradient>
    <linearGradient id="${gB}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="40" height="40" rx="12.5" fill="url(#${gA})"/>
  <rect width="40" height="40" rx="12.5" fill="url(#${gB})"/>
  <path d="M7.5 26.5c4.6-6.4 8.9-6.4 13 0 4 6.3 8.2 6.3 12 0" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".95"/>
  <circle cx="27.5" cy="12.6" r="3.5" fill="#FFE9A8"/>
</svg>`;
};

const dots = `<span class="win-dots" aria-hidden="true"><i></i><i></i><i></i></span>`;

function head(lang, meta) {
  const L = langs.find((l) => l.code === lang);
  const path = meta.path || `/${lang}/`;
  const altList = meta.alts || langs.map((l) => [l, `/${l.code}/`]);
  const alts = altList
    .map(([l, href]) => `<link rel="alternate" hreflang="${l.hreflang}" href="${site.url}${href}">`)
    .join("\n  ");
  /* Rentang harga dihitung dari paket tour yang benar-benar ada, jadi tidak
     pernah basi saat harga diubah di content/content.mjs. */
  const minPrice = Math.min(...tours.map((tr) => tr.price));
  const maxPrice = Math.max(...tours.map((tr) => tr.price));
  /* Alamat resmi diambil dari satu sumber (site.addressParts) supaya data
     NAP di structured data selalu sama dengan halaman kontak. */
  const ap = site.addressParts || {};
  /* sameAs: hanya tautan profil yang punya isi. Tautan ke domain induk
     (mis. https://www.tripadvisor.com/) tidak berguna bagi mesin pencari. */
  const sameAs = [site.instagram, site.facebook, site.tripadvisor].filter((u) =>
    /^https?:\/\/[^/]+\/./i.test(String(u || ""))
  );
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: site.name,
    url: `${site.url}/${lang}/`,
    image: `${site.url}/og.jpg`,
    description: meta.desc,
    telephone: `+${site.phoneE164}`,
    email: site.email,
    priceRange: `${money(minPrice, lang)} – ${money(maxPrice, lang)}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: ap.street,
      addressLocality: ap.locality,
      addressRegion: ap.region,
      postalCode: ap.postal,
      addressCountry: "ID",
    },
    geo: { "@type": "GeoCoordinates", latitude: site.geo.lat, longitude: site.geo.lng },
    areaServed: { "@type": "Place", name: "Bali, Indonesia" },
    openingHours: "Mo-Su 07:00-21:00",
    // aggregateRating sengaja tidak ditulis: Google mewajibkan rating berasal
    // dari ulasan nyata yang bisa diverifikasi. Selama ulasan tamu belum asli,
    // menaruhnya di sini berisiko manual action (spam structured data).
    sameAs,
    inLanguage: L.code,
  };
  return `<!doctype html>
<html lang="${L.code}" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(meta.title)}</title>
  <meta name="description" content="${esc(meta.desc)}">
  <link rel="canonical" href="${site.url}${path}">
  ${alts}
  <link rel="alternate" hreflang="x-default" href="${site.url}/en/">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(site.name)}">
  <meta property="og:title" content="${esc(meta.title)}">
  <meta property="og:description" content="${esc(meta.desc)}">
  <meta property="og:url" content="${site.url}${path}">
  <meta property="og:image" content="${site.url}/og.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:locale" content="${L.hreflang.replace("-", "_")}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(meta.title)}">
  <meta name="twitter:description" content="${esc(meta.desc)}">
  <meta name="twitter:image" content="${site.url}/og.jpg">
  <meta name="theme-color" content="${site.themeColor}">
${ICON_LINKS}
  <link rel="stylesheet" href="/assets/css/styles.css?v=${ASSET_V}">
  <script>try{var s=localStorage.getItem("dbt-theme");document.documentElement.dataset.theme=s||(window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light")}catch(e){}</script>
  <script>
    /* Kalau file dibuka langsung (file://), tampilkan petunjuk singkat,
       bukan halaman yang tampak rusak tanpa penjelasan. */
    (function(){
      if (location.protocol !== "file:") return;
      document.addEventListener("DOMContentLoaded", function(){
        var n = document.createElement("div");
        n.setAttribute("role", "alert");
        n.style.cssText = "position:fixed;inset:auto 16px 16px 16px;z-index:99;padding:16px 18px;border-radius:14px;background:#0f172a;color:#fff;font:14px/1.55 system-ui,-apple-system,sans-serif;box-shadow:0 12px 32px rgba(0,0,0,.35)";
        n.innerHTML = "<strong>Halaman ini dibuka sebagai file, bukan lewat server.</strong><br>" +
          "Sebagian tampilan dan tautan tidak akan bekerja. Jalankan di Terminal:<br>" +
          "<code style='display:inline-block;margin-top:6px;padding:4px 8px;border-radius:6px;background:#1e293b'>npm run dev</code> " +
          "lalu buka <code>http://localhost:4173/id/</code>";
        document.body.appendChild(n);
      });
    })();
  </script>
  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>`;
}

function nav(lang, t, isHome = true) {
  const L = langs.find((l) => l.code === lang);
  const H = (hash) => (isHome ? hash : `/${lang}/${hash}`);
  const links = [
    [H("#tours"), t("nav.tours")],
    [`/${lang}/rental/`, t("nav.rental")],
    [H("#why"), t("nav.why")],
    ...(SHOW_REVIEWS ? [[H("#reviews"), t("nav.reviews")]] : []),
    [H("#faq"), t("nav.faq")],
    [H("#contact"), t("nav.contact")],
  ]
    .map(([href, label]) => `<a href="${href}">${esc(label)}</a>`)
    .join("");
  const langItems = langs
    .map(
      (l) =>
        `<a href="/${l.code}/" hreflang="${l.hreflang}" ${l.code === lang ? 'aria-current="true"' : ""}><span class="lang-code">${l.short}</span><span>${esc(l.label)}</span></a>`
    )
    .join("");
  return `<header class="nav-wrap">
  <div class="nav glass" id="nav">
    <a class="brand" href="${isHome ? "#top" : `/${lang}/`}" aria-label="${esc(site.name)}">
      ${brandMark(38)}
      <span class="brand-text"><strong>${esc(site.name)}</strong><span>${esc(SINCE)}</span></span>
    </a>
    <nav class="nav-links" aria-label="Primary">${links}</nav>
    <div class="nav-actions">
      <button class="icon-btn" type="button" data-theme-toggle aria-label="${esc(t("ui.theme"))}" title="${esc(t("ui.theme"))}">
        <span class="theme-sun">${I.sun}</span><span class="theme-moon">${I.moon}</span>
      </button>
      <div class="lang" data-lang>
        <button class="icon-btn lang-btn" type="button" aria-expanded="false" aria-haspopup="menu" aria-label="${esc(t("nav.lang"))}">
          <span class="lang-cur">${L.short}</span><svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
        </button>
        <div class="lang-menu glass">${langItems}</div>
      </div>
      <a class="btn btn-primary btn-sm nav-cta" href="${wa(t("wa.hi") + " " + t("wa.nav"))}" target="_blank" rel="noopener">${I.wa}<span>${esc(t("nav.book"))}</span></a>
      <button class="icon-btn burger" type="button" aria-expanded="false" aria-controls="sheet" aria-label="${esc(t("ui.menu"))}">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    </div>
    <span class="nav-progress" aria-hidden="true"></span>
  </div>
  <div class="sheet glass" id="sheet" hidden>
    <nav class="sheet-links" aria-label="Mobile">${links}</nav>
    <div class="sheet-lang">${langs
      .map((l) => `<a href="/${l.code}/" ${l.code === lang ? 'aria-current="true"' : ""}>${l.short}</a>`)
      .join("")}</div>
    <a class="btn btn-primary btn-block" href="${wa(t("wa.hi") + " " + t("wa.nav"))}" target="_blank" rel="noopener">${I.wa}<span>${esc(t("nav.book"))}</span></a>
  </div>
</header>`;
}

function hero(lang, t) {
  const s = (k) => t(k);
  return `<section class="hero" id="top">
  <div class="hero-grid">
    <div class="hero-copy">
      <span class="eyebrow"><span class="eyebrow-dot"></span>${esc(s("hero.eyebrow"))}</span>
      <h1 class="display">${s("hero.title")}</h1>
      <p class="lede">${esc(s("hero.sub"))}</p>
      <div class="hero-cta">
        <a class="btn btn-primary" href="#tours">${esc(s("hero.cta1"))}${I.arrow}</a>
        <a class="btn btn-glass" href="#contact">${I.chat}${esc(s("hero.cta2"))}</a>
      </div>
      ${
        reviewsOn
          ? `<div class="proof">
        <div class="proof-text">
          <div class="stars">${stars5}</div>
          <span>${esc(ratingText(lang))} / 5 · ${num(REVIEWS, lang)} ${esc(t("reviews.eyebrow"))}</span>
          <span class="muted">${esc(s("hero.resp"))}</span>
        </div>
      </div>`
          : `<div class="proof">
        <div class="proof-text">
          <span>${esc(s("hero.resp"))}</span>
        </div>
      </div>`
      }
    </div>
    <div class="hero-visual">
      <div class="window glass">
        <div class="win-bar">${dots}<span class="win-title">${esc(site.name)} · Bali</span></div>
        <div class="win-body">
          <div class="win-art" data-hero="tour">${
            // Foto diganti dari panel admin; nilai di sini hanya tebakan awal
            // agar langsung tampil. Kalau file tidak ada, onerror menghapusnya
            // sehingga ilustrasi SVG tetap menjadi latar.
            site.heroPhoto && heroSrc(site.heroPhoto)
              ? `<img class="tour-photo" src="${attr(heroSrc(site.heroPhoto))}" alt="" decoding="async" onerror="this.remove()">`
              : ""
          }${art("temple", "hero", { sunX: 318, sunY: 74 })}</div>
          <div class="win-info">
            <span class="mini-kicker">${esc(s("hero.card.kicker"))}</span>
            <h2 class="win-h">${esc(s("hero.card.title"))}</h2>
            <p class="muted">${esc(s("hero.card.meta"))}</p>
            <div class="win-foot">
              <strong>${esc(s("hero.card.price"))}</strong>
              <span class="badge badge-ok"><span class="pulse"></span>${esc(s("hero.card.status"))}</span>
            </div>
          </div>
        </div>
      </div>
      ${
        reviewsOn
          ? `<div class="float-chip chip-rating glass">
        <span class="chip-star">${I.star}</span>
        <div><strong>${ratingText(lang)}</strong><span>${num(REVIEWS, lang)} ${esc(t("reviews.eyebrow"))}</span></div>
      </div>`
          : ""
      }
      <div class="float-chip chip-trust glass">${I.shield}<span>${esc(s("trust.2"))}</span></div>
    </div>
  </div>
  <ul class="trust-row glass" aria-label="Highlights">
    ${[1, 2, 3, 4].map((i) => `<li>${I.check}<span>${esc(s(`trust.${i}`))}</span></li>`).join("")}
  </ul>
</section>`;
}

function stats(lang, t) {
  const years = Math.max(1, new Date().getFullYear() - (Number(site.founded) || 2014));
  const items = [
    { v: `${years}+`, k: "stats.a" },
    { v: "100%", k: "stats.d" },
  ];
  if (reviewsOn) items.push({ v: `${ratingText(lang)} / 5`, k: "stats.c" });
  return `<section class="stats" aria-label="Company facts">
    <div class="stats-inner glass" data-n="${items.length}">
      ${items
        .map((it) => `<div class="stat"><strong>${esc(it.v)}</strong><span>${esc(t(it.k))}</span></div>`)
        .join("")}
    </div>
  </section>`;
}

function toursSection(lang, t) {
  const cats = [
    ["all", t("tours.all")],
    ["culture", t("tours.culture")],
    ["adventure", t("tours.adventure")],
    ["island", t("tours.island")],
  ];
  const cards = tours
    .map((tr) => {
      const c = tr.t[lang] || tr.t.en;
      const bookMsg = `${t("wa.hi")} ${t("wa.want")} ${c.name} ${t("wa.for")} 2 ${t("wa.ppl")}.`;
      return `<article class="card tour glass" data-cat="${tr.category}" data-filterable data-reveal>
        <div class="tour-art">
          ${
            tr.photo && fs.existsSync(path.join(ROOT, tr.photo))
              ? `<img class="tour-photo" src="${tr.photo}" alt="" loading="lazy" decoding="async">`
              : ""
          }${art(tr.art, "t-" + tr.id)}
          <span class="chip-cat glass-pill">${esc(t("tours." + tr.category))}</span>
          <span class="chip-dur glass-pill">${I.clock}<span>${esc(durationForms[lang](tr.hours))}</span></span>
        </div>
        <div class="tour-body">
          <h3>${esc(c.name)}</h3>
          <p class="tour-tag">${esc(c.tagline)}</p>
          <ul class="ticks">${c.includes.map((inc) => `<li>${I.check}<span>${esc(inc)}</span></li>`).join("")}</ul>
          <div class="tour-foot">
            <div class="price">
              <span class="price-from">${esc(t("tours.from"))}</span>
              <strong>${esc(money(tr.price, lang))}</strong>
              <span class="price-per">${lang === "id" ? esc(t("tours.per")) : `${esc(t("tours.per"))} · ${usd(tr.price)}`}</span>
            </div>
            <a class="btn btn-glass btn-sm" href="${wa(bookMsg)}" target="_blank" rel="noopener" data-book data-book-kind="tour" data-book-name="${attr(c.name)}" data-book-price="${tr.price}" data-book-meta="${attr(durationForms[lang](tr.hours))}" data-book-desc="${attr(c.description || "")}" data-book-itin="${attr((c.itinerary || []).join("|"))}" data-book-solo="${tr.soloPrice || 0}" data-book-photo="${attr(tr.photo || "")}">${I.wa}<span>${esc(t("tours.book"))}</span></a>
          </div>
        </div>
      </article>`;
    })
    .join("\n");

  return `<section class="section" id="tours">
  <div class="wrap">
    <header class="sec-head" data-reveal>
      <span class="eyebrow"><span class="eyebrow-dot"></span>${esc(t("tours.eyebrow"))}</span>
      <h2 class="display-2">${esc(t("tours.title"))}</h2>
      <p class="sec-sub">${esc(t("tours.sub"))}</p>
    </header>
    <div class="filters" role="group" aria-label="${esc(t("tours.eyebrow"))}">
      ${cats
        .map(
          ([k, label], i) =>
            `<button class="filter${i === 0 ? " is-active" : ""}" type="button" data-filter="${k}" aria-pressed="${i === 0}">${esc(label)}</button>`
        )
        .join("")}
    </div>
    <div class="tour-grid" id="tour-grid">${cards}</div>
    <p class="note">${esc(t("tours.note"))} <span class="note-strong">${esc(t("tours.groupNote"))}</span></p>
  </div>
</section>`;
}

function whySection(lang, t) {
  const icons = [I.shield, I.key, I.tag, I.chat];
  return `<section class="section" id="why">
  <div class="wrap">
    <header class="sec-head" data-reveal>
      <span class="eyebrow"><span class="eyebrow-dot"></span>${esc(t("why.eyebrow"))}</span>
      <h2 class="display-2">${esc(t("why.title"))}</h2>
      <p class="sec-sub">${esc(t("why.sub"))}</p>
    </header>
    <div class="feature-grid">
      ${[1, 2, 3, 4]
        .map(
          (i) => `<article class="card feature glass" data-reveal>
            <span class="feature-ico">${icons[i - 1]}</span>
            <h3>${esc(t(`why.f${i}t`))}</h3>
            <p>${esc(t(`why.f${i}d`))}</p>
          </article>`
        )
        .join("")}
    </div>
  </div>
</section>`;
}

const marqueeWords = ["Ubud", "Nusa Penida", "Mount Batur", "Uluwatu", "Tegallalang", "Sidemen", "Amed", "Tanah Lot", "Jimbaran", "Tirta Gangga"];

function marquee() {
  const row = marqueeWords
    .map((w) => `<span class="mq-item">${esc(w)}<i></i></span>`)
    .join("");
  return `<div class="marquee" aria-hidden="true"><div class="mq-track">${row}${row}</div></div>`;
}

function stepsSection(lang, t) {
  return `<section class="section" id="steps">
  <div class="wrap">
    <header class="sec-head" data-reveal>
      <span class="eyebrow"><span class="eyebrow-dot"></span>${esc(t("steps.eyebrow"))}</span>
      <h2 class="display-2">${esc(t("steps.title"))}</h2>
      <p class="sec-sub">${esc(t("steps.sub"))}</p>
    </header>
    <ol class="step-grid">
      ${[1, 2, 3]
        .map(
          (i) => `<li class="card step glass" data-reveal>
            <span class="step-num">0${i}</span>
            <h3>${esc(t(`steps.${i}t`))}</h3>
            <p>${esc(t(`steps.${i}d`))}</p>
          </li>`
        )
        .join("")}
    </ol>
  </div>
</section>`;
}

function reviewsSection(lang, t) {
  if (!SHOW_REVIEWS) return "";
  return `<section class="section" id="reviews">
  <div class="wrap">
    <header class="sec-head" data-reveal>
      <span class="eyebrow"><span class="eyebrow-dot"></span>${esc(t("reviews.eyebrow"))}</span>
      <h2 class="display-2">${esc(t("reviews.title"))}</h2>
      ${reviewsOn ? `<p class="sec-sub">${esc(t("reviews.sub"))}</p>` : ""}
    </header>
    <div class="review-grid" data-n="${Math.min(3, TESTIMONIALS.length)}">
      ${TESTIMONIALS.slice(0, 3)
        .map((r, i) => {
          const stars = Math.max(0, Math.min(5, Math.round(Number(r.rating) || 0)));
          const initials = initialsOf(r.name);
          return `<figure class="card review glass" data-reveal>
            ${stars ? `<div class="stars stars-lg">${Array.from({ length: stars }, () => I.star).join("")}</div>` : ""}
            <blockquote>“${esc(r.quote)}”</blockquote>
            <figcaption>
              <span class="avatar a${i + 1}" aria-hidden="true">${esc(initials)}</span>
              <span class="who"><strong>${esc(r.name || "")}</strong><span>${esc(r.origin || "")}</span></span>
              ${r.tour ? `<span class="pill-tour">${esc(r.tour)}</span>` : ""}
            </figcaption>
          </figure>`;
        })
        .join("")}
    </div>
  </div>
</section>`;
}

function faqSection(lang, t) {
  return `<section class="section" id="faq">
  <div class="wrap wrap-narrow">
    <header class="sec-head" data-reveal>
      <span class="eyebrow"><span class="eyebrow-dot"></span>${esc(t("faq.eyebrow"))}</span>
      <h2 class="display-2">${esc(t("faq.title"))}</h2>
      <p class="sec-sub">${esc(t("faq.sub"))}</p>
    </header>
    <div class="faq-list">
      ${[1, 2, 3, 4, 5]
        .map(
          (i) => `<details class="faq glass" ${i === 1 ? "open" : ""} data-reveal>
            <summary><span>${esc(t(`faq.${i}q`))}</span><span class="faq-ico">${I.plus}</span></summary>
            <div class="faq-body"><p>${esc(t(`faq.${i}a`))}</p></div>
          </details>`
        )
        .join("")}
    </div>
  </div>
</section>`;
}

function ctaSection(lang, t) {
  return `<section class="section cta-section">
  <div class="wrap">
    <div class="cta-band glass" data-reveal>
      <div class="cta-glow" aria-hidden="true"></div>
      <h2 class="display-2">${esc(t("cta.title"))}</h2>
      <p>${esc(t("cta.sub"))}</p>
      <div class="cta-actions">
        <a class="btn btn-primary btn-lg" href="${wa(t("wa.hi") + " " + t("cta.sub"))}" target="_blank" rel="noopener">${I.wa}<span>${esc(t("cta.button"))}</span></a>
        <a class="btn btn-glass btn-lg" href="mailto:${site.email}">${I.mail}<span>${esc(site.email)}</span></a>
      </div>
      <p class="cta-note">${esc(t("cta.note"))}</p>
    </div>
  </div>
</section>`;
}

function contactSection(lang, t) {
  const options = tours.map((tr) => {
    const c = tr.t[lang] || tr.t.en;
    return `<option value="${esc(c.name)}">${esc(c.name)} — ${esc(money(tr.price, lang))}</option>`;
  });
  return `<section class="section" id="contact">
  <div class="wrap">
    <header class="sec-head" data-reveal>
      <span class="eyebrow"><span class="eyebrow-dot"></span>${esc(t("contact.eyebrow"))}</span>
      <h2 class="display-2">${esc(t("contact.title"))}</h2>
      <p class="sec-sub">${esc(t("contact.sub"))}</p>
    </header>
    <div class="contact-grid">
      <aside class="card info glass" data-reveal>
        <ul class="info-list">
          <li><span class="info-ico">${I.pin}</span><div><strong>${esc(t("contact.office"))}</strong><span data-f="address">${esc(t("contact.address"))}</span></div></li>
          <li><span class="info-ico">${I.clock}</span><div><strong data-f="hours">${esc(t("contact.hours"))}</strong><span class="ok"><span class="pulse"></span>${esc(t("contact.resp"))}</span></div></li>
          <li><span class="info-ico">${I.phone}</span><div><strong>${esc(t("contact.phone"))}</strong><a href="tel:+${site.phoneE164}">${esc(site.phoneDisplay)}</a></div></li>
          <li><span class="info-ico">${I.mail}</span><div><strong>${esc(t("contact.email"))}</strong><a href="mailto:${site.email}">${esc(site.email)}</a></div></li>
        </ul>
        <div class="info-social">
          <a href="${site.instagram}" target="_blank" rel="noopener">Instagram</a>
          <a href="${site.facebook}" target="_blank" rel="noopener">Facebook</a>
          <a href="${site.tripadvisor}" target="_blank" rel="noopener">Tripadvisor</a>
        </div>
      </aside>
      <form class="card form glass" id="book-form" data-reveal novalidate>
        <div class="field-row">
          <label class="field"><span>${esc(t("contact.name"))}</span><input name="name" type="text" autocomplete="name" required placeholder="Sarah Mitchell"></label>
          <label class="field"><span>${esc(t("contact.wa"))}</span><input name="wa" type="tel" autocomplete="tel" required placeholder="+62 812 3456 7890"></label>
        </div>
        <div class="field-row">
          <label class="field"><span>${esc(t("contact.date"))}</span><input name="date" type="date" required></label>
          <label class="field"><span>${esc(t("contact.guests"))}</span><input name="guests" type="number" min="1" max="30" value="2" required></label>
        </div>
        <label class="field"><span>${esc(t("contact.tour"))}</span><select name="tour">${options.join("")}</select></label>
        <label class="field"><span>${esc(t("contact.msg"))}</span><textarea name="msg" rows="3" placeholder="${attr(t("contact.msgPh"))}"></textarea></label>
        <button class="btn btn-primary btn-block" type="submit">${I.wa}<span>${esc(t("contact.submit"))}</span></button>
        <p class="form-note">${esc(t("contact.privacy"))}</p>
      </form>
    </div>
  </div>
</section>`;
}

function footer(lang, t) {
  return `<footer class="footer">
  <div class="wrap">
    <div class="foot-grid">
      <div class="foot-brand">
        <a class="brand" href="#top">${brandMark(36)}<span class="brand-text"><strong>${esc(site.name)}</strong><span>${esc(SINCE)}</span></span></a>
        <p>${esc(t("footer.tagline"))}</p>
        <div class="foot-social">
          <a href="${site.instagram}" target="_blank" rel="noopener" aria-label="Instagram">IG</a>
          <a href="${site.facebook}" target="_blank" rel="noopener" aria-label="Facebook">FB</a>
          <a href="${wa(t("wa.hi"))}" target="_blank" rel="noopener" aria-label="WhatsApp">WA</a>
        </div>
      </div>
      <nav class="foot-col" aria-label="${esc(t("footer.explore"))}">
        <h4>${esc(t("footer.explore"))}</h4>
        <a href="#tours">${esc(t("nav.tours"))}</a>
        <a href="#why">${esc(t("nav.why"))}</a>
        ${SHOW_REVIEWS ? `<a href="#reviews">${esc(t("nav.reviews"))}</a>` : ""}
        <a href="#faq">${esc(t("nav.faq"))}</a>
      </nav>
      <nav class="foot-col" aria-label="${esc(t("footer.company"))}">
        <h4>${esc(t("footer.company"))}</h4>
        <a href="#contact">${esc(t("footer.about"))}</a>
        <button type="button" data-dialog="privacy">${esc(t("footer.privacy"))}</button>
        <button type="button" data-dialog="terms">${esc(t("footer.terms"))}</button>
      </nav>
      <div class="foot-col">
        <h4>${esc(t("footer.contact"))}</h4>
        <a href="tel:+${site.phoneE164}">${esc(site.phoneDisplay)}</a>
        <a href="mailto:${site.email}">${esc(site.email)}</a>
        <span class="foot-addr" data-f="address">${esc(t("contact.address"))}</span>
        <span class="foot-addr" data-f="hours">${esc(t("contact.hours"))}</span>
      </div>
    </div>
    <div class="foot-bottom">
      <span>${esc(t("footer.rights"))}</span>
      <span>${esc(t("footer.made"))}</span>
      ${site.showAdminLink ? `<a class="foot-admin" href="${ADMIN_PATH}">${esc(t("footer.admin"))}</a>` : ""}
    </div>
  </div>
</footer>
<dialog class="dlg glass" id="dlg-privacy">
  <form method="dialog"><button class="icon-btn dlg-x" aria-label="${esc(t("ui.close"))}">✕</button></form>
  <h3>${esc(t("legal.privacyTitle"))}</h3>
  <p>${esc(t("legal.privacyBody"))}</p>
</dialog>
<dialog class="dlg glass" id="dlg-terms">
  <form method="dialog"><button class="icon-btn dlg-x" aria-label="${esc(t("ui.close"))}">✕</button></form>
  <h3>${esc(t("legal.termsTitle"))}</h3>
  <p>${esc(t("legal.termsBody"))}</p>
</dialog>
<a class="fab-glass" href="${wa(t("wa.hi") + " " + t("wa.nav"))}" target="_blank" rel="noopener" aria-label="${esc(t("cta.button"))}">${I.wa}<span>${esc(t("nav.book"))}</span></a>`;
}

function page(lang) {
  const t = T(lang);
  const doc = `${head(lang, { title: t("meta.title"), desc: t("meta.desc") })}
<body data-lang="${lang}" data-page="home" data-rev="${DATA_REV}" data-wa="${site.phoneE164}"
      data-wa-hi="${attr(t("wa.hi"))}" data-wa-want="${attr(t("wa.want"))}"
      data-wa-for="${attr(t("wa.for"))}" data-wa-ppl="${attr(t("wa.ppl"))}"
      data-wa-date="${attr(t("wa.onDate"))}" data-wa-name="${attr(t("wa.nameIs"))}">
<a class="skip" href="#main">Skip to content</a>
<div class="aura" aria-hidden="true"><i class="b1"></i><i class="b2"></i><i class="b3"></i><span class="grain"></span></div>
${nav(lang, t)}
<main id="main">
  ${hero(lang, t)}
  ${stats(lang, t)}
  ${toursSection(lang, t)}
  ${whySection(lang, t)}
  ${marquee()}
  ${stepsSection(lang, t)}
  ${reviewsSection(lang, t)}
  ${faqSection(lang, t)}
  ${ctaSection(lang, t)}
  ${contactSection(lang, t)}
  ${templates(lang, t)}
  ${bookingDialog(lang, t)}
</main>
${footer(lang, t)}
<script src="/assets/js/app.js?v=${ASSET_V}" defer></script>
${BEACON_TAG}
</body>
</html>
`;
  return doc;
}


/* ---------- template hidrasi (dipakai app.js saat data berubah dari admin) ---------- */
const ART_KINDS = ["terrace", "island", "volcano", "temple", "river", "gate", "car", "bike"];

function templates(lang, t) {
  const tick = `<template id="tpl-tick"><li class="tick-li">${I.check}<span data-f="text"></span></li></template>`;
  const tour = `<template id="tpl-tour">
  <article class="card tour glass" data-filterable data-cat="" data-reveal>
    <div class="tour-art">
      <img class="tour-photo" alt="" hidden>
      <span class="chip-cat glass-pill" data-f="cat"></span>
      <span class="chip-dur glass-pill">${I.clock}<span data-f="dur"></span></span>
    </div>
    <div class="tour-body">
      <h3 data-f="name"></h3>
      <p class="tour-tag" data-f="tagline"></p>
      <ul class="ticks" data-f="includes"></ul>
      <div class="tour-foot">
        <div class="price">
          <span class="price-from">${esc(t("tours.from"))}</span>
          <strong data-f="price"></strong>
          <span class="price-per" data-f="per"></span>
        </div>
        <a class="btn btn-glass btn-sm" data-f="wa" data-book data-book-kind="tour" data-book-name="" data-book-price="0" data-book-meta="" data-book-desc="" data-book-itin="" data-book-solo="0" data-book-photo="" target="_blank" rel="noopener">${I.wa}<span>${esc(t("tours.book"))}</span></a>
      </div>
    </div>
  </article>
</template>`;
  const rent = `<template id="tpl-rental">
  <article class="card tour glass" data-filterable data-cat="" data-reveal>
    <div class="tour-art">
      <img class="tour-photo" alt="" hidden>
      <span class="chip-cat glass-pill" data-f="type"></span>
      <span class="chip-dur glass-pill">${I.clock}<span data-f="unit"></span></span>
    </div>
    <div class="tour-body">
      <h3 data-f="name"></h3>
      <p class="tour-tag" data-f="tagline"></p>
      <ul class="ticks" data-f="includes"></ul>
      <div class="tour-foot">
        <div class="price">
          <span class="price-from">${esc(t("rental.from"))}</span>
          <strong data-f="price"></strong>
          <span class="price-per" data-f="per"></span>
        </div>
        <a class="btn btn-glass btn-sm" data-f="wa" data-book data-book-kind="rental" data-book-name="" data-book-price="0" data-book-driver-fee="0" data-book-meta="" data-book-desc="" data-book-itin="" data-book-photo="" target="_blank" rel="noopener">${I.wa}<span>${esc(t("rental.book"))}</span></a>
      </div>
    </div>
  </article>
</template>`;
  const arts = ART_KINDS.map((k) => `<template id="art-${k}">${art(k, "tpl-" + k)}</template>`).join("\n");
  return `${tour}\n${rent}\n${tick}\n${arts}`;
}

/* ---------- kartu rental (render statis) ---------- */
function rentalCard(r, lang, t) {
  const c = r.t[lang] || r.t.en;
  const msg = `${t("wa.hi")} ${t("rental.book")} ${c.name}`;
  return `<article class="card tour glass" data-cat="${r.type}" data-filterable data-reveal>
  <div class="tour-art">
    ${r.photo && fs.existsSync(path.join(ROOT, r.photo)) ? `<img class="tour-photo" src="${r.photo}" alt="" loading="lazy" decoding="async">` : ""}${art(r.art, "r-" + r.id)}
    <span class="chip-cat glass-pill">${esc(t("rental." + r.type))}</span>
    <span class="chip-dur glass-pill">${I.clock}<span>${esc(money(r.price, lang))} ${esc(t("rental.perDay"))}</span></span>
  </div>
  <div class="tour-body">
    <h3>${esc(c.name)}</h3>
    <p class="tour-tag">${esc(c.tagline)}</p>
    <ul class="ticks">${c.includes.map((i) => `<li>${I.check}<span>${esc(i)}</span></li>`).join("")}</ul>
    <div class="tour-foot">
      <div class="price">
        <span class="price-from">${esc(t("rental.from"))}</span>
        <strong>${esc(money(r.price, lang))}</strong>
        <span class="price-per">${esc(t("rental.perDay"))}${lang === "id" ? "" : " · " + usd(r.price)}</span>
      </div>
      <a class="btn btn-glass btn-sm" href="${wa(msg)}" target="_blank" rel="noopener" data-book data-book-kind="rental" data-book-name="${attr(c.name)}" data-book-price="${r.price}" data-book-driver-fee="${r.driverFee || 0}" data-book-meta="${attr(t("rental." + r.type))}" data-book-desc="${attr(c.description || c.tagline || "")}" data-book-itin="" data-book-photo="${attr(r.photo || "")}">${I.wa}<span>${esc(t("rental.book"))}</span></a>
    </div>
  </div>
</article>`;
}


/* ---------- dialog pemesanan (foto + tamu/unit/hari + sopir) ---------- */
function bookingDialog(lang, t) {
  const i18n = {
    title: t("book.title"),
    guests: t("book.guests"),
    days: t("book.days"),
    units: t("book.units"),
    driver: t("book.driver"),
    selfDrive: t("book.selfDrive"),
    withDriver: t("book.withDriver"),
    msgSelfDrive: t("book.msgSelfDrive"),
    msgWithDriver: t("book.msgWithDriver"),
    unitShort: t("book.unitShort"),
    total: t("book.total"),
    cta: t("book.cta"),
    noteTour: t("book.noteTour"),
    noteRental: t("book.noteRental"),
    unitDays: t("book.unitDays"),
    kickerTour: t("book.kickerTour"),
    kickerRental: t("book.kickerRental"),
    about: t("book.about"),
    itinerary: t("book.itinerary"),
    includesTour: t("tours.includes"),
    includesRental: t("rental.includes"),
    perPerson: t("tours.per"),
    perDay: t("rental.perDay"),
    unitPeople: t("wa.ppl"),
    unitPeople1: t("wa.ppl1"),
    want: t("wa.want"),
    hi: t("wa.hi"),
    forLabel: t("wa.for"),
    rentalBook: t("rental.book"),
    soloTag: t("book.soloTag"),
    soloPriceNote: t("book.soloPriceNote"),
    soloHint: t("book.soloHint"),
    groupTag: t("book.groupTag"),
    groupNote: t("book.groupNote"),
  };
  return `<dialog class="dlg booking" id="booking" aria-label="${attr(t("book.title"))}">
  <form method="dialog"><button class="icon-btn dlg-x" aria-label="${attr(t("ui.close"))}">✕</button></form>
  <div class="booking-grid">
    <div class="booking-media" data-b="media">
      <div class="booking-shot">
        <img class="booking-photo" data-b="photo" alt="" decoding="async" hidden>
        <div class="booking-media-cap">
          <span class="mini-kicker" data-b="kicker"></span>
          <strong data-b="name"></strong>
        </div>
      </div>

      <div class="book-row book-row-tight" data-b="guestsRow">
        <span data-b="guestsLabel"></span>
        <div class="stepper">
          <button type="button" class="stepper-btn" data-step="count" data-delta="-1" aria-label="−">−</button>
          <input type="number" inputmode="numeric" min="1" max="12" step="1" value="2" data-b="count" aria-label="${attr(t("book.guests"))}">
          <button type="button" class="stepper-btn" data-step="count" data-delta="1" aria-label="+">+</button>
        </div>
      </div>
      <p class="book-hint" data-b="soloHint"></p>
      <div class="quick-picks quick-picks-media" data-b="quickGuests"></div>
    </div>

    <div class="booking-main">
      <p class="book-meta muted" data-b="meta"></p>

      <div class="book-detail" data-b="detail">
        <h4 class="book-sub" data-b="aboutLabel"></h4>
        <p class="book-about" data-b="about"></p>
        <div data-b="itinWrap">
          <h4 class="book-sub" data-b="itinLabel"></h4>
          <ol class="book-itin" data-b="itinerary"></ol>
        </div>
        <h4 class="book-sub" data-b="incLabel"></h4>
        <ul class="ticks" data-b="includes"></ul>
      </div>

      <div class="book-row" data-b="daysRow" hidden>
        <span data-b="daysLabel"></span>
        <div class="stepper">
          <button type="button" class="stepper-btn" data-step="days" data-delta="-1" aria-label="−">−</button>
          <input type="number" inputmode="numeric" min="1" max="30" step="1" value="1" data-b="days" aria-label="${attr(t("book.days"))}">
          <button type="button" class="stepper-btn" data-step="days" data-delta="1" aria-label="+">+</button>
        </div>
      </div>

      <div class="book-row" data-b="unitsRow" hidden>
        <span data-b="unitsLabel"></span>
        <div class="stepper">
          <button type="button" class="stepper-btn" data-step="units" data-delta="-1" aria-label="−">−</button>
          <input type="number" inputmode="numeric" min="1" max="5" step="1" value="1" data-b="units" aria-label="${attr(t("book.units"))}">
          <button type="button" class="stepper-btn" data-step="units" data-delta="1" aria-label="+">+</button>
        </div>
      </div>

      <div class="book-opt" data-b="driverRow" hidden>
        <span data-b="driverLabel"></span>
        <div class="segmented" role="group" aria-label="${attr(t("book.driver"))}">
          <button type="button" data-driver="0" class="is-active">${esc(t("book.selfDrive"))}</button>
          <button type="button" data-driver="1">${esc(t("book.withDriver"))}</button>
        </div>
      </div>

      <div class="quick-picks" data-b="quick"></div>
      <div class="book-total"><span data-b="totalLabel"></span><strong data-b="total"></strong></div>
      <p class="book-break" data-b="breakdown"></p>
      <p class="book-solo" data-b="soloNote" hidden></p>
      <p class="book-group" data-b="groupNote" hidden></p>
      <p class="book-note" data-b="note"></p>
      <a class="btn btn-primary btn-block" data-b="cta" target="_blank" rel="noopener">${I.wa}<span>${esc(t("book.cta"))}</span></a>
    </div>
  </div>
</dialog>
<script type="application/json" id="book-i18n">${JSON.stringify(i18n).replace(/</g, "\\u003c")}</script>`;
}

/* ---------- halaman rental ---------- */
function rentalPage(lang) {
  const t = T(lang);
  const cards = rentals.map((r) => rentalCard(r, lang, t)).join("\n");
  const cheapest = rentals.reduce((a, b) => (a.price <= b.price ? a : b));
  return `${head(lang, {
    title: t("rental.metaTitle"),
    desc: t("rental.metaDesc"),
    path: `/${lang}/rental/`,
    alts: langs.map((l) => [l, `/${l.code}/rental/`]),
  })}
<body data-lang="${lang}" data-page="rental" data-rev="${DATA_REV}" data-wa="${site.phoneE164}"
      data-wa-hi="${attr(t("wa.hi"))}" data-wa-want="${attr(t("wa.want"))}"
      data-wa-for="${attr(t("wa.for"))}" data-wa-ppl="${attr(t("wa.ppl"))}"
      data-wa-date="${attr(t("wa.onDate"))}" data-wa-name="${attr(t("wa.nameIs"))}">
<a class="skip" href="#main">Skip to content</a>
<div class="aura" aria-hidden="true"><i class="b1"></i><i class="b2"></i><i class="b3"></i><span class="grain"></span></div>
${nav(lang, t, false)}
<main id="main">
  <section class="hero" id="top">
    <div class="hero-grid">
      <div class="hero-copy">
        <span class="eyebrow"><span class="eyebrow-dot"></span>${esc(t("rental.eyebrow"))}</span>
        <h1 class="display">${t("rental.title")}</h1>
        <p class="lede">${esc(t("rental.sub"))}</p>
        <div class="hero-cta">
          <a class="btn btn-primary" href="#fleet">${esc(t("rental.cta1"))}${I.arrow}</a>
          <a class="btn btn-glass" href="${wa(t("wa.hi") + " " + t("rental.cta2"))}" target="_blank" rel="noopener">${I.wa}${esc(t("rental.cta2"))}</a>
        </div>
        <ul class="mini-facts">
          <li>${I.check}<span>${esc(t("rental.1t"))}</span></li>
          <li>${I.check}<span>${esc(t("rental.3t"))}</span></li>
          <li>${I.check}<span>${esc(t("rental.4t"))}</span></li>
        </ul>
      </div>
      <div class="hero-visual">
        <div class="window glass">
          <div class="win-bar">${dots}<span class="win-title">${esc(site.name)} · ${esc(t("rental.eyebrow"))}</span></div>
          <div class="win-body">
            <div class="win-art" data-hero="rental">${
              site.rentalHeroPhoto && heroSrc(site.rentalHeroPhoto)
                ? `<img class="tour-photo" src="${attr(heroSrc(site.rentalHeroPhoto))}" alt="" decoding="async" onerror="this.remove()">`
                : ""
            }${art("car", "rental-hero", { sunX: 306, sunY: 70 })}</div>
            <div class="win-info">
              <span class="mini-kicker">${esc(t("rental.from"))}</span>
              <h2 class="win-h">${esc(money(cheapest.price, lang))} <span class="win-unit">${esc(t("rental.perDay"))}</span></h2>
              <p class="muted">${esc(t("rental.all"))} · ${esc(t("rental.car"))} &amp; ${esc(t("rental.bike"))}</p>
              <div class="win-foot">
                <strong data-f="hours">${esc(t("contact.hours"))}</strong>
                <span class="badge badge-ok"><span class="pulse"></span>${esc(t("trust.1"))}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="fleet">
    <div class="wrap">
      <header class="sec-head" data-reveal>
        <span class="eyebrow"><span class="eyebrow-dot"></span>${esc(t("rental.eyebrow"))}</span>
        <h2 class="display-2">${esc(t("rental.cta1"))}</h2>
        <p class="sec-sub">${esc(t("rental.note"))}</p>
      </header>
      <div class="filters" role="group" aria-label="${esc(t("rental.eyebrow"))}">
        <button class="filter is-active" type="button" data-filter="all" aria-pressed="true">${esc(t("rental.all"))}</button>
        <button class="filter" type="button" data-filter="car" aria-pressed="false">${esc(t("rental.car"))}</button>
        <button class="filter" type="button" data-filter="bike" aria-pressed="false">${esc(t("rental.bike"))}</button>
      </div>
      <div class="tour-grid" id="rental-grid">${cards}</div>
    </div>
  </section>

  <section class="section" id="terms">
    <div class="wrap">
      <header class="sec-head" data-reveal>
        <span class="eyebrow"><span class="eyebrow-dot"></span>${esc(t("rental.termsTitle"))}</span>
        <h2 class="display-2">${esc(t("rental.termsTitle"))}</h2>
        <p class="sec-sub">${esc(t("rental.termsSub"))}</p>
      </header>
      <div class="feature-grid">
        ${[1, 2, 3, 4]
          .map(
            (i) => `<article class="card feature glass" data-reveal>
              <span class="step-num">0${i}</span>
              <h3>${esc(t(`rental.${i}t`))}</h3>
              <p>${esc(t(`rental.${i}d`))}</p>
            </article>`
          )
          .join("")}
      </div>
    </div>
  </section>

  ${ctaSection(lang, t)}
  ${templates(lang, t)}
  ${bookingDialog(lang, t)}
</main>
${footer(lang, t)}
<script src="/assets/js/app.js?v=${ASSET_V}" defer></script>
${BEACON_TAG}
</body>
</html>
`;
}

/* ---------- halaman admin ---------- */
function adminPage() {
  const v = ADMIN_V;
  return `<!doctype html>
<html lang="id" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Admin — ${esc(site.name)}</title>
  <meta name="robots" content="noindex, nofollow">
  <meta name="theme-color" content="#0e9488">
${ICON_LINKS}
  <link rel="stylesheet" href="/assets/css/styles.css?v=${v}">
  <link rel="stylesheet" href="/assets/admin/admin.css?v=${v}">
</head>
<body class="admin-page">
<div class="aura" aria-hidden="true"><i class="b1"></i><i class="b2"></i><i class="b3"></i><span class="grain"></span></div>

<main class="admin-shell">
  <section class="login-view" id="login-view">
    <form class="login-card glass" id="login-form" autocomplete="on">
      <div class="login-brand">
        ${brandMark(44)}
        <div><strong>${esc(site.name)}</strong><span>Panel admin</span></div>
      </div>
      <h1>Masuk untuk mengelola situs</h1>
      <p class="login-sub">Hanya admin yang memiliki kredensial dapat membuka panel ini.</p>
      <label class="field"><span>Nama pengguna</span><input name="username" type="text" autocomplete="username" required autofocus></label>
      <label class="field"><span>Kata sandi</span><input name="password" type="password" autocomplete="current-password" required></label>
      <p class="login-error" id="login-error" role="alert" hidden></p>
      <button class="btn btn-primary btn-block" type="submit">Masuk${I.arrow}</button>
      <button class="link-btn" type="button" id="forgot-toggle">Lupa kata sandi?</button>
      <a class="login-back" href="/id/">← Kembali ke situs</a>
    </form>

    <form class="login-card glass mini-form" id="forgot-form" hidden>
      <h1>Reset kata sandi</h1>
      <p class="login-sub">Masukkan nama pengguna admin. Kami kirim tautan untuk membuat kata sandi baru ke email admin.</p>
      <label class="field"><span>Nama pengguna</span><input name="username" type="text" autocomplete="username" required></label>
      <p class="mini-note" id="forgot-note" hidden></p>
      <div class="mini-actions">
        <button class="btn btn-glass btn-sm" type="button" id="forgot-cancel">Batal</button>
        <button class="btn btn-primary btn-sm" type="submit">Kirim tautan reset</button>
      </div>
    </form>

    <form class="login-card glass mini-form" id="reset-form" hidden>
      <h1>Buat kata sandi baru</h1>
      <p class="login-sub">Tautan reset berlaku 30 menit dan hanya bisa dipakai sekali.</p>
      <label class="field"><span>Nama pengguna baru (opsional)</span><input name="username" type="text" minlength="3" maxlength="40" autocomplete="username" placeholder="kosongkan jika tidak diganti"></label>
      <label class="field"><span>Kata sandi baru (min. 10 karakter)</span><input name="password" type="password" minlength="10" maxlength="200" autocomplete="new-password" required></label>
      <label class="field"><span>Ulangi kata sandi baru</span><input name="confirm" type="password" minlength="10" maxlength="200" autocomplete="new-password" required></label>
      <p class="mini-note" id="reset-note" hidden></p>
      <div class="mini-actions">
        <button class="btn btn-primary btn-sm" type="submit">Simpan kata sandi baru</button>
      </div>
    </form>
  </section>

  <section class="app-view" id="app-view" hidden>
    <header class="admin-top glass">
      <a class="brand" href="${ADMIN_PATH}">${brandMark(34)}<span class="brand-text"><strong>Admin</strong><span>${esc(site.name)}</span></span></a>
      <div class="admin-top-actions">
        <a class="btn btn-glass btn-sm" href="/id/" target="_blank" rel="noopener">Lihat situs</a>
        <button class="btn btn-glass btn-sm" type="button" id="logout-btn">Keluar</button>
      </div>
    </header>

    <nav class="admin-tabs" role="tablist" aria-label="Bagian admin">
      <button class="admin-tab is-active" data-tab="tours" role="tab" aria-selected="true">Paket Tour</button>
      <button class="admin-tab" data-tab="rentals" role="tab" aria-selected="false">Rental</button>
      <button class="admin-tab" data-tab="settings" role="tab" aria-selected="false">Pengaturan</button>
      <button class="admin-tab" data-tab="security" role="tab" aria-selected="false">Keamanan</button>
    </nav>

    <section class="admin-panel glass" id="panel" role="tabpanel"></section>

    <dialog class="dlg editor" id="editor">
      <form method="dialog" class="editor-close"><button class="icon-btn" aria-label="Tutup">✕</button></form>
      <div id="editor-body"></div>
    </dialog>
  </section>
</main>

<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script src="/assets/admin/admin.js?v=${v}" type="module"></script>
</body>
</html>
`;
}

/* ---------- halaman akar: deteksi bahasa ---------- */
function rootPage() {
  const cards = langs
    .map(
      (l) =>
        `<a class="pick glass" href="/${l.code}/" hreflang="${l.hreflang}"><span class="pick-code">${l.short}</span><span class="pick-label">${esc(l.label)}</span></a>`
    )
    .join("");
  const alts = langs.map((l) => `<link rel="alternate" hreflang="${l.hreflang}" href="${site.url}/${l.code}/">`).join("\n  ");
  return `<!doctype html>
<html lang="id" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(site.name)} — Private Tours in Bali</title>
  <meta name="description" content="${esc(copy.en["meta.desc"])}">
  <link rel="canonical" href="${site.url}/id/">
  ${alts}
  <link rel="alternate" hreflang="x-default" href="${site.url}/en/">
  <meta name="theme-color" content="${site.themeColor}">
${ICON_LINKS}
  <link rel="stylesheet" href="/assets/css/styles.css?v=${ASSET_V}">
  <script>
    (function(){
      try{
        var saved = localStorage.getItem("dbt-lang");
        var supported = ${JSON.stringify(langs.map((l) => l.code))};
        var pick = saved && supported.indexOf(saved) > -1 ? saved : null;
        if (!pick) {
          var list = navigator.languages || [navigator.language || "id"];
          for (var i = 0; i < list.length && !pick; i++) {
            var base = String(list[i]).toLowerCase().split("-")[0];
            if (supported.indexOf(base) > -1) pick = base;
          }
        }
        location.replace("/" + (pick || "${defaultLang}") + "/");
      }catch(e){}
    })();
  </script>
  <script>try{var s=localStorage.getItem("dbt-theme");document.documentElement.dataset.theme=s||(window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light")}catch(e){}</script>
  <script>
    /* Kalau file dibuka langsung (file://), tampilkan petunjuk singkat,
       bukan halaman yang tampak rusak tanpa penjelasan. */
    (function(){
      if (location.protocol !== "file:") return;
      document.addEventListener("DOMContentLoaded", function(){
        var n = document.createElement("div");
        n.setAttribute("role", "alert");
        n.style.cssText = "position:fixed;inset:auto 16px 16px 16px;z-index:99;padding:16px 18px;border-radius:14px;background:#0f172a;color:#fff;font:14px/1.55 system-ui,-apple-system,sans-serif;box-shadow:0 12px 32px rgba(0,0,0,.35)";
        n.innerHTML = "<strong>Halaman ini dibuka sebagai file, bukan lewat server.</strong><br>" +
          "Sebagian tampilan dan tautan tidak akan bekerja. Jalankan di Terminal:<br>" +
          "<code style='display:inline-block;margin-top:6px;padding:4px 8px;border-radius:6px;background:#1e293b'>npm run dev</code> " +
          "lalu buka <code>http://localhost:4173/id/</code>";
        document.body.appendChild(n);
      });
    })();
  </script>
</head>
<body>
<div class="aura" aria-hidden="true"><i class="b1"></i><i class="b2"></i><i class="b3"></i><span class="grain"></span></div>
<main class="pick-wrap">
  <div class="pick-head">
    ${brandMark(52)}
    <h1>${esc(site.name)}</h1>
    <p>Private tours in Bali · Choose your language</p>
  </div>
  <div class="pick-grid">${cards}</div>
  <noscript><p class="muted" style="text-align:center;margin-top:24px">Pilih bahasa di atas / Choose a language above.</p></noscript>
</main>
</body>
</html>
`;
}

/* ---------- halaman 404 ---------- */
function notFound() {
  const cards = langs
    .map((l) => `<a class="pick glass" href="/${l.code}/"><span class="pick-code">${l.short}</span><span class="pick-label">${esc(l.label)}</span></a>`)
    .join("");
  return `<!doctype html>
<html lang="id" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>404 — ${esc(site.name)}</title>
  <meta name="robots" content="noindex">
${ICON_LINKS}
  <link rel="stylesheet" href="/assets/css/styles.css?v=${ASSET_V}">
</head>
<body>
<div class="aura" aria-hidden="true"><i class="b1"></i><i class="b2"></i><i class="b3"></i><span class="grain"></span></div>
<main class="pick-wrap">
  <div class="pick-head">
    ${brandMark(52)}
    <h1>404</h1>
    <p>Halaman ini tidak ada. / This page does not exist.</p>
  </div>
  <div class="pick-grid">${cards}</div>
</main>
</body>
</html>
`;
}

/* ---------- berkas statis ---------- */
function sitemap() {
  // Tanggal build dipakai sebagai <lastmod>: Google memakai ini untuk tahu
  // kapan halaman terakhir berubah, dan mengabaikan changefreq/priority.
  const lastmod = new Date().toISOString().slice(0, 10);
  const entry = (pathFor, priority) =>
    langs
      .map((l) => {
        const alts = langs
          .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${site.url}${pathFor(a.code)}"/>`)
          .join("\n");
        return `  <url>
    <loc>${site.url}${pathFor(l.code)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
${alts}
  </url>`;
      })
      .join("\n");
  const urls = entry((c) => `/${c}/`, "1.0") + "\n" + entry((c) => `/${c}/rental/`, "0.9");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
}

const HEADERS = `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https://cloudflareinsights.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://wa.me https://api.whatsapp.com

/assets/*
  Cache-Control: public, max-age=31536000, immutable

${ADMIN_PATH}*
  X-Robots-Tag: noindex, nofollow
  Cache-Control: no-store

/favicon.ico
  Cache-Control: public, max-age=86400
`;

const ROBOTS = `User-agent: *
Allow: /
Disallow: ${ADMIN_PATH}
Disallow: /api/

Sitemap: ${site.url}/sitemap.xml
`;

/* ---------- jalankan ---------- */
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(out("assets", "css"), { recursive: true });
fs.mkdirSync(out("assets", "js"), { recursive: true });
fs.mkdirSync(out("assets", "img"), { recursive: true });

for (const l of langs) {
  fs.mkdirSync(out(l.code), { recursive: true });
  fs.writeFileSync(out(l.code, "index.html"), page(l.code));
}

for (const l of langs) {
  fs.mkdirSync(out(l.code, "rental"), { recursive: true });
  fs.writeFileSync(out(l.code, "rental", "index.html"), rentalPage(l.code));
}

const adminDir = path.join(DIST, ...ADMIN_DIR.split("/").filter(Boolean));
fs.mkdirSync(adminDir, { recursive: true });
fs.writeFileSync(path.join(adminDir, "index.html"), adminPage());

/* seed + i18n untuk Cloudflare Functions (dibundel saat deploy) */
const fnDir = path.join(ROOT, "functions", "_lib");
fs.mkdirSync(fnDir, { recursive: true });
fs.copyFileSync(path.join(ROOT, "content/content.mjs"), path.join(fnDir, "content.js"));
fs.writeFileSync(
  path.join(fnDir, "seed.js"),
  `/* dibuat otomatis oleh build.mjs — jangan diedit manual */\nexport const seed = ${JSON.stringify(
    { settings: settingsSeed(), tours, rentals },
    null,
    2
  )};\n`
);

fs.writeFileSync(out("index.html"), rootPage());
fs.writeFileSync(out("404.html"), notFound());
fs.writeFileSync(out("sitemap.xml"), sitemap());
fs.writeFileSync(out("robots.txt"), ROBOTS);
fs.writeFileSync(out("_headers"), HEADERS);

fs.copyFileSync(path.join(ROOT, "assets/css/styles.css"), out("assets", "css", "styles.css"));
fs.copyFileSync(path.join(ROOT, "assets/js/app.js"), out("assets", "js", "app.js"));
fs.mkdirSync(out("assets", "admin"), { recursive: true });
for (const f of ["admin.css", "admin.js"]) {
  const src = path.join(ROOT, "assets/admin", f);
  if (fs.existsSync(src)) fs.copyFileSync(src, out("assets", "admin", f));
}
/* og.jpg tetap di root (dipakai crawler sosial). Ikon SVG + apple-touch-icon
   disalin ke /assets/img/ agar URL-nya bisa di-cache immutable dengan ?v=. */
for (const f of ["og.jpg"]) {
  const p = path.join(ROOT, "assets/img", f);
  if (fs.existsSync(p)) fs.copyFileSync(p, out(f));
}

/* favicon.ico di root — browser meminta path ini otomatis, tanpa <link>. */
{
  const p = path.join(ROOT, "assets/img", "favicon.ico");
  if (fs.existsSync(p)) fs.copyFileSync(p, out("favicon.ico"));
}

/* Ikon versi-panjang di /assets/img/ (sudah dicakup aturan /assets/* immutable). */
for (const f of ["favicon.svg", "apple-touch-icon.png"]) {
  const p = path.join(ROOT, "assets/img", f);
  if (fs.existsSync(p)) fs.copyFileSync(p, out("assets", "img", f));
}

/* cek kelengkapan teks */
let warn = 0;
for (const l of langs) {
  for (const k of Object.keys(copy[defaultLang])) {
    if (!copy[l.code]?.[k]) {
      console.warn(`⚠️  ${l.code}: teks "${k}" kosong`);
      warn++;
    }
  }
}
const bytes = (p) => fs.statSync(p).size;
console.log(`✓ dist/ dibuat — ${langs.length} halaman bahasa + halaman pemilih`);
console.log(`  index (${(bytes(out("id", "index.html")) / 1024).toFixed(1)} KB) · css ${(bytes(out("assets/css/styles.css")) / 1024).toFixed(1)} KB · js ${(bytes(out("assets/js/app.js")) / 1024).toFixed(1)} KB`);
console.log(`  asset version: ${ASSET_V}${warn ? ` · ${warn} peringatan teks` : ""}`);
console.log(
  BEACON_READY
    ? "  Cloudflare Web Analytics: beacon aktif"
    : "  Cloudflare Web Analytics: token belum diisi → beacon dilewati (lihat README §6)"
);