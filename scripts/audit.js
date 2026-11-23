/* audit.js — mengukur layout nyata di browser, hasil ditulis ke <pre id="audit"> */
(() => {
  const qp = new URLSearchParams(location.search).get("theme");
  if (qp) { document.documentElement.dataset.theme = qp; try { localStorage.setItem("dbt-theme", qp); } catch {} }
  const px = (n) => Math.round(n * 10) / 10;
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: px(r.x), y: px(r.y + window.scrollY), w: px(r.width), h: px(r.height) };
  };
  const sel = [
    "header.nav", ".nav", ".brand", ".nav-actions", ".hero", ".hero-copy", "h1.display", ".lede", ".hero-cta", ".proof",
    ".hero-visual", ".window", ".win-art", ".win-info", ".trust-row", ".stats-inner",
    "#tours", ".tour-grid", ".tour", ".tour-art", "#why", ".feature-grid", ".feature",
    "#steps", ".step-grid", ".step", "#reviews", ".review-grid", ".review",
    "#faq", ".faq-list", ".faq", ".cta-band", "#contact", ".contact-grid", ".info", ".form",
    ".footer", ".fab-glass", ".marquee",
  ];
  const out = { viewport: { w: innerWidth, h: innerHeight }, scroll: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }, blocks: {}, issues: [], samples: {} };

  for (const s of sel) {
    const el = document.querySelector(s);
    out.blocks[s] = rect(el);
  }

  // overflow horizontal
  if (document.documentElement.scrollWidth > innerWidth + 1) {
    out.issues.push(`horizontal overflow: scrollWidth ${document.documentElement.scrollWidth} > ${innerWidth}`);
  }
  document.querySelectorAll("body *").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.right > innerWidth + 2 && getComputedStyle(el).position !== "fixed") {
      const cls = typeof el.className === "string" ? el.className : "";
      if (out.issues.length < 12) out.issues.push(`keluar viewport: <${el.tagName.toLowerCase()} class="${cls.slice(0, 40)}"> right=${px(r.right)}`);
    }
  });

  // teks terpotong
  document.querySelectorAll("h1,h2,h3,p,span,a,li,summary").forEach((el) => {
    if (el.children.length) return;
    if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== "visible") {
      if (out.issues.length < 20) out.issues.push(`teks terpotong: "${el.textContent.trim().slice(0, 32)}" ${el.scrollWidth}>${el.clientWidth}`);
    }
  });

  // visibilitas
  const hidden = [...document.querySelectorAll("[data-reveal]")].filter((e) => getComputedStyle(e).opacity === "0");
  out.revealHidden = hidden.length;
  out.tourCards = document.querySelectorAll(".tour").length;
  out.tourVisible = [...document.querySelectorAll(".tour")].filter((c) => getComputedStyle(c).display !== "none").length;
  out.artRendered = [...document.querySelectorAll("svg.art")].filter((s) => s.getBoundingClientRect().width > 40).length;
  out.placeholders = (document.body.innerText.match(/\[\[[^\]]+\]\]/g) || []).length;

  const cs = getComputedStyle(document.documentElement);
  out.dark = document.documentElement.dataset.theme;
  out.tokens = {
    ink: cs.getPropertyValue("--ink").trim(),
    page: cs.getPropertyValue("--page").trim(),
    teal: cs.getPropertyValue("--teal").trim(),
    glassTop: cs.getPropertyValue("--glass-top").trim(),
    fieldBg: cs.getPropertyValue("--field-bg").trim(),
  };
  out.samples.h1 = (() => {
    const h = document.querySelector("h1.display");
    if (!h) return null;
    const c = getComputedStyle(h);
    return { fontSize: c.fontSize, lineHeight: c.lineHeight, letterSpacing: c.letterSpacing, color: c.color, text: h.innerText.slice(0, 70) };
  })();
  out.samples.blockHeights = [...document.querySelectorAll("section")].map((s) => ({ id: s.id || s.className.slice(0, 18), h: px(s.getBoundingClientRect().height) }));

  const pre = document.createElement("pre");
  pre.id = "audit";
  pre.textContent = JSON.stringify(out, null, 1);
  document.body.appendChild(pre);
})();