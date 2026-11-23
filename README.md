# Dewa Bali Tour — situs 6 bahasa, rental, dan panel admin

Situs statis untuk **dewabalitour.com** dengan gaya *liquid glass* (kaca tembus pandang, aurora, mode terang/gelap), ditambah **halaman rental kendaraan** dan **panel admin** yang bisa CRUD data situs.

| Halaman | URL |
| --- | --- |
| Beranda (ID) | `/id/` |
| Beranda (EN/DE/FR/ES/RU) | `/en/` · `/de/` · `/fr/` · `/es/` · `/ru/` |
| Rental | `/id/rental/` (dan `/en/rental/`, dst.) |
| Admin | `/dewa-200280-bali/` (bisa diganti) |

`/` otomatis mengarahkan pengunjung ke bahasa browser mereka (fallback Indonesia).

**Stack:** HTML/CSS/JS tanpa framework + Cloudflare Pages Functions (API) + Cloudflare D1 (database) + Cloudflare Web Analytics.

---

## 1. Jalankan di komputer

```bash
node build.mjs            # hasilkan dist/ (6 bahasa + rental + admin)
npm run dev               # build + server lokal dengan API & database file
```

Buka **http://localhost:4173/id/** — admin di **http://localhost:4173/dewa-200280-bali/**

Login awal:

| | |
| --- | --- |
| Nama pengguna | `dewa-200280-bali` |
| Kata sandi | `dewa-200280-bali` |

Data lokal disimpan di `.data/site.json` (bukan di dalam `dist/`), jadi aman untuk eksperimen. Hapus file itu untuk kembali ke data awal.

```bash
npm run check   # pastikan semua terjemahan & data lengkap
npm run preview # pratinjau statis saja (tanpa API admin)
```

Butuh Node.js 20 atau lebih baru.

### Halaman tidak bisa dibuka? Cek ini dulu

**Jangan klik dua kali `dist/index.html`.** Situs ini butuh server: semua tautan, CSS, dan JavaScript memakai path absolut (`/assets/...`, `/id/`). Kalau dibuka sebagai file (`file://`), halaman akan kosong atau tanpa gaya dan ada peringatan di pojok bawah.

Selalu jalankan:

```bash
npm run dev
```

lalu buka `http://localhost:4173/id/` di browser.

**Kalau muncul "Port 4173 sudah dipakai proses lain"** — biasanya server lama masih hidup di latar belakang:

```bash
lsof -ti tcp:4173 | xargs kill     # hentikan server lama
npm run dev                        # jalankan lagi
```

Atau pakai port lain: `node scripts/dev-server.mjs 4174` → buka `http://localhost:4174/id/`.

**Kalau `npm run dev` berhenti dengan error** — pastikan Node.js versi 20+ (`node -v`). Proyek ini tanpa dependensi, jadi tidak perlu `npm install`.

**Kalau yang dibuka situs yang sudah online** — alamatnya harus domain hasil deploy (mis. `https://namaproyek.pages.dev/id/`), bukan `http://situs-anda`.

---

## 2. Struktur proyek

```
content/content.mjs        ← edit teks, harga, paket tour, kendaraan, kontak
build.mjs                  ← generator 6 halaman + rental + admin + seed + sitemap

assets/css/styles.css      ← desain situs publik
assets/js/app.js           ← tema, menu, filter, animasi, form WhatsApp, hidrasi data
assets/admin/admin.css     ← tampilan panel admin
assets/admin/admin.js      ← login, daftar, editor, CRUD

functions/api/[[path]].js  ← entry Cloudflare Pages Functions (/api/*)
functions/_lib/api.js      ← routing API + validasi
functions/_lib/auth.js     ← sesi cookie HttpOnly, rate limit login
functions/_lib/crypto.js   ← PBKDF2 & HMAC (Web Crypto)
functions/_lib/store.js    ← penyimpanan D1
functions/_lib/store.node.js ← penyimpanan file (hanya dev)
functions/_lib/config.js   ← kredensial default & masa sesi
functions/_lib/seed.js     ← data awal (dibuat otomatis oleh build)
functions/_lib/content.js  ← salinan konten untuk server (dibuat otomatis)

scripts/dev-server.mjs     ← server lokal: dist + API
scripts/serve.mjs          ← server statis saja
scripts/check.mjs          ← verifikasi terjemahan
scripts/hash-password.mjs  ← buat hash kata sandi admin
scripts/audit.js, shot.mjs, shoot.sh ← alat QA layout & screenshot

wrangler.toml              ← konfigurasi Pages + binding D1
schema.sql                 ← skema tabel D1
dist/                      ← HASIL BUILD (yang di-deploy)
```

> `functions/_lib/seed.js` dan `functions/_lib/content.js` **dibuat ulang** setiap `node build.mjs`. Jangan mengedit keduanya.

---

## 3. Mengedit konten

### Kontak & nomor WhatsApp

`content/content.mjs` → `export const site`:

```js
phoneE164: "6281234567890",   // tanpa + dan spasi (dipakai wa.me)
phoneDisplay: "+62 812 3456 7890",
email: "hello@dewabalitour.com",
```

Kalau situs sudah punya database (D1), nomor ini sebaiknya diubah lewat **Admin → Pengaturan**, karena data di database menimpa nilai bawaan.

### Paket tour & kendaraan

Masih di `content/content.mjs`:

```js
export const tours = [ { id, category, art, price, hours, featured, photo, t: { id:{…}, en:{…}, … } } ];
export const rentals = [ { id, type, art, price, featured, photo, t: { … } } ];
```

`type` rental: `car` atau `bike`. `art`: ilustrasi cadangan (`terrace|island|volcano|temple|river|gate|car|bike`).

Setelah mengubah, jalankan `node build.mjs`. Data di database tidak otomatis berubah — untuk situs yang sudah live, gunakan panel admin.

### Penjelasan tour & itinerary

Setiap paket punya empat lapis teks per bahasa:

| Field | Tampil di |
| --- | --- |
| `name`, `tagline` | kartu di halaman tour |
| `description` | bagian **“Tentang tour ini”** di dialog booking |
| `itinerary` (array, satu langkah per baris, mis. `06.30 — Jemput di hotel`) | bagian **“Rencana perjalanan”** di dialog booking |
| `includes` | daftar **“Sudah termasuk”** di kartu dan dialog |

Semuanya bisa diedit dari panel admin (tab **Paket Tour** → Edit → pilih tab bahasa) atau langsung di `content/content.mjs`. Rental memakai `description` opsional — kalau dikosongkan, `tagline` yang dipakai.

### Teks antarmuka (189 kunci × 6 bahasa)

Blok `export const copy`. `npm run check` menandai kunci yang tertinggal di salah satu bahasa.

---

## 4. Foto asli

Situs tetap rapi tanpa foto (memakai ilustrasi vektor). Begitu file ada, foto otomatis dipakai:

| File | Dipakai di |
| --- | --- |
| `assets/img/hero.jpg` | foto besar paling atas halaman **tour** (beranda) |
| `assets/img/rental-hero.jpg` | foto besar paling atas halaman **rental** |
| `assets/img/tours/<id>.jpg` | kartu paket (`ubud.jpg`, `penida.jpg`, …) |
| `assets/img/rental/<id>.jpg` | kartu kendaraan (`avanza.jpg`, `nmax.jpg`, …) |

Kartu tour & kendaraan memakai fotonya begitu file ada. Untuk dua foto hero, kolomnya sengaja dibiarkan **kosong** di awal supaya halaman memakai ilustrasi bawaan; isi kolomnya (atau unggah dari admin) saat fotonya sudah siap — lihat bagian di bawah.

Jalankan `node build.mjs` setelah menaruh file. Kalau foto gagal dimuat, kartu kembali ke ilustrasi — tidak ada gambar rusak.

Foto juga bisa diunggah langsung dari panel admin (disimpan di Cloudflare R2 dan disajikan lewat `/api/media/...`) — lihat bagian **Mengelola foto dari admin** di bawah.

### Mengganti foto hero (paling atas halaman)

Ada dua cara. **Cara pertama tidak perlu menyentuh kode sama sekali.**

**Cara 1 — dari panel admin (disarankan)**

1. Buka `/dewa-200280-bali/` lalu masuk.
2. Klik tab **Pengaturan**.
3. Di bagian **“Foto hero (bagian paling atas halaman)”** ada dua kotak:
   - **Halaman Tour (beranda)** — foto besar di atas halaman tour.
   - **Halaman Rental** — foto besar di atas halaman rental.
4. Klik **Unggah foto**, pilih file JPG/PNG/WebP. Foto otomatis dikompres ke maksimal 1600 px dan langsung tampil di pratinjau.
   Bisa juga menempel URL/path di kolom teks, misal `/api/media/img/namafile.jpg`.
5. Klik **Simpan pengaturan**. Selesai — perubahan langsung terlihat di situs, tanpa build ulang.

Tombol **Hapus foto** mengosongkan kolom; setelah disimpan, halaman kembali memakai ilustrasi bawaan.

**Cara 2 — lewat file (foto ikut ter-build, tanpa panel admin)**

1. Simpan foto sebagai `assets/img/hero.jpg` (halaman tour) dan `assets/img/rental-hero.jpg` (halaman rental).
2. Buka `content/content.mjs`, isi path-nya:
   ```js
   heroPhoto: "/assets/img/hero.jpg",
   rentalHeroPhoto: "/assets/img/rental-hero.jpg",
   ```
3. Jalankan `node build.mjs`, lalu deploy ulang.

**Ukuran yang disarankan:** lanskap sekitar 1600 × 900 px (perbandingan 16:9). Foto dipotong otomatis mengikuti kotaknya (`object-fit: cover`), jadi bagian tengah foto adalah yang paling terlihat — letakkan subjek di tengah.

> Catatan: foto dari admin disimpan di database/R2, jadi **menang** atas file di `assets/img/`. Kalau sudah pernah mengunggah lewat admin, mengganti file di disk tidak akan berpengaruh sampai kolom hero dikosongkan lewat panel.

---

## 5. Panel admin

**URL:** `/dewa-200280-bali/` — diatur di `content/content.mjs`:

```js
adminPath: "/dewa-200280-bali/",   // ganti kapan saja, lalu node build.mjs
showAdminLink: false,              // false = tautan "Admin" tidak muncul di footer
```

Tautan ke panel ini sengaja **tidak** dipasang di footer, dan `/admin/` biasa mengembalikan 404 — orang yang menebak-nebak tidak menemukan form login. Ini hanya lapisan ketidakjelasan, **bukan** pengganti autentikasi: keamanan sesungguhnya ada pada kredensial + sesi di bawah. Halaman ini juga `noindex`, diblokir di `robots.txt`, dan memakai header `X-Robots-Tag: noindex` + `Cache-Control: no-store`.

Isi panel:

| Tab | Yang bisa dilakukan |
| --- | --- |
| **Paket Tour** | tambah/edit/hapus paket: harga, durasi, kategori, ilustrasi, foto, unggulan, dan teks 6 bahasa — termasuk **penjelasan tour** + **rencana perjalanan (itinerary)** |
| **Rental** | tambah/edit/hapus kendaraan: harga harian, mobil/motor, foto, teks 6 bahasa |
| **Pengaturan** | nomor WhatsApp, nomor tampil, email, sosial media, alamat & jam operasional per bahasa, serta **foto hero** halaman tour & rental |

Perubahan **langsung tampil di situs publik** tanpa build ulang: halaman mengambil data dari `/api/data`, lalu mengganti kartu tour/rental serta nomor kontak bila datanya berbeda dari versi statis. Halaman statis tetap menjadi fallback untuk SEO dan pengunjung tanpa JavaScript.

> Setelah banyak perubahan, jalankan `node build.mjs` dan deploy ulang agar versi statis (dan SEO) ikut menyegar.

### Alur tamu memesan (jumlah 3 / 5 / 7 orang)

1. Tamu membuka beranda → seksi **“Enam cara menikmati Bali”**, bisa disaring lewat tombol **Semua / Budaya / Petualangan / Island hopping**.
2. Setiap kartu menampilkan durasi, 3 poin yang sudah termasuk, dan **harga per orang**.
3. Tombol **Booking** membuka dialog berisi **penjelasan tour** (“Tentang tour ini”), **rencana perjalanan** (itinerary berurutan dengan jam keberangkatan), daftar **sudah termasuk**, lalu pilihan **2 / 3 / 5 / 7** (tombol cepat) atau stepper **2–12 tamu**.
4. Total dihitung otomatis (harga per orang × jumlah tamu) dan langsung terlihat, mis. 7 tamu × Rp 1.250.000 = **Rp 8.750.000**.
5. **Lanjut ke WhatsApp** membuka chat dengan pesan yang sudah terisi: nama paket, jumlah tamu, dan estimasi total. Tamu tinggal kirim.
6. Catatan: minimum 2 tamu, anak di bawah 5 tahun gratis, dan harga final dikonfirmasi lewat WhatsApp (bisa berubah untuk rombongan besar atau tanggal libur).

Di halaman **Rental**, dialog yang sama sedikit berbeda karena sewa dihitung per unit dan per hari:

- **Durasi (hari)** 1–30 — bisa lewat tombol cepat 1/2/3/5/7 atau stepper
- **Jumlah unit** 1–5 (mis. 2 mobil untuk rombongan)
- **Sopir:** *Lepas kunci* atau *Dengan sopir*. Opsi ini hanya muncul untuk kendaraan yang punya biaya sopir > 0 (motor tidak punya opsi sopir).
- **Total** = (harga harian + biaya sopir bila dipilih) × jumlah unit × jumlah hari.

Contoh: Toyota Avanza Rp 450.000/hari + sopir Rp 150.000, 2 unit, 3 hari → (450.000 + 150.000) × 2 × 3 = **Rp 3.600.000**.

Biaya sopir per kendaraan diatur di `content/content.mjs` (field `driverFee`, 0 = tanpa opsi sopir) dan bisa diubah dari **Admin → Rental → Edit → Biaya sopir / hari**.

Form kontak di beranda tetap tersedia untuk permintaan khusus (tanggal, jumlah tamu, catatan alergi/kebutuhan lain).

### Mengelola foto dari admin

Di editor paket tour maupun kendaraan ada blok **Foto**:

- **Unggah foto** → pilih JPG/PNG/WebP (maks 4 MB). Gambar otomatis dikompres ke lebar maks 1600 px (JPEG kualitas 85) sebelum dikirim, lalu disimpan dan URL-nya diisi otomatis.
- **Hapus foto** → kembali ke ilustrasi vektor.
- **Tempel URL/path** → kalau foto sudah ada di tempat lain (mis. `/assets/img/tours/ubud.jpg` atau URL https).

Penyimpanan:

| Lingkungan | Tempat foto |
| --- | --- |
| Lokal (`npm run dev`) | `.data/uploads/img/...`, disajikan lewat `/api/media/...` |
| Cloudflare | Bucket R2 `dewabalitour-media`, binding `BUCKET` |

Mengaktifkan R2 (sekali saja):

```bash
npx wrangler r2 bucket create dewabalitour-media
```

Lalu di Cloudflare Pages → **Settings → Functions → R2 bucket bindings** → Variable name `BUCKET` → pilih bucket tadi (atau pakai `wrangler.toml` yang sudah disiapkan). Tanpa R2, tombol unggah mengembalikan pesan jelas — foto via URL tetap bisa.

Catatan: foto hasil unggah hanya muncul lewat hidrasi JavaScript. Untuk tampilan tanpa JS dan SEO gambar, tetap simpan foto utama di `assets/img/` lalu build ulang.

### Mengganti username & kata sandi

**Cara termudah — dari panel admin:**

1. Masuk ke panel → tab **Keamanan**.
2. Isi **kata sandi saat ini**, **nama pengguna baru**, **kata sandi baru** (min. 10 karakter) dan ulangi.
3. Klik **Simpan kredensial**.

Kedua kolom bersifat bebas: ganti **nama pengguna saja**, **kata sandi saja**, atau **keduanya sekaligus**.

Kredensial baru disimpan di database (D1) dalam bentuk hash PBKDF2-SHA256 — bukan teks biasa. Setelah disimpan:

- login berikutnya harus memakai nama pengguna **dan** kata sandi yang baru,
- semua **sesi login lain langsung berakhir** (sesi lama ditolak dengan pesan "Kredensial berubah") — berlaku juga kalau hanya nama pengguna yang diganti,
- sesi Anda sendiri tetap aktif (cookie diterbitkan ulang),
- tab Keamanan menampilkan nama pengguna aktif, sumber kredensial, dan waktu perubahan terakhir.

**Cadangan kalau lupa kata sandi** (lewat server, tanpa perlu bisa login):

```bash
node scripts/hash-password.mjs "kata-sandi-baru-yang-panjang"
```

Lalu di Cloudflare → Pages → **Settings → Environment variables** (mode *Secret*):

| Nama | Nilai |
| --- | --- |
| `ADMIN_USER` | nama pengguna darurat |
| `ADMIN_PASSWORD_HASH` | hasil perintah di atas (`pbkdf2$…`) |
| `ADMIN_RESET` | `1` — memaksa kredensial dari server dipakai, mengabaikan yang tersimpan di panel |

Masuk dengan kredensial darurat itu, ganti lagi dari tab **Keamanan**, lalu hapus `ADMIN_RESET` supaya kredensial panel berlaku kembali.

Kalau belum pernah mengganti dari panel, situs memakai nilai bawaan di `functions/_lib/config.js` (`dewa-200280-bali` / `dewa-200280-bali`) — **ganti sebelum tayang**.

### Lupa kata sandi (reset lewat email)

Di halaman login ada tombol **Lupa kata sandi?** → isi nama pengguna admin → sistem mengirim **tautan reset ke email admin**. Tautan berlaku **30 menit** dan **hanya bisa dipakai sekali**; setelah kata sandi baru disimpan, semua sesi login lain otomatis berakhir.

Halaman reset punya dua kolom: **Nama pengguna baru (opsional)** dan **Kata sandi baru**. Kosongkan kolom nama pengguna kalau hanya ingin mengganti kata sandi — atau isi kalau ingin mengganti keduanya sekaligus (misalnya karena nama pengguna lama sudah tidak cocok).

Syaratnya satu: layanan pengirim email. Cloudflare Workers/Pages tidak bisa kirim email lewat SMTP, jadi memakai HTTP API. Contoh di `functions/_lib/mail.js` memakai **Resend** (gratis 3.000 email/bulan, cukup untuk reset):

| Environment variable | Keterangan |
| --- | --- |
| `RESEND_API_KEY` | API key dari resend.com — **wajib** untuk mengirim email |
| `ADMIN_EMAIL` | alamat penerima tautan reset (disarankan; kalau kosong dipakai email di Pengaturan) |
| `MAIL_FROM` | pengirim, mis. `Dewa Bali Tour <no-reply@dewabalitour.com>` (opsional) |

Langkah: daftar di resend.com → verifikasi domain `dewabalitour.com` → buat API key → tempel sebagai secret di Cloudflare Pages → **Settings → Environment variables**.

Alternatif penyedia (SendGrid, Postmark, Amazon SES, Brevo) bisa dipakai dengan mengganti isi `sendMail()` di `functions/_lib/mail.js` — antarmukanya hanya `fetch` ke endpoint HTTP.

**Saat mengembangkan di komputer** (tanpa `RESEND_API_KEY`), tautan reset tidak dikirim lewat email tetapi ditampilkan langsung di form "Lupa kata sandi?" sebagai *mode lokal* — jadi alurnya tetap bisa diuji. Di produksi, tanpa API key endpoint mengembalikan pesan jelas dan tidak ada tautan yang dibocorkan.

Keamanan alur ini:

- Respons selalu generik ("kalau nama pengguna cocok, tautan dikirim") sehingga orang tidak bisa menebak nama pengguna admin.
- Token 32 byte acak, disimpan di database sebagai **hash SHA-256** (bukan token mentah), dengan masa berlaku + status sekali pakai.
- Permintaan reset dibatasi **3 kali / 15 menit per IP**; percobaan berlebih → `429`.
- Tautan reset adalah satu-satunya jalur tanpa login — kalau lebih suka tanpa email, cukup andalkan pemulihan `ADMIN_PASSWORD_HASH` + `ADMIN_RESET`.

Sesi disimpan sebagai cookie `HttpOnly`, `SameSite=Strict`, `Secure` (HTTPS), berlaku 12 jam, dan ditandatangani HMAC-SHA256. Keamanan lain: login dibatasi 6 percobaan / 10 menit per IP, semua endpoint tulis memeriksa `Origin` + header `X-Requested-With`, validasi server-side untuk setiap field, dan panel admin `noindex` di path rahasia.

---

## 6. Deploy ke Cloudflare Pages

### 6a. Tanpa database (situs saja)

`node build.mjs` → upload folder `dist` lewat **Workers & Pages → Create → Pages → Upload assets**. Rental & admin tidak akan berfungsi penuh tanpa Functions/D1.

### 6b. Dengan admin + database (disarankan)

**1. Buat database D1**

```bash
npx wrangler login
npx wrangler d1 create dewabalitour
```

Salin `database_id` ke `wrangler.toml`.

**2. Deploy**

```bash
node build.mjs
npx wrangler pages deploy dist --project-name dewabalitour
```

Atau lewat Git: **Connect to Git** → Build command `node build.mjs`, Output directory `dist`, Framework preset `None`.

**3. Binding database**

Pages → project → **Settings → Functions → D1 database bindings** → tambah:

| Variable name | Database |
| --- | --- |
| `DB` | `dewabalitour` |

(Bisa juga dipasang lewat `wrangler.toml` yang sudah disiapkan.)

**4. Secrets**

Settings → Environment variables:

```
SESSION_SECRET      = <string acak panjang>
ADMIN_USER          = dewa-200280-bali        (opsional)
ADMIN_PASSWORD_HASH = pbkdf2$…                (opsional)
```

**5. Domain**

Custom domains → `dewabalitour.com` → Activate. Hapus record `A/AAAA` lama yang menunjuk server lain. Tambahkan `www.dewabalitour.com` + Redirect Rule 301 ke apex. Aktifkan **Always Use HTTPS** & **HSTS**.

**6. Isi data awal**

Tidak perlu seeding manual: saat `/api/data` pertama kali dipanggil, API membuat tabel `site_data` dan mengisinya dari `functions/_lib/seed.js`. Panel admin lalu mengelola data itu.

---

## 7. Cloudflare Web Analytics

Analytics memakai beacon tanpa cookie (tanpa banner consent), dimuat `defer`.

Dashboard → **Analytics → Web Analytics → Add a site** → isi `dewabalitour.com` → salin token ke `content/content.mjs`:

```js
cfBeaconToken: "abcd1234…",
```

lalu build & deploy ulang. Kalau Anda memakai **Automatic setup** Cloudflare, kosongkan token (`""`) agar tidak terhitung dua kali. Selama token masih placeholder, beacon tidak dimuat.

---

## 8. Yang sudah dipasang

- **SEO**: title/description per bahasa, canonical, hreflang 6 bahasa + `x-default`, OG/Twitter (`og.jpg` 1200×630), JSON-LD `TravelAgency` + rating, `sitemap.xml` (beranda + rental), `robots.txt`.
- **Keamanan**: `_headers` (HSTS, CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy, cache aset immutable), admin `noindex` + `no-store`, sesi HttpOnly + HMAC, rate limit login, validasi server-side, CSP ramah static hosting.
- **Aksesibilitas**: skip link, fokus terlihat, label ARIA, `aria-pressed` pada filter, `prefers-reduced-motion`, kontras tinggi di terang/gelap.
- **Performa**: tanpa framework, font sistem, CSS ± 49 KB, JS ± 24 KB, ilustrasi SVG inline, foto `loading="lazy"`.
- **UX**: bahasa & tema diingat, filter tour/rental, akordeon FAQ, **dialog pemesanan** (jumlah tamu/hari + estimasi total), pesan WhatsApp otomatis, halaman 404, panel admin dengan editor 6 bahasa.

---

## 9. Checklist sebelum publish

Jalankan `npm run predeploy` — skrip ini memeriksa poin-poin di bawah secara otomatis dan berhenti dengan kode error bila ada yang wajib diperbaiki.

- [ ] Nomor WhatsApp, email, alamat benar (Admin → Pengaturan)
- [ ] Harga & paket tour / kendaraan sesuai
- [ ] Foto asli ditaruh di `assets/img/` **atau** diunggah lewat admin (butuh binding R2 `BUCKET`)
- [ ] Foto hero halaman tour & rental sudah dipilih (Admin → Pengaturan → Foto hero)
- [ ] `SESSION_SECRET` diset, username **dan** kata sandi admin diganti dari bawaan (Admin → Keamanan)
- [ ] Token Cloudflare Web Analytics diisi
- [ ] `database_id` D1 di `wrangler.toml` sudah diganti dari placeholder
- [ ] `npm run check` bersih, halaman admin rahasia bisa login
- [ ] D1 binding `DB` aktif dan data awal muncul
- [ ] Record DNS lama dihapus, `www` redirect, Always Use HTTPS aktif

---

Konten paket, harga, ulasan, dan armada saat ini adalah **contoh realistis** — ganti dengan data asli sebelum tayang.