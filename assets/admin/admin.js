/* ==========================================================================
   Panel admin — login, daftar, dan CRUD (memanggil /api/*)
   ========================================================================== */

const LANGS = [
  { code: "id", short: "ID", label: "Indonesia" },
  { code: "en", short: "EN", label: "English" },
  { code: "de", short: "DE", label: "Deutsch" },
  { code: "fr", short: "FR", label: "Français" },
  { code: "es", short: "ES", label: "Español" },
  { code: "ru", short: "RU", label: "Русский" },
];

const ART_TOURS = [
  ["terrace", "Sawah terasering"],
  ["island", "Tebing & laut"],
  ["volcano", "Gunung"],
  ["temple", "Pura"],
  ["river", "Sungai"],
  ["gate", "Gerbang"],
];

const CATS = [
  ["culture", "Budaya"],
  ["adventure", "Petualangan"],
  ["island", "Island hopping"],
];

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const esc = (v = "") =>
  String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const money = (n) =>
  "Rp " + new Intl.NumberFormat("id-ID").format(Number(n) || 0);

const state = { tab: "tours", data: null };

/* tautan reset dari email: .../dewa-200280-bali/?reset=TOKEN */
let resetToken = new URLSearchParams(location.search).get("reset") || "";

/* ---------------- API ---------------- */
async function api(path, { method = "GET", body, allow401 = false } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: { "content-type": "application/json", "x-requested-with": "fetch" },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* kosong */
  }
  if (res.status === 401 && path !== "/login" && !allow401) {
    showLogin("Sesi berakhir. Silakan masuk lagi.");
    throw new Error(data.error || "Sesi berakhir.");
  }
  if (!res.ok) throw new Error(data.error || `Permintaan gagal (${res.status}).`);
  return data;
}

/* ---------------- tampilan ---------------- */
const loginView = $("#login-view");
const appView = $("#app-view");
const loginForm = $("#login-form");
const loginError = $("#login-error");
const panel = $("#panel");
const editor = $("#editor");
const editorBody = $("#editor-body");
const toastEl = $("#toast");

let toastTimer;
function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
}

const forgotForm = $("#forgot-form");
const resetForm = $("#reset-form");

function showView(which) {
  loginView.hidden = false;
  loginForm.hidden = which !== "login";
  forgotForm.hidden = which !== "forgot";
  resetForm.hidden = which !== "reset";
  loginError.hidden = true;
}

function showLogin(message) {
  appView.hidden = true;
  loginView.hidden = false;
  if (resetToken) {
    showView("reset");
    setTimeout(() => resetForm.querySelector("input[name=password]").focus(), 60);
    return;
  }
  showView("login");
  if (message) {
    loginError.textContent = message;
    loginError.hidden = false;
  } else {
    loginError.hidden = true;
  }
  $("#login-form input[name=password]").value = "";
  setTimeout(() => $("#login-form input[name=username]").focus(), 60);
}

function showApp() {
  loginError.hidden = true;
  loginView.hidden = true;
  appView.hidden = false;
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(loginForm);
  loginError.hidden = true;
  const btn = loginForm.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    await api("/login", {
      method: "POST",
      body: { username: String(fd.get("username") || ""), password: String(fd.get("password") || "") },
    });
    showApp();
    await loadData();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.hidden = false;
  } finally {
    btn.disabled = false;
  }
});

$("#forgot-toggle").addEventListener("click", () => {
  forgotForm.querySelector("input[name=username]").value = $("#login-form input[name=username]").value || "";
  $("#forgot-note").hidden = true;
  showView("forgot");
  setTimeout(() => forgotForm.querySelector("input[name=username]").focus(), 60);
});

$("#forgot-cancel").addEventListener("click", () => showView("login"));

forgotForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const note = $("#forgot-note");
  const username = String(new FormData(forgotForm).get("username") || "").trim();
  const btn = forgotForm.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    const res = await api("/admin/forgot", { method: "POST", body: { username }, allow401: true });
    note.textContent = res.devLink
      ? `Mode lokal (email belum aktif). Tautan reset: ${res.devLink}`
      : res.message;
    note.hidden = false;
    if (res.devLink) {
      note.innerHTML = 'Mode lokal (email belum aktif). Tautan reset: <a href="' + esc(res.devLink) + '">buka halaman reset</a>';
    }
  } catch (err) {
    note.textContent = err.message;
    note.hidden = false;
  } finally {
    btn.disabled = false;
  }
});

resetForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const note = $("#reset-note");
  const fd = new FormData(resetForm);
  const password = String(fd.get("password") || "");
  const confirm = String(fd.get("confirm") || "");
  note.hidden = true;

  if (password !== confirm) {
    note.textContent = "Ulangi kata sandi tidak sama.";
    note.hidden = false;
    return;
  }

  const btn = resetForm.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    const res = await api("/admin/reset", {
      method: "POST",
      allow401: true,
      body: { token: resetToken, username: String(fd.get("username") || "").trim(), password, confirm },
    });
    resetToken = "";
    history.replaceState({}, "", location.pathname);
    resetForm.reset();
    showLogin(
      `Kata sandi untuk "${res.user}" tersimpan${res.usernameChanged ? " (nama pengguna juga diganti)" : ""}. Silakan masuk dengan kata sandi baru.`
    );
  } catch (err) {
    note.textContent = err.message;
    note.hidden = false;
  } finally {
    btn.disabled = false;
  }
});

$("#logout-btn").addEventListener("click", async () => {
  try {
    await api("/logout", { method: "POST" });
  } catch {
    /* abaikan */
  }
  state.data = null;
  showLogin("Anda sudah keluar.");
});

$$(".admin-tab").forEach((tab) =>
  tab.addEventListener("click", () => {
    state.tab = tab.dataset.tab;
    $$(".admin-tab").forEach((t) => {
      t.classList.toggle("is-active", t === tab);
      t.setAttribute("aria-selected", String(t === tab));
    });
    renderPanel();
  })
);

async function loadData() {
  panel.innerHTML = `<p class="hint">Memuat data…</p>`;
  try {
    state.data = await api("/admin/data");
    renderPanel();
  } catch (err) {
    panel.innerHTML = `<p class="empty">${esc(err.message)}</p>`;
  }
}

/* ---------------- panel ---------------- */
function renderPanel() {
  if (!state.data) return;
  if (state.tab === "tours") return renderList("tours");
  if (state.tab === "rentals") return renderList("rentals");
  if (state.tab === "settings") return renderSettings();
  if (state.tab === "security") return renderSecurity();
}

function thumbFor(item) {
  if (item.photo) return `<img src="${esc(item.photo)}" alt="" loading="lazy">`;
  let h = 0;
  for (const ch of String(item.id)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `<span class="row-thumb-fallback" style="position:absolute;inset:0;background:linear-gradient(140deg,hsl(${h} 62% 58%),hsl(${
    (h + 42) % 360
  } 58% 34%))"></span>`;
}

function renderList(kind) {
  const isTour = kind === "tours";
  const items = isTour ? state.data.tours : state.data.rentals;
  const title = isTour ? "Paket tour" : "Armada rental";
  const sub = isTour
    ? "Tambah, ubah, atau hapus paket yang tampil di halaman tour."
    : "Kelola mobil dan motor yang tampil di halaman rental.";

  const rows = items.length
    ? items
        .map((item) => {
          const c = item.t?.id || item.t?.en || {};
          const meta = isTour
            ? `${money(item.price)} · ${item.hours} jam · ${CATS.find((x) => x[0] === item.category)?.[1] || item.category}`
            : `${money(item.price)} / hari · ${item.type === "car" ? "Mobil" : "Motor"}${
                Number(item.driverFee) > 0 ? ` · sopir ${money(item.driverFee)}/hari` : " · tanpa sopir"
              }`;
          return `<div class="row" data-id="${esc(item.id)}">
            <span class="row-thumb">${thumbFor(item)}</span>
            <div class="row-main">
              <div class="row-title">
                <strong>${esc(c.name || item.id)}</strong>
                ${item.featured ? '<span class="badge-soft">Unggulan</span>' : ""}
                <span class="badge-soft badge-off">${esc(item.id)}</span>
              </div>
              <div class="row-sub">${esc(meta)}</div>
            </div>
            <div class="row-actions">
              <button class="btn btn-glass" data-act="edit" data-id="${esc(item.id)}">Edit</button>
              <button class="btn btn-glass" data-act="del" data-id="${esc(item.id)}">Hapus</button>
            </div>
          </div>`;
        })
        .join("")
    : `<p class="empty">Belum ada data. Klik “Tambah” untuk membuat yang pertama.</p>`;

  panel.innerHTML = `
    <div class="panel-head">
      <div>
        <h2>${title}</h2>
        <p>${sub} · total ${items.length}</p>
      </div>
      <button class="btn btn-primary btn-sm" id="add-btn">Tambah ${isTour ? "paket" : "kendaraan"}</button>
    </div>
    <div class="list">${rows}</div>`;

  $("#add-btn").addEventListener("click", () => openEditor(kind, null));

  $$("[data-act]", panel).forEach((btn) =>
    btn.addEventListener("click", () => {
      const item = items.find((x) => x.id === btn.dataset.id);
      if (!item) return;
      if (btn.dataset.act === "edit") return openEditor(kind, item);
      removeItem(kind, item);
    })
  );
}

async function removeItem(kind, item) {
  const name = item.t?.id?.name || item.t?.en?.name || item.id;
  if (!confirm(`Hapus “${name}”? Tindakan ini langsung mengubah situs.`)) return;
  try {
    await api(`/admin/${kind}/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    toast("Data dihapus");
    await loadData();
  } catch (err) {
    toast(err.message);
  }
}

/* ---------------- editor ---------------- */
function langPane(lang, data, kind) {
  const c = data?.t?.[lang.code] || {};
  const includeText = (c.includes || []).join("\n");
  const itinText = (c.itinerary || []).join("\n");
  return `<div class="lang-pane" data-lang-pane="${lang.code}" ${lang.code === "id" ? "" : "hidden"}>
    <label class="field"><span>Nama (${lang.short})</span>
      <input name="name" type="text" maxlength="120" value="${esc(c.name || "")}" required>
    </label>
    <label class="field"><span>Deskripsi singkat di kartu (${lang.short})</span>
      <input name="tagline" type="text" maxlength="240" value="${esc(c.tagline || "")}" required>
    </label>
    <label class="field"><span>Penjelasan tour (${lang.short}) — tampil di dialog booking</span>
      <textarea name="description" rows="3" maxlength="1200">${esc(c.description || "")}</textarea>
    </label>
    ${
      kind === "tours"
        ? `<label class="field"><span>Rencana perjalanan (${lang.short}) — satu langkah per baris, mis. "06.30 — Jemput di hotel"</span>
             <textarea name="itinerary" rows="5" maxlength="1800">${esc(itinText)}</textarea></label>`
        : ""
    }
    <label class="field"><span>Sudah termasuk (${lang.short}) — satu poin per baris</span>
      <textarea name="includes" rows="3" maxlength="900">${esc(includeText)}</textarea></label>
  </div>`;
}

function settingsPane(lang, data) {
  return `<div class="lang-pane" data-lang-pane="${lang.code}" ${lang.code === "id" ? "" : "hidden"}>
    <label class="field"><span>Alamat kantor (${lang.short})</span>
      <input name="address" type="text" maxlength="200" value="${esc(data?.address?.[lang.code] || "")}">
    </label>
    <label class="field"><span>Jam operasional (${lang.short})</span>
      <input name="hours" type="text" maxlength="120" value="${esc(data?.hours?.[lang.code] || "")}">
    </label>
  </div>`;
}

async function compressImage(file, maxW = 1600, quality = 0.85) {
  if (!file.type.startsWith("image/")) return file;

  const fallback = new Promise((resolve) => setTimeout(() => resolve(null), 3500));

  const work = (async () => {
    let url = "";
    try {
      url = URL.createObjectURL(file);
      const img = new Image();
      img.decoding = "async";
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      if (!img.naturalWidth) return null;

      const scale = Math.min(1, maxW / img.naturalWidth);
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (!blob) return null;
      if (scale === 1 && blob.size >= file.size) return null;

      return new File([blob], "foto.jpg", { type: "image/jpeg" });
    } catch {
      return null;
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  })();

  const result = await Promise.race([work, fallback]);
  return result || file;
}

async function uploadPhoto(file) {
  const prepared = await compressImage(file);
  const fd = new FormData();
  fd.append("file", prepared, prepared.name || "foto.jpg");
  const res = await fetch("/api/admin/upload", {
    method: "POST",
    body: fd,
    credentials: "same-origin",
    headers: { "x-requested-with": "fetch" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Unggah foto gagal.");
  return data.url;
}

function openEditor(kind, item) {
  const isTour = kind === "tours";
  const isNew = !item;
  const base = item || {
    id: "",
    price: isTour ? 650000 : 150000,
    hours: 10,
    category: "culture",
    art: isTour ? "terrace" : "car",
    type: "car",
    featured: false,
    photo: "",
    sort: 0,
    t: {},
  };

  editorBody.innerHTML = `
    <h2>${isNew ? "Tambah" : "Edit"} ${isTour ? "paket tour" : "kendaraan"}</h2>
    <p class="hint">Perubahan langsung tersimpan ke situs. Isi teks untuk keenam bahasa.</p>
    <form id="entity-form" novalidate>
      <div class="field-grid">
        <label class="field"><span>ID (slug)</span>
          <input name="id" type="text" required pattern="[a-z0-9-]{2,40}" value="${esc(base.id)}" ${isNew ? "" : "readonly"}>
        </label>
        <div class="field field-full">
          <span>Foto</span>
          <div class="upload">
            <div class="upload-preview${base.photo ? "" : " is-empty"}">
              ${base.photo ? `<img src="${esc(base.photo)}" alt="">` : "Belum ada foto"}
            </div>
            <div class="upload-side">
              <div class="upload-actions">
                <label class="btn btn-glass btn-sm upload-btn">Unggah foto
                  <input type="file" accept="image/png,image/jpeg,image/webp" data-photo-file hidden>
                </label>
                <button type="button" class="btn btn-glass btn-sm" data-photo-clear>Hapus foto</button>
              </div>
              <p class="upload-hint">JPG/PNG/WebP · otomatis dikompres ke maks 1600 px.</p>
              <input name="photo" type="text" maxlength="300" placeholder="atau tempel URL/path foto" value="${esc(base.photo || "")}">
            </div>
          </div>
        </div>
        <label class="field"><span>Harga ${isTour ? "(per orang)" : "(per hari)"} — Rupiah</span>
          <input name="price" type="number" min="1000" step="1000" required value="${Number(base.price) || 0}">
        </label>
        ${
          isTour
            ? `<label class="field"><span>Durasi (jam)</span>
                 <input name="hours" type="number" min="1" max="72" required value="${Number(base.hours) || 8}">
               </label>
               <label class="field"><span>Harga solo 1 orang (Rp, 0 = nonaktif)</span>
                 <input name="soloPrice" type="number" min="0" max="100000000" step="50000" value="${Number(base.soloPrice) || 0}">
               </label>`
            : `<label class="field"><span>Jenis</span>
                 <select name="type">
                   <option value="car" ${base.type === "car" ? "selected" : ""}>Mobil</option>
                   <option value="bike" ${base.type === "bike" ? "selected" : ""}>Motor</option>
                 </select>
               </label>`
        }
        ${
          isTour
            ? `<label class="field"><span>Kategori</span>
                 <select name="category">
                   ${CATS.map(([v, l]) => `<option value="${v}" ${base.category === v ? "selected" : ""}>${l}</option>`).join("")}
                 </select>
               </label>
               <label class="field"><span>Ilustrasi (jika foto kosong)</span>
                 <select name="art">
                   ${ART_TOURS.map(([v, l]) => `<option value="${v}" ${base.art === v ? "selected" : ""}>${l}</option>`).join("")}
                 </select>
               </label>`
            : `<label class="field"><span>Biaya sopir / hari (Rp, 0 = tanpa opsi sopir)</span>
                 <input name="driverFee" type="number" min="0" max="2000000" step="50000" value="${Number(base.driverFee) || 0}">
               </label>
               <label class="field"><span>Urutan tampil</span>
                 <input name="sort" type="number" min="0" step="1" value="${Number(base.sort) || 0}">
               </label>`
        }
        <label class="check field-full"><input name="featured" type="checkbox" ${base.featured ? "checked" : ""}> Tandai sebagai unggulan</label>
      </div>

      <div class="lang-tabs" role="tablist">
        ${LANGS.map(
          (l, i) =>
            `<button type="button" class="lang-tab ${i === 0 ? "is-active" : ""}" data-lang="${l.code}">${l.short}</button>`
        ).join("")}
      </div>
      ${LANGS.map((l) => langPane(l, base, kind)).join("")}

      <p class="editor-error" id="editor-error" hidden></p>
      <div class="editor-foot">
        <button type="button" class="btn btn-glass" data-close>Batal</button>
        <button type="submit" class="btn btn-primary">Simpan</button>
      </div>
    </form>`;

  wireEditor(kind, item);
  editor.showModal();
}

function wireEditor(kind, item) {
  const form = $("#entity-form");
  const errorEl = $("#editor-error");

  $$(".lang-tab", form).forEach((tab) =>
    tab.addEventListener("click", () => {
      $$(".lang-tab", form).forEach((t) => t.classList.toggle("is-active", t === tab));
      $$(".lang-pane", form).forEach((p) => {
        p.hidden = p.dataset.langPane !== tab.dataset.lang;
      });
    })
  );

  form.querySelector("[data-close]").addEventListener("click", () => editor.close());

  const photoInput = form.querySelector('input[name="photo"]');
  const preview = form.querySelector(".upload-preview");
  const fileInput = form.querySelector("[data-photo-file]");
  const clearBtn = form.querySelector("[data-photo-clear]");

  const setPreview = (url) => {
    if (url) {
      preview.classList.remove("is-empty");
      preview.innerHTML = `<img src="${esc(url)}" alt="">`;
    } else {
      preview.classList.add("is-empty");
      preview.textContent = "Belum ada foto";
    }
  };

  photoInput.addEventListener("input", () => setPreview(photoInput.value.trim()));

  clearBtn.addEventListener("click", () => {
    photoInput.value = "";
    setPreview("");
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const label = fileInput.closest("label");
    label.classList.add("is-busy");
    try {
      const url = await uploadPhoto(file);
      photoInput.value = url;
      setPreview(url);
      toast("Foto diunggah");
    } catch (err) {
      toast(err.message);
    } finally {
      label.classList.remove("is-busy");
      fileInput.value = "";
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;

    const fd = new FormData(form);
    const t = {};
    for (const l of LANGS) {
      const pane = form.querySelector(`[data-lang-pane="${l.code}"]`);
      const lines = (name) =>
        pane
          .querySelector(`[name="${name}"]`)
          .value.split("\n")
          .map((x) => x.trim())
          .filter(Boolean);

      t[l.code] = {
        name: pane.querySelector('[name="name"]').value.trim(),
        tagline: pane.querySelector('[name="tagline"]').value.trim(),
        includes: lines("includes"),
        description: pane.querySelector('[name="description"]').value.trim(),
        ...(kind === "tours" ? { itinerary: lines("itinerary") } : {}),
      };
    }

    const payload = {
      id: String(fd.get("id") || "").trim(),
      price: Number(fd.get("price")),
      featured: fd.get("featured") === "on",
      photo: String(fd.get("photo") || "").trim(),
      t,
    };

    if (kind === "tours") {
      payload.hours = Number(fd.get("hours"));
      payload.category = String(fd.get("category"));
      payload.art = String(fd.get("art"));
      payload.soloPrice = Number(fd.get("soloPrice")) || 0;
    } else {
      payload.type = String(fd.get("type"));
      payload.art = payload.type;
      payload.driverFee = Number(fd.get("driverFee")) || 0;
      payload.sort = Number(fd.get("sort")) || 0;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      if (item) await api(`/admin/${kind}/${encodeURIComponent(item.id)}`, { method: "PUT", body: payload });
      else await api(`/admin/${kind}`, { method: "POST", body: payload });
      editor.close();
      toast(item ? "Perubahan disimpan" : "Data ditambahkan");
      await loadData();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
}

/* ---------------- pengaturan ---------------- */
/** Widget unggah foto untuk satu field pengaturan (mis. foto hero). */
function heroField(name, label, value) {
  const v = String(value || "");
  const labelId = `hero-label-${name}`;
  return `
    <div class="field field-full" data-hero-field="${name}">
      <span id="${labelId}">${esc(label)}</span>
      <div class="upload">
        <div class="upload-preview${v ? "" : " is-empty"}">${
          v ? `<img src="${esc(v)}" alt="">` : "Belum ada foto"
        }</div>
        <div class="upload-side">
          <div class="upload-actions">
            <label class="btn btn-glass btn-sm upload-btn">Unggah foto
              <input type="file" accept="image/png,image/jpeg,image/webp" data-hero-file hidden aria-label="Unggah ${esc(label)}">
            </label>
            <button type="button" class="btn btn-glass btn-sm" data-hero-clear aria-describedby="${labelId}">Hapus foto</button>
          </div>
          <p class="upload-hint">JPG/PNG/WebP · otomatis dikompres ke maks 1600 px.</p>
          <input name="${name}" type="text" maxlength="300" placeholder="atau tempel URL/path foto"
                 aria-labelledby="${labelId}" aria-describedby="${labelId}-hint" value="${esc(v)}">
          <span id="${labelId}-hint" class="upload-hint">Kosongkan untuk kembali memakai ilustrasi bawaan.</span>
        </div>
      </div>
    </div>`;
}

/** Pasang aksi unggah/hapus untuk semua widget foto hero di form pengaturan. */
function wireHeroFields(form) {
  form.querySelectorAll("[data-hero-field]").forEach((field) => {
    const input = field.querySelector("input[type='text']");
    const preview = field.querySelector(".upload-preview");
    const fileInput = field.querySelector("[data-hero-file]");
    const clearBtn = field.querySelector("[data-hero-clear]");

    const setPreview = (url) => {
      if (url) {
        preview.classList.remove("is-empty");
        preview.innerHTML = `<img src="${esc(url)}" alt="">`;
      } else {
        preview.classList.add("is-empty");
        preview.textContent = "Belum ada foto";
      }
    };

    input.addEventListener("input", () => setPreview(input.value.trim()));

    clearBtn.addEventListener("click", () => {
      input.value = "";
      setPreview("");
    });

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      const label = fileInput.closest("label");
      label.classList.add("is-busy");
      try {
        const url = await uploadPhoto(file);
        input.value = url;
        setPreview(url);
        toast("Foto diunggah — klik Simpan pengaturan");
      } catch (err) {
        toast(err.message);
      } finally {
        label.classList.remove("is-busy");
        fileInput.value = "";
      }
    });
  });
}

function renderSettings() {
  const s = state.data.settings;
  panel.innerHTML = `
    <div class="panel-head">
      <div><h2>Pengaturan situs</h2><p>Nomor WhatsApp, email, dan info kontak yang dipakai di semua bahasa.</p></div>
    </div>
    <form id="settings-form">
      <div class="settings-grid">
        <label class="field"><span>Nomor WhatsApp (format internasional, tanpa +)</span>
          <input name="phoneE164" type="text" inputmode="numeric" required value="${esc(s.phoneE164)}" placeholder="6281234567890">
        </label>
        <label class="field"><span>Nomor tampil</span>
          <input name="phoneDisplay" type="text" required value="${esc(s.phoneDisplay)}" placeholder="+62 812 3456 7890">
        </label>
        <label class="field field-full"><span>Email</span>
          <input name="email" type="email" required value="${esc(s.email)}">
        </label>
        <label class="field"><span>Instagram</span><input name="instagram" type="url" value="${esc(s.instagram || "")}"></label>
        <label class="field"><span>Facebook</span><input name="facebook" type="url" value="${esc(s.facebook || "")}"></label>
        <label class="field field-full"><span>Tripadvisor</span><input name="tripadvisor" type="url" value="${esc(s.tripadvisor || "")}"></label>
      </div>

      <h3 class="settings-sub">Foto hero (bagian paling atas halaman)</h3>
      <p class="hint">Foto besar di bagian atas. Disarankan lanskap, minimal 1600 × 900 px. Unggahan otomatis dikompres.</p>
      <div class="settings-grid">
        ${heroField("heroPhoto", "Halaman Tour (beranda)", s.heroPhoto)}
        ${heroField("rentalHeroPhoto", "Halaman Rental", s.rentalHeroPhoto)}
      </div>

      <div class="lang-tabs" role="tablist">
        ${LANGS.map(
          (l, i) => `<button type="button" class="lang-tab ${i === 0 ? "is-active" : ""}" data-lang="${l.code}">${l.short}</button>`
        ).join("")}
      </div>
      ${LANGS.map((l) => settingsPane(l, s)).join("")}
      <div class="editor-foot"><button type="submit" class="btn btn-primary">Simpan pengaturan</button></div>
      <p class="hint" style="margin-top:10px">Terakhir diubah: ${esc(state.data.updatedAt || "—")}</p>
    </form>`;

  const form = $("#settings-form");
  wireHeroFields(form);
  $$(".lang-tab", form).forEach((tab) =>
    tab.addEventListener("click", () => {
      $$(".lang-tab", form).forEach((t) => t.classList.toggle("is-active", t === tab));
      $$(".lang-pane", form).forEach((p) => (p.hidden = p.dataset.langPane !== tab.dataset.lang));
    })
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const address = {};
    const hours = {};
    for (const l of LANGS) {
      const pane = form.querySelector(`[data-lang-pane="${l.code}"]`);
      address[l.code] = pane.querySelector('[name="address"]').value.trim();
      hours[l.code] = pane.querySelector('[name="hours"]').value.trim();
    }
    const payload = {
      phoneE164: String(fd.get("phoneE164") || ""),
      phoneDisplay: String(fd.get("phoneDisplay") || ""),
      email: String(fd.get("email") || ""),
      instagram: String(fd.get("instagram") || ""),
      facebook: String(fd.get("facebook") || ""),
      tripadvisor: String(fd.get("tripadvisor") || ""),
      heroPhoto: String(fd.get("heroPhoto") || "").trim(),
      rentalHeroPhoto: String(fd.get("rentalHeroPhoto") || "").trim(),
      address,
      hours,
    };
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await api("/admin/settings", { method: "PUT", body: payload });
      toast("Pengaturan disimpan");
      await loadData();
    } catch (err) {
      toast(err.message);
    } finally {
      btn.disabled = false;
    }
  });
}

/* gambar yang gagal dimuat (foto belum ada) → tampilkan status kosong */
document.addEventListener(
  "error",
  (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement)) return;
    if (img.closest(".upload-preview")) {
      const box = img.parentElement;
      const field = img.closest("[data-hero-field]");
      const typed = field?.querySelector("input[type='text']")?.value.trim();
      img.remove();
      box.classList.add("is-empty");
      box.textContent = typed ? "Foto tidak bisa dimuat — periksa path/URL" : "Belum ada foto";
    } else if (img.closest(".row-thumb")) {
      img.remove();
    }
  },
  true
);

/* ---------------- keamanan: ganti username & kata sandi ---------------- */
function renderSecurity() {
  const sec = state.data.security || {};
  const sumber = sec.source === "panel" ? "diatur dari panel ini" : "diatur di server (environment variable)";
  const terakhir = sec.updatedAt ? new Date(sec.updatedAt).toLocaleString("id-ID") : "belum pernah diubah dari panel";

  panel.innerHTML = `
    <div class="panel-head">
      <div><h2>Keamanan akun admin</h2><p>Ganti nama pengguna dan kata sandi untuk masuk ke panel ini.</p></div>
    </div>

    <ul class="sec-info">
      <li><span>Nama pengguna aktif</span><strong>${esc(sec.user || "-")}</strong></li>
      <li><span>Sumber kredensial</span><strong>${esc(sumber)}</strong></li>
      <li><span>Terakhir diubah</span><strong>${esc(terakhir)}</strong></li>
    </ul>

    <form id="security-form" autocomplete="off">
      <div class="settings-grid">
        <label class="field field-full"><span>Kata sandi saat ini (wajib)</span>
          <input name="currentPassword" type="password" autocomplete="current-password" required>
        </label>
        <label class="field field-full"><span>Nama pengguna baru</span>
          <input name="username" type="text" minlength="3" maxlength="40" required value="${esc(sec.user || "")}" autocomplete="username">
        </label>
        <label class="field"><span>Kata sandi baru (min. 10 karakter)</span>
          <input name="password" type="password" minlength="10" maxlength="200" required autocomplete="new-password">
        </label>
        <label class="field"><span>Ulangi kata sandi baru</span>
          <input name="confirm" type="password" minlength="10" maxlength="200" required autocomplete="new-password">
        </label>
      </div>
      <p class="upload-hint">Nama pengguna: 3–40 karakter (huruf, angka, titik, garis bawah, @ dan -). Setelah disimpan, semua sesi login lain otomatis berakhir.</p>
      <p class="editor-error" id="security-error" hidden></p>
      <div class="editor-foot"><button type="submit" class="btn btn-primary">Simpan kredensial</button></div>
      <p class="hint" style="margin-top:10px">
        Lupa kata sandi? Set <code>ADMIN_USER</code> + <code>ADMIN_PASSWORD_HASH</code> di Cloudflare (environment variable),
        lalu set <code>ADMIN_RESET=1</code> supaya nilai dari server dipakai kembali.
      </p>
    </form>`;

  const form = $("#security-form");
  const errorEl = $("#security-error");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;

    const fd = new FormData(form);
    const username = String(fd.get("username") || "").trim();
    const password = String(fd.get("password") || "");
    const confirm = String(fd.get("confirm") || "");

    if (password !== confirm) {
      errorEl.textContent = "Ulangi kata sandi tidak sama.";
      errorEl.hidden = false;
      return;
    }
    if (password.length < 10) {
      errorEl.textContent = "Kata sandi baru minimal 10 karakter.";
      errorEl.hidden = false;
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await api("/admin/credentials", {
        method: "PUT",
        allow401: true,
        body: {
          currentPassword: String(fd.get("currentPassword") || ""),
          username,
          password,
          confirm,
        },
      });
      toast("Kredensial diperbarui");
      form.querySelector('[name="currentPassword"]').value = "";
      form.querySelector('[name="password"]').value = "";
      form.querySelector('[name="confirm"]').value = "";
      await loadData();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
}

/* ---------------- boot ---------------- */
/* kalau tautan reset ada, tampilkan form reset segera (tanpa menunggu sesi) */
if (resetToken) {
  appView.hidden = true;
  loginView.hidden = false;
  showView("reset");
}

(async function boot() {
  try {
    const res = await fetch("/api/session", { credentials: "same-origin" });
    if (res.ok) {
      showApp();
      await loadData();
    } else {
      showLogin();
    }
  } catch {
    showLogin("Server tidak merespons.");
  }
})();