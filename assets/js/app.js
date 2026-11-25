/* ==========================================================================
   DEWA BALI TOUR — interaksi (tanpa dependensi)
   ========================================================================== */
(() => {
  "use strict";

  const doc = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* mode privat */ } },
  };

  doc.classList.add("js");

  /* ---------------- tema ---------------- */
  const THEME_KEY = "dbt-theme";
  const metaTheme = $('meta[name="theme-color"]');
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

  function applyTheme(theme, persist) {
    doc.dataset.theme = theme;
    if (persist) store.set(THEME_KEY, theme);
    if (metaTheme) metaTheme.setAttribute("content", theme === "dark" ? "#070a11" : "#0e9488");
    $$("[data-theme-toggle]").forEach((b) => b.setAttribute("aria-pressed", String(theme === "dark")));
  }

  applyTheme(store.get(THEME_KEY) || (systemDark.matches ? "dark" : "light"), false);

  $$("[data-theme-toggle]").forEach((btn) =>
    btn.addEventListener("click", () => {
      applyTheme(doc.dataset.theme === "dark" ? "light" : "dark", true);
    })
  );

  systemDark.addEventListener?.("change", (e) => {
    if (!store.get(THEME_KEY)) applyTheme(e.matches ? "dark" : "light", false);
  });

  /* ---------------- navigasi ---------------- */
  const nav = $("#nav");
  const progress = $(".nav-progress");
  let ticking = false;

  function onScroll() {
    const y = window.scrollY;
    if (nav) nav.classList.toggle("is-stuck", y > 10);
    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    }
    ticking = false;
  }
  window.addEventListener("scroll", () => {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(onScroll);
    }
  }, { passive: true });
  onScroll();

  /* ---------------- menu mobile ---------------- */
  const sheet = $("#sheet");
  const burger = $(".burger");

  function closeSheet() {
    if (!sheet || !burger) return;
    sheet.hidden = true;
    burger.setAttribute("aria-expanded", "false");
  }

  burger?.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = sheet.hidden;
    sheet.hidden = !open;
    burger.setAttribute("aria-expanded", String(open));
    if (open) $(".sheet-links a", sheet)?.focus({ preventScroll: true });
  });

  $$("#sheet a").forEach((a) => a.addEventListener("click", closeSheet));

  /* ketuk di luar menu atau tekan Escape untuk menutup */
  document.addEventListener("click", (e) => {
    if (!sheet || sheet.hidden) return;
    if (sheet.contains(e.target) || burger?.contains(e.target)) return;
    closeSheet();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (sheet && !sheet.hidden) {
      closeSheet();
      burger?.focus({ preventScroll: true });
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) closeSheet();
  }, { passive: true });

  /* ---------------- menu bahasa ---------------- */
  const lang = $("[data-lang]");
  const langBtn = $(".lang-btn", lang || document);
  const langMenu = $(".lang-menu", lang || document);

  function closeLang() {
    if (!langMenu || !langBtn) return;
    langMenu.classList.remove("is-open");
    langBtn.setAttribute("aria-expanded", "false");
  }

  langBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = !langMenu.classList.contains("is-open");
    langMenu.classList.toggle("is-open", open);
    langBtn.setAttribute("aria-expanded", String(open));
  });

  document.addEventListener("click", (e) => {
    if (lang && !lang.contains(e.target)) closeLang();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeLang();
      closeSheet();
    }
  });

  /* ingat bahasa terakhir untuk halaman akar */
  store.set("dbt-lang", doc.lang.split("-")[0]);

  /* ---------------- filter paket / rental ---------------- */
  $$(".filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cat = btn.dataset.filter;
      const group = btn.closest(".filters") || document;
      $$(".filter", group).forEach((b) => {
        const active = b === btn;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", String(active));
      });
      $$("[data-filterable]").forEach((card) => {
        const show = cat === "all" || card.dataset.cat === cat;
        card.classList.toggle("is-hidden", !show);
        if (show) {
          card.classList.add("in");
          card.animate?.(
            [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }],
            { duration: 380, easing: "cubic-bezier(.22,.85,.24,1)" }
          );
        }
      });
    });
  });

  /* ---------------- animasi masuk ---------------- */
  const revealables = $$("[data-reveal]");
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target;
            const siblings = Array.from(el.parentElement?.children || []);
            const i = Math.min(siblings.indexOf(el), 6);
            el.style.transitionDelay = `${Math.max(0, i) * 55}ms`;
            el.classList.add("in");
            io.unobserve(el);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    revealables.forEach((el) => io.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add("in"));
  }

  /* ---------------- kilau kartu mengikuti kursor ---------------- */
  if (window.matchMedia("(hover:hover)").matches) {
    $$(".card").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
        card.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
      });
    });
  }

  /* ---------------- foto opsional: sembunyikan kalau gagal ---------------- */
  $$("img.tour-photo").forEach((img) =>
    img.addEventListener("error", () => img.remove(), { once: true })
  );

  /* ---------------- FAQ: satu terbuka ---------------- */
  const faqs = $$(".faq");
  faqs.forEach((d) =>
    d.addEventListener("toggle", () => {
      if (d.open) faqs.forEach((o) => o !== d && (o.open = false));
    })
  );

  /* ---------------- dialog legal ---------------- */
  $$("[data-dialog]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dlg = $(`#dlg-${btn.dataset.dialog}`);
      if (!dlg) return;
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");
    });
  });

  $$("dialog.dlg").forEach((dlg) => {
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) dlg.close();
    });
  });

  /* ---------------- form booking → WhatsApp ---------------- */
  const form = $("#book-form");
  if (form) {
    const body = document.body;
    /* Tanggal dari <input type="date"> berformat ISO (2026-12-05). Di pesan
       WhatsApp itu terlihat seperti kode, bukan tanggal. Ubah ke format
       bahasa halaman ini, contoh: "5 Des 2026" / "Dec 5, 2026".
       Kalau parsing gagal, pakai nilai aslinya — jangan sampai pesan kosong. */
    const LOCALES = { id: "id-ID", en: "en-GB", de: "de-DE", fr: "fr-FR", es: "es-ES", ru: "ru-RU" };
    const fmtDate = (iso) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
      if (!m) return iso;
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      if (isNaN(d)) return iso;
      const lang = body.dataset.lang || "en";
      try {
        let out = d.toLocaleDateString(LOCALES[lang] || "en-GB", {
          day: "numeric",
          month: lang === "ru" ? "long" : "short",
          year: "numeric",
        });
        /* Intl bahasa Rusia menambahkan "г." di akhir ("5 декабря 2026 г.").
           Kalimatnya sudah diberi titik di template, jadi buang dulu supaya
           tidak jadi "г.." di pesan WhatsApp. */
        return out.replace(/\s*г\.\s*$/u, "").replace(/[.\s]+$/, "");
      } catch (e) {
        return iso;
      }
    };
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const get = (k) => String(data.get(k) || "").trim();

      if (!get("name") || !get("wa") || !get("date")) {
        form.reportValidity();
        return;
      }

      const lines = [
        `${body.dataset.waHi} ${body.dataset.waWant} ${get("tour")}.`,
        "",
        `${body.dataset.waFor} ${get("guests") || 2} ${body.dataset.waPpl} — ${body.dataset.waDate} ${fmtDate(get("date"))}.`,
        `${body.dataset.waName} ${get("name")}.`,
        `${body.dataset.waWa || "WhatsApp"}: ${get("wa")}`,
      ];
      const msg = get("msg");
      if (msg) lines.push("", msg);
      lines.push("", body.dataset.waHi);

      const url = `https://wa.me/${body.dataset.wa}?text=${encodeURIComponent(lines.join("\n"))}`;
      window.open(url, "_blank", "noopener");

      const btn = $('button[type="submit"]', form);
      if (btn) {
        const original = btn.innerHTML;
        btn.innerHTML = `<span>${body.dataset.waThanks || "✓"}</span>`;
        btn.disabled = true;
        setTimeout(() => {
          btn.innerHTML = original;
          btn.disabled = false;
        }, 2600);
      }
    });
  }


  /* ---------------- hidrasi data dari API (hasil CRUD admin) ---------------- */
  const pageLang = document.body.dataset.lang || "id";
  const pageRev = document.body.dataset.rev;

  function applySettings(s) {
    if (!s) return;
    if (s.phoneE164) {
      $$('a[href*="wa.me/"]').forEach((a) => {
        a.href = a.href.replace(/wa\.me\/\d+/, `wa.me/${s.phoneE164}`);
      });
      $$('a[href^="tel:"]').forEach((a) => {
        a.href = `tel:+${s.phoneE164}`;
        if (s.phoneDisplay) a.textContent = s.phoneDisplay;
      });
    }
    if (s.email) {
      $$('a[href^="mailto:"]').forEach((a) => {
        a.href = `mailto:${s.email}`;
        if (a.textContent.includes("@")) a.textContent = s.email;
      });
    }
    if (s.address) $$('[data-f="address"]').forEach((el) => (el.textContent = s.address));
    if (s.hours) $$('[data-f="hours"]').forEach((el) => (el.textContent = s.hours));
    applyHeroPhoto(s.heroPhoto, "tour");
    applyHeroPhoto(s.rentalHeroPhoto, "rental");
  }

  /* Foto hero diisi dari data server supaya bisa diganti lewat panel admin
     tanpa build ulang. Kalau kosong atau gagal dimuat, ilustrasi SVG tetap
     tampil sebagai latar — tidak ada kotak gambar rusak. */
  function applyHeroPhoto(url, key) {
    const box = document.querySelector(`[data-hero="${key}"]`);
    if (!box) return;
    let img = box.querySelector(".tour-photo");
    if (!url) {
      if (img) img.remove();
      return;
    }
    if (!img) {
      img = document.createElement("img");
      img.className = "tour-photo";
      img.alt = "";
      img.decoding = "async";
      box.insertBefore(img, box.firstChild);
    }
    if (img.getAttribute("src") === url) return;
    img.addEventListener("error", () => img.remove(), { once: true });
    img.src = url;
  }

  function fillCard(node, item, map) {
    const img = node.querySelector(".tour-photo");
    const artTpl = document.getElementById(`art-${item.art || "terrace"}`);
    if (artTpl && node.querySelector(".tour-art")) {
      node.querySelector(".tour-art").appendChild(artTpl.content.firstElementChild.cloneNode(true));
    }
    if (img && item.photo) {
      img.src = item.photo;
      img.hidden = false;
      img.addEventListener("error", () => img.remove(), { once: true });
    }
    node.dataset.cat = map.cat || "";
    node.querySelectorAll("[data-f]").forEach((el) => {
      const key = el.dataset.f;
      if (key === "includes") {
        const tick = document.getElementById("tpl-tick");
        el.innerHTML = "";
        if (!tick) return;
        (item.includes || []).forEach((text) => {
          const li = tick.content.firstElementChild.cloneNode(true);
          li.querySelector('[data-f="text"]').textContent = text;
          el.appendChild(li);
        });
        return;
      }
      if (key === "wa") {
        el.href = map.wa || "#";
        return;
      }
      if (map[key] !== undefined) el.textContent = map[key];
    });
    node.classList.add("in");
  }

  function renderCards(gridId, tplId, items, toMap) {
    const grid = document.getElementById(gridId);
    const tpl = document.getElementById(tplId);
    if (!grid || !tpl || !items) return;
    const frag = document.createDocumentFragment();
    items.forEach((item) => {
      const node = tpl.content.firstElementChild.cloneNode(true);
      fillCard(node, item, toMap(item));
      frag.appendChild(node);
    });
    grid.innerHTML = "";
    grid.appendChild(frag);
  }

  /* ---------------- teks halaman yang disunting admin ----------------
     Halaman dibangun saat build, jadi teks aslinya sudah "terpanggang" di
     HTML. Kalau admin menyunting teks di panel, server mengirim hanya
     kunci yang berubah; kita timpa di sini supaya halaman ikut berubah
     tanpa build ulang. Elemen ditandai data-copy saat build. */
  /* Server hanya mengirim kunci yang diubah, jadi potongan pesan WhatsApp
     yang tidak diubah harus diambil dari teks asli di halaman (snapshot
     sekali saat muat). Tanpa ini tombol akan kehilangan bagian pesannya. */
  function snapshotWa() {
    const hi = document.body.dataset.waHi || "";
    $$("[data-wa-static]").forEach((a) => {
      let msg = "";
      try {
        msg = new URL(a.href).searchParams.get("text") || "";
      } catch {
        msg = "";
      }
      a.dataset.waBase = msg;
      a.dataset.waSuffix = msg.startsWith(hi) ? msg.slice(hi.length).trim() : msg;
    });
  }
  snapshotWa();

  function applyCopy(c) {
    if (!c || typeof c !== "object") return;
    let touched = false;

    $$("[data-copy]").forEach((el) => {
      const key = el.dataset.copy;
      const val = c[key];
      if (typeof val !== "string" || !val) return;
      touched = true;

      /* Atribut (aria-label, placeholder, title) */
      const attrName = el.dataset.copyAttr;
      if (attrName) {
        el.setAttribute(attrName, val);
        return;
      }

      /* Teks yang memang berisi HTML terbatas (<em>, <strong>, <br>).
         Hanya tag itu yang diizinkan — sisanya di-escape. */
      if (el.dataset.copyHtml === "1") {
        el.innerHTML = sanitizeInline(val);
        return;
      }

      el.textContent = val;
    });

    /* Potongan pesan WhatsApp tidak punya elemen penanda sendiri (body
       hanya boleh satu nilai), jadi kehadirannya juga dihitung sebagai
       perubahan — kalau tidak, mengubah sapaan saja tidak akan
       menyusun ulang tautan. */
    const WA_KEYS = ["wa.hi", "wa.want", "wa.for", "wa.ppl", "wa.onDate", "wa.nameIs"];
    const waChanged = WA_KEYS.some((k) => typeof c[k] === "string" && c[k]);

    if (!touched && !waChanged) return;

    /* Body menyimpan enam potongan pesan WhatsApp sekaligus — HTML hanya
       mengizinkan satu atribut bernama sama, jadi kuncinya didaftar di
       data-wa-copy lalu dipetakan ke data-wa-* sesuai urutan. */
    const body = document.body;
    if (body.dataset.waCopy) {
      const attrs = ["waHi", "waWant", "waFor", "waPpl", "waDate", "waName"];
      body.dataset.waCopy.split(",").forEach((key, i) => {
        const val = c[key.trim()];
        if (typeof val === "string" && val && attrs[i]) body.dataset[attrs[i]] = val;
      });
    }

    /* Susun ulang tautan WhatsApp: sapaan dari teks baru (atau aslinya),
       imbuhan dari teks baru (atau snapshot aslinya). */
    const phone = body.dataset.wa;
    if (!phone) return;
    const hi = c["wa.hi"] || body.dataset.waHi || "";
    $$("[data-wa-static]").forEach((a) => {
      const suffixKey = a.dataset.waStatic;
      const suffix = (suffixKey && c[suffixKey]) || a.dataset.waSuffix || "";
      const msg = `${hi} ${suffix}`.trim();
      a.href = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    });
  }

  /* <em>/<strong>/<br> dipertahankan, tag lain dibuang jadi teks biasa. */
  function sanitizeInline(html) {
    const allowed = new Set(["EM", "STRONG", "B", "I", "BR"]);
    const box = document.createElement("div");
    box.innerHTML = String(html);
    const walk = (node) => {
      [...node.children].forEach((child) => {
        walk(child);
        if (!allowed.has(child.tagName)) {
          child.replaceWith(...child.childNodes);
        }
      });
    };
    walk(box);
    return box.innerHTML;
  }

  function hydrate(data) {
    if (!data) return;
    applySettings(data.settings);
    applyCopy(data.copy);
    if (document.getElementById("tour-grid")) {
      renderCards("tour-grid", "tpl-tour", data.tours, (t) => ({
        cat: t.cat,
        catLabel: t.catLabel,
        name: t.name,
        tagline: t.tagline,
        dur: t.durationText,
        price: t.priceText,
        per: t.perText,
        wa: t.waHref,
        bookMeta: t.durationText,
        includes: t.includes,
      }));
    }
    if (document.getElementById("rental-grid")) {
      renderCards("rental-grid", "tpl-rental", data.rentals, (r) => ({
        cat: r.type,
        type: r.typeLabel,
        name: r.name,
        tagline: r.tagline,
        unit: r.unitText,
        price: r.priceText,
        per: r.perText,
        wa: r.waHref,
        bookMeta: r.typeLabel,
        driverFee: r.driverFee,
        includes: r.includes,
      }));
    }
  }

  if (pageRev) {
    fetch(`/api/data?lang=${encodeURIComponent(pageLang)}`, { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || data.rev === pageRev) return;
        hydrate(data);
      })
      .catch(() => {
        /* offline / API belum ada — biarkan konten statis */
      });
  }


  /* ---------------- pemesanan: langsung WhatsApp ---------------- */
  /* Dulu setiap tombol "Booking" membuka dialog harga di halaman ini.
     Sekarang tombolnya langsung membuka chat WhatsApp dengan pesan yang
     sudah terisi (nama paket, jumlah tamu, tanggal). Dialog, hitungan
     harga, dan diskon rombongan dihapus karena tidak lagi dipakai —
     harganya sudah tampil di kartu, dan angka final dikonfirmasi di chat. */

  /* ---------------- tautan internal: offset nav ---------------- */
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      closeSheet();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", id);
    });
  });
})();