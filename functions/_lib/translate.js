/* ============================================================
   Terjemahan otomatis (Indonesia → 5 bahasa lain) memakai
   Cloudflare Workers AI.

   Dipakai supaya admin cukup mengedit teks bahasa Indonesia,
   lalu versi en/de/fr/es/ru dibuat sendiri oleh mesin.

   Semua fungsi di sini MURNI tambahan: kalau binding AI tidak
   ada (mis. dev server lokal), pemanggil harus siap menerima
   error dan jatuh kembali ke perilaku lama (isi manual).
   ============================================================ */

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const LANG_NAMES = {
  en: "English",
  de: "German",
  fr: "French",
  es: "Spanish",
  ru: "Russian",
};

/** Nama tempat yang TIDAK boleh diterjemahkan mesin. */
const PROPER_NOUNS = [
  "Ubud", "Tegalalang", "Tegenungan", "Saraswati", "Monkey Forest", "Batur",
  "Kintamani", "Tanah Lot", "Uluwatu", "Nusa Penida", "Nusa Dua", "Seminyak",
  "Canggu", "Sanur", "Jimbaran", "Denpasar", "Kuta", "Bedugul", "Jatiluwih",
  "Dewa Bali Tour", "Bali", "Avanza", "Xenia", "Innova", "Hiace", "Vario",
  "NMAX", "PCX", "Beat", "GoPro",
];

/** Kunci teks yang boleh diterjemahkan, beserta jenis isinya. */
const TOUR_SHAPE = {
  name: "string",
  tagline: "string",
  includes: "lines",
  description: "string",
  itinerary: "lines",
};

const RENTAL_SHAPE = {
  name: "string",
  tagline: "string",
  includes: "lines",
  description: "string",
};

function sysPrompt(shape, targetName) {
  const spec = Object.entries(shape)
    .map(([k, v]) => `  "${k}": ${v === "lines" ? '["satu baris", "baris lain"]' : '"teks"'}`)
    .join(",\n");
  return `You translate website copy for a Bali tour and car-rental company from Indonesian into ${targetName}.

Return ONLY a single valid JSON object. No markdown fences, no explanation, no text before or after.
Use EXACTLY this shape, keeping the same number of array items as the input:
{
${spec}
}

Translation rules:
- Write natural, marketing-quality ${targetName} that a native speaker would put on a real travel website. Never translate word-for-word.
- Keep these names exactly as written (do not translate or transliterate): ${PROPER_NOUNS.join(", ")}.
- Keep clock times exactly as given (e.g. "08.00 —"), keep "Rp" and all numbers unchanged.
- Keep the "—" separator inside itinerary lines.
- Never add facts, prices, promises, ratings, or years that are not in the source.
- Never invent testimonials, review counts, or years of experience.
- If a field is an empty string or empty array, return it empty.
- Output must be parseable by JSON.parse().`.trim();
}

/** Ambil JSON dari balasan model yang kadang membungkusnya dengan ```json. */
function extractJson(raw) {
  if (raw && typeof raw === "object") return raw;
  let s = String(raw ?? "").trim();
  if (!s) throw new Error("Balasan mesin terjemahan kosong.");
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  return JSON.parse(s);
}

function asText(v, max) {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > max ? s.slice(0, max).trim() : s;
}

function asLines(v, maxItems, maxLen) {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => asText(x, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

/** Rapikan hasil mesin supaya bentuknya sama dengan yang divalidasi API. */
function shapeResult(raw, shape) {
  const out = {};
  for (const [key, kind] of Object.entries(shape)) {
    if (kind === "lines") {
      const maxItems = key === "itinerary" ? 12 : 6;
      out[key] = asLines(raw[key], maxItems, key === "itinerary" ? 200 : 120);
    } else {
      const max = key === "tagline" ? 240 : key === "description" ? 1200 : 120;
      out[key] = asText(raw[key], max);
    }
  }
  return out;
}

/**
 * Terjemahkan satu blok teks.
 * @param {object} ai       binding Workers AI (env.AI)
 * @param {object} source   objek bahasa sumber (mis. data.t.id)
 * @param {string} target   kode bahasa tujuan ("en"|"de"|"fr"|"es"|"ru")
 * @param {object} shape    TOUR_SHAPE atau RENTAL_SHAPE
 * @returns {Promise<object>} objek dengan bentuk sama seperti `shape`
 */
export async function translateBlock(ai, source, target, shape) {
  if (!ai) throw new Error("Fitur terjemahan otomatis belum aktif di server ini.");
  const name = LANG_NAMES[target];
  if (!name) throw new Error(`Bahasa tujuan tidak dikenal: ${target}`);

  /* Hanya kirim field yang memang ada di shape — jangan bocorkan field lain. */
  const payload = {};
  for (const [key, kind] of Object.entries(shape)) {
    payload[key] = kind === "lines" ? asLines(source?.[key], 12, 200) : asText(source?.[key], 1200);
  }

  const res = await ai.run(MODEL, {
    messages: [
      { role: "system", content: sysPrompt(shape, name) },
      { role: "user", content: `Translate this JSON from Indonesian to ${name}:\n${JSON.stringify(payload, null, 2)}` },
    ],
    max_tokens: 1600,
    temperature: 0.15,
  });

  const parsed = extractJson(res?.response ?? res);
  const shaped = shapeResult(parsed, shape);

  /* Jangan pernah menimpa dengan hasil kosong: kalau model gagal, lebih baik
     simpan teks Indonesia daripada menghapus isi yang sudah benar. */
  const fallback = source?.t?.id || source;
  for (const [key, kind] of Object.entries(shape)) {
    if (kind === "lines") {
      if (!shaped[key].length) shaped[key] = asLines(source?.[key], 12, 200);
    } else if (!shaped[key]) {
      shaped[key] = asText(source?.[key], 1200);
    }
  }
  void fallback;

  return shaped;
}

/** Terjemahkan ke beberapa bahasa sekaligus (berurutan supaya tidak kena limit). */
export async function translateAll(ai, source, shape, targets) {
  const out = {};
  for (const code of targets) {
    out[code] = await translateBlock(ai, source, code, shape);
  }
  return out;
}

export const TRANSLATE_SHAPES = { tour: TOUR_SHAPE, rental: RENTAL_SHAPE };
export const TRANSLATE_TARGETS = ["en", "de", "fr", "es", "ru"];
