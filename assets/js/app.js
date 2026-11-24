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
        `${body.dataset.waFor} ${get("guests") || 2} ${body.dataset.waPpl} — ${body.dataset.waDate} ${get("date")}.`,
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
    const bookBtn = node.querySelector("[data-book]");
    if (bookBtn) {
      bookBtn.dataset.bookName = item.name || "";
      bookBtn.dataset.bookPrice = String(item.price || 0);
      bookBtn.dataset.bookSolo = String(item.soloPrice || 0);
      bookBtn.dataset.bookMeta = map.bookMeta || "";
      bookBtn.dataset.bookDriverFee = String(map.driverFee || 0);
      bookBtn.dataset.bookPhoto = item.photo || "";
    }
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

  function hydrate(data) {
    if (!data) return;
    applySettings(data.settings);
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


  /* ---------------- dialog pemesanan (tamu / hari / unit / sopir) ---------------- */
  const bookingDlg = document.getElementById("booking");
  const bookI18nEl = document.getElementById("book-i18n");
  let bookI18n = null;
  try {
    bookI18n = bookI18nEl ? JSON.parse(bookI18nEl.textContent) : null;
  } catch {
    bookI18n = null;
  }

  const book = {
    kind: "tour",
    price: 0,
    soloPrice: 0,
    driverFee: 0,
    name: "",
    meta: "",
    desc: "",
    photo: "",
    itin: [],
    includes: [],
    count: 2,
    days: 1,
    units: 1,
    driver: false,
  };
  const clamp = (v, min, max) => Math.max(min, Math.min(max, Number.isFinite(v) ? v : min));

  const fmtMoney = (n) => {
    const lang = document.body.dataset.lang || "id";
    const loc = { id: "id-ID", en: "en-GB", de: "de-DE", fr: "fr-FR", es: "es-ES", ru: "ru-RU" }[lang] || "en-GB";
    const str = new Intl.NumberFormat(loc).format(Math.round(n));
    return lang === "id" ? `Rp ${str}` : `IDR ${str}`;
  };

  /* Perjalanan solo: pakai harga khusus 1 orang kalau tersedia. */
  const isSolo = () => book.kind === "tour" && book.count === 1 && book.soloPrice > 0;

  /* Diskon rombongan otomatis, bertingkat sesuai jumlah peserta.
     Semakin besar grup, semakin kecil biaya per orang — tanpa mengubah
     harga 1–2 peserta (solo & pasangan tetap seperti sebelumnya). */
  const GROUP_TIERS = [
    { min: 7, pct: 18 },
    { min: 5, pct: 12 },
    { min: 3, pct: 6 },
  ];
  const groupTier = () =>
    book.kind === "tour" ? GROUP_TIERS.find((t) => book.count >= t.min) || null : null;

  const bookTotal = () => {
    if (book.kind !== "tour") {
      return (book.price + (book.driver ? book.driverFee : 0)) * book.units * book.days;
    }
    if (isSolo()) return book.soloPrice;
    const gross = book.price * book.count;
    const tier = groupTier();
    return tier ? Math.round((gross * (100 - tier.pct)) / 100 / 1000) * 1000 : gross;
  };

  function bookBreakdown() {
    if (book.kind === "tour") {
      if (isSolo()) {
        return `${bookI18n.soloTag} · 1 ${bookI18n.unitPeople1} · ${fmtMoney(book.soloPrice)}`;
      }
      const base = `${book.count} ${book.count === 1 ? bookI18n.unitPeople1 : bookI18n.unitPeople} × ${fmtMoney(book.price)}`;
      const tier = groupTier();
      if (!tier) return base;
      const save = book.price * book.count - bookTotal();
      return `${base} − ${tier.pct}% (${bookI18n.groupTag} ${fmtMoney(save)})`;
    }
    const driverTxt = book.driver ? bookI18n.msgWithDriver : bookI18n.msgSelfDrive;
    return `${book.units} ${bookI18n.unitShort} × ${book.days} ${bookI18n.unitDays} · ${driverTxt}`;
  }

  function renderPhoto() {
    const img = bookingDlg.querySelector('[data-b="photo"]');
    const shot = bookingDlg.querySelector(".booking-shot");
    if (!img) return;
    const src = book.photo;
    if (!src) {
      img.hidden = true;
      img.removeAttribute("src");
      shot?.removeAttribute("data-has-photo");
      return;
    }
    img.alt = book.name;
    img.hidden = false;
    shot?.setAttribute("data-has-photo", "");
    img.onerror = () => {
      img.hidden = true;
      img.removeAttribute("src");
      shot?.removeAttribute("data-has-photo");
    };
    img.src = src;
  }

  function renderBooking() {
    if (!bookingDlg || !bookI18n) return;
    const isTour = book.kind === "tour";
    const q = (sel) => bookingDlg.querySelector(sel);
    const hasDriver = !isTour && book.driverFee > 0;

    if (isTour) book.count = clamp(Math.round(book.count), 1, 12);
    else {
      book.days = clamp(Math.round(book.days), 1, 30);
      book.units = clamp(Math.round(book.units), 1, 5);
      if (!hasDriver) book.driver = false;
    }

    q('[data-b="guestsRow"]').hidden = !isTour;
    q('[data-b="daysRow"]').hidden = isTour;
    q('[data-b="unitsRow"]').hidden = isTour;
    q('[data-b="driverRow"]').hidden = !hasDriver;

    q('[data-b="kicker"]').textContent = isTour ? bookI18n.kickerTour : bookI18n.kickerRental;
    q('[data-b="name"]').textContent = book.name;
    renderPhoto();
    q('[data-b="meta"]').textContent = book.meta;
    q('[data-b="guestsLabel"]').textContent = bookI18n.guests;
    q('[data-b="daysLabel"]').textContent = bookI18n.days;
    q('[data-b="unitsLabel"]').textContent = bookI18n.units;
    q('[data-b="driverLabel"]').textContent = bookI18n.driver;
    q('[data-b="totalLabel"]').textContent = bookI18n.total;
    q('[data-b="total"]').textContent = fmtMoney(bookTotal());
    q('[data-b="breakdown"]').textContent = bookBreakdown();
    q('[data-b="note"]').textContent = isTour ? bookI18n.noteTour : bookI18n.noteRental;

    /* penjelasan tour + itinerary + yang termasuk */
    q('[data-b="aboutLabel"]').textContent = bookI18n.about;
    q('[data-b="about"]').textContent = book.desc;
    q('[data-b="itinLabel"]').textContent = bookI18n.itinerary;
    q('[data-b="incLabel"]').textContent = isTour ? bookI18n.includesTour : bookI18n.includesRental;
    q('[data-b="itinWrap"]').hidden = book.itin.length === 0;
    q('[data-b="detail"]').hidden = !book.desc && book.itin.length === 0;

    const itinList = q('[data-b="itinerary"]');
    itinList.innerHTML = "";
    book.itin.forEach((step) => {
      const li = document.createElement("li");
      li.textContent = step;
      itinList.appendChild(li);
    });

    const incList = q('[data-b="includes"]');
    incList.innerHTML = "";
    book.includes.forEach((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      incList.appendChild(li);
    });

    const countInput = q('[data-b="count"]');
    countInput.value = String(book.count);
    q('[data-b="days"]').value = String(book.days);
    q('[data-b="units"]').value = String(book.units);

    /* tombol langkah nonaktif saat sudah menyentuh batas, supaya jelas */
    const limits = isTour ? { count: [1, 12] } : { days: [1, 30], units: [1, 5] };
    Object.entries(limits).forEach(([name, [min, max]]) => {
      bookingDlg.querySelectorAll(`[data-step="${name}"]`).forEach((b) => {
        const delta = Number(b.dataset.delta) || 0;
        b.disabled = delta < 0 ? book[name] <= min : book[name] >= max;
      });
    });

    bookingDlg.querySelectorAll("[data-driver]").forEach((b) => {
      b.classList.toggle("is-active", (b.dataset.driver === "1") === book.driver);
    });

    /* pintasan jumlah tamu (di samping foto) / jumlah hari (rental) */
    const guestWrap = q('[data-b="quickGuests"]');
    if (guestWrap) {
      guestWrap.innerHTML = "";
      guestWrap.hidden = !isTour;
      if (isTour) {
        [1, 2, 3, 5, 7].forEach((n) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = n === 1 ? bookI18n.soloTag : String(n);
          b.dataset.pickFor = "count";
          b.dataset.pick = String(n);
          if (n === book.count) b.className = "is-active";
          guestWrap.appendChild(b);
        });
      }
    }

    const wrap = q('[data-b="quick"]');
    if (wrap) {
      wrap.innerHTML = "";
      wrap.hidden = isTour;
      if (!isTour) {
        [1, 2, 3, 5, 7].forEach((n) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = String(n);
          b.dataset.pickFor = "days";
          b.dataset.pick = String(n);
          if (n === book.days) b.className = "is-active";
          wrap.appendChild(b);
        });
      }
    }

    /* keterangan harga solo saat memilih 1 tamu */
    /* catatan pemilihan tamu: ajakan 1 orang, lalu harga solo saat dipilih */
    const hint = q('[data-b="soloHint"]');
    if (hint) {
      hint.hidden = !isTour || isSolo();
      hint.textContent = bookI18n.soloHint;
    }
    const soloNote = q('[data-b="soloNote"]');
    if (soloNote) soloNote.hidden = !isSolo();
    if (isSolo()) soloNote.textContent = bookI18n.soloPriceNote.replace("{price}", fmtMoney(book.soloPrice));

    /* keterangan diskon rombongan */
    const groupNote = q('[data-b="groupNote"]');
    if (groupNote) {
      const tier = groupTier();
      groupNote.hidden = !tier;
      if (tier) {
        const save = book.price * book.count - bookTotal();
        groupNote.textContent = bookI18n.groupNote
          .replace("{pct}", String(tier.pct))
          .replace("{n}", String(book.count))
          .replace("{save}", fmtMoney(save));
      }
    }

    const total = fmtMoney(bookTotal());
    const tier = groupTier();
    const groupTxt = tier ? ` ${bookI18n.groupTag} ${tier.pct}%: ${fmtMoney(book.price * book.count - bookTotal())}.` : "";
    const msg = isTour
      ? `${bookI18n.hi} ${bookI18n.want} ${book.name} ${bookI18n.forLabel} ${book.count} ${
          book.count === 1 ? bookI18n.unitPeople1 : bookI18n.unitPeople
        }. ${bookI18n.total}: ${total}.${groupTxt}`
      : `${bookI18n.hi} ${bookI18n.rentalBook} ${book.name}, ${book.units} ${bookI18n.unitShort}, ${book.days} ${bookI18n.unitDays}, ${
          book.driver ? bookI18n.msgWithDriver : bookI18n.msgSelfDrive
        }. ${bookI18n.total}: ${total}.`;
    q('[data-b="cta"]').href = `https://wa.me/${document.body.dataset.wa}?text=${encodeURIComponent(msg)}`;
  }

  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;

    const trigger = target.closest("a[data-book]");
    if (trigger && bookingDlg) {
      e.preventDefault();
      book.kind = trigger.dataset.bookKind === "rental" ? "rental" : "tour";
      book.name = trigger.dataset.bookName || "";
      book.price = Number(trigger.dataset.bookPrice) || 0;
      book.soloPrice = Number(trigger.dataset.bookSolo) || 0;
      book.driverFee = Number(trigger.dataset.bookDriverFee) || 0;
      book.meta = trigger.dataset.bookMeta || "";
      book.desc = trigger.dataset.bookDesc || "";
      book.photo = trigger.dataset.bookPhoto || "";
      /* data lama belum punya harga solo: pakai perkiraan 1,4× harga per orang */
      if (book.kind === "tour" && !(book.soloPrice > 0) && book.price > 0) {
        book.soloPrice = Math.round((book.price * 1.4) / 50000) * 50000;
      }
      if (book.kind === "rental") book.soloPrice = 0;
      book.itin = String(trigger.dataset.bookItin || "")
        .split("|")
        .map((x) => x.trim())
        .filter(Boolean);
      const card = trigger.closest(".tour");
      book.includes = card
        ? Array.from(card.querySelectorAll(".ticks li")).map((li) => li.textContent.trim())
        : [];
      book.count = 2;
      book.days = 1;
      book.units = 1;
      book.driver = false;
      renderBooking();
      bookingDlg.showModal();
      return;
    }

    if (!bookingDlg || !bookingDlg.contains(target)) return;

    const step = target.closest("[data-step]");
    if (step) {
      e.preventDefault();
      const delta = Number(step.dataset.delta) || 0;
      if (step.dataset.step === "count") book.count += delta;
      if (step.dataset.step === "days") book.days += delta;
      if (step.dataset.step === "units") book.units += delta;
      renderBooking();
      return;
    }

    const driverBtn = target.closest("[data-driver]");
    if (driverBtn) {
      e.preventDefault();
      book.driver = driverBtn.dataset.driver === "1";
      renderBooking();
      return;
    }

    const pick = target.closest(".quick-picks button");
    if (pick) {
      e.preventDefault();
      if (pick.dataset.pickFor === "days") book.days = Number(pick.dataset.pick);
      else book.count = Number(pick.dataset.pick);
      renderBooking();
    }
  });

  [["count", "count"], ["days", "days"], ["units", "units"]].forEach(([name, field]) => {
    const input = bookingDlg?.querySelector(`[data-b="${name}"]`);
    input?.addEventListener("input", (e) => {
      book[field] = Number(e.target.value) || 1;
      renderBooking();
    });
  });

  /* ---------------- tautan internal: offset nav ---------------- */  /* ---------------- tautan internal: offset nav ---------------- */
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