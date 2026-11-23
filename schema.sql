-- Skema D1 untuk panel admin.
-- API membuat tabel ini otomatis saat pertama dipakai,
-- jadi file ini hanya untuk setup manual / referensi.

CREATE TABLE IF NOT EXISTS site_data (
  id         INTEGER PRIMARY KEY,
  json       TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Data awal diisi otomatis dari functions/_lib/seed.js (hasil build).