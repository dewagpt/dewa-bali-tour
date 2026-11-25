/* Penyimpanan data situs.
   Produksi : Cloudflare D1 (satu baris JSON — sederhana & cukup untuk skala ini)
   Lokal    : functions/_lib/store.node.js (file JSON) — diimpor hanya oleh dev server. */

import { seed } from "./seed.js";
import { copy as copyBase } from "./content.js";

export class D1Store {
  constructor(db) {
    this.db = db;
    this.ready = null;
  }

  async init() {
    if (!this.ready) {
      this.ready = this.db
        .prepare(
          "CREATE TABLE IF NOT EXISTS site_data (id INTEGER PRIMARY KEY, json TEXT NOT NULL, updated_at TEXT NOT NULL)"
        )
        .run()
        .catch(() => null);
    }
    return this.ready;
  }

  async read() {
    await this.init();
    const row = await this.db.prepare("SELECT json FROM site_data WHERE id = 1").first();
    return row?.json ? JSON.parse(row.json) : null;
  }

  async write(data) {
    await this.init();
    await this.db
      .prepare(
        `INSERT INTO site_data (id, json, updated_at) VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`
      )
      .bind(JSON.stringify(data), new Date().toISOString())
      .run();
  }
}

/** Lengkapi terjemahan yang belum ada (mis. field baru seperti description/itinerary)
    memakai nilai dari seed untuk id yang sama — supaya data lama tetap kompatibel. */
function mergeLang(item, baseItem) {
  if (!baseItem?.t) return item;
  const t = {};
  for (const [lang, val] of Object.entries(item.t || {})) {
    t[lang] = { ...(baseItem.t[lang] || {}), ...val };
  }
  return { ...item, t };
}

/** Samakan bentuk bagian `copy` (teks halaman yang disunting admin).
    Hanya kunci yang isinya teks non-kosong yang disimpan, dan hanya untuk
    bahasa yang dikenal — supaya data asing tidak pernah ikut tersimpan. */
function normalizeCopy(value, base) {
  const out = {};
  if (!value || typeof value !== "object") return out;
  for (const lang of Object.keys(value)) {
    if (!base[lang]) continue; // bahasa tidak dikenal
    const src = value[lang];
    if (!src || typeof src !== "object") continue;
    const bag = {};
    for (const [k, v] of Object.entries(src)) {
      if (!(k in base[lang])) continue; // kunci tidak dikenal
      if (typeof v !== "string" || !v.trim()) continue;
      bag[k] = v.slice(0, 4000);
    }
    if (Object.keys(bag).length) out[lang] = bag;
  }
  return out;
}

/** Normalisasi agar data lama/tidak lengkap tetap aman dipakai. */
export function normalize(data) {
  const base = structuredClone(seed);
  if (!data || typeof data !== "object") return base;
  return {
    ...(data.auth && data.auth.passwordHash ? { auth: data.auth } : {}),
    copy: normalizeCopy(data.copy, copyBase),
    settings: { ...base.settings, ...(data.settings || {}) },
    tours: (Array.isArray(data.tours) ? data.tours : base.tours).map((t) => {
      const merged = mergeLang(t, base.tours.find((b) => b.id === t.id));
      const seeded = base.tours.find((b) => b.id === t.id)?.soloPrice;
      const solo = Number(merged.soloPrice);
      return {
        ...merged,
        soloPrice: Number.isFinite(solo) && solo > 0 ? Math.round(solo) : seeded || Math.round((Number(merged.price) || 0) * 1.4),
      };
    }),
    rentals: (Array.isArray(data.rentals) ? data.rentals : base.rentals).map((r) => {
      const merged = mergeLang(r, base.rentals.find((b) => b.id === r.id));
      return {
        ...merged,
        driverFee: Number.isFinite(Number(merged.driverFee))
          ? Number(merged.driverFee)
          : base.rentals.find((b) => b.id === r.id)?.driverFee || 0,
      };
    }),
    updatedAt: data.updatedAt || null,
  };
}

/** Baca data; kalau kosong, isi otomatis dengan seed. */
export async function ensureData(store) {
  const existing = await store.read();
  if (!existing) {
    const fresh = normalize(seed);
    await store.write(fresh);
    return fresh;
  }
  return normalize(existing);
}

export async function saveData(store, data) {
  const next = { ...data, updatedAt: new Date().toISOString() };
  await store.write(next);
  return next;
}