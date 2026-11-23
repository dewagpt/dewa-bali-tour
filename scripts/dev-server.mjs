#!/usr/bin/env node
/* ============================================================
   Dev server: menyajikan dist/ + menjalankan API yang sama
   dengan Cloudflare Pages Functions (auth + CRUD).
   Jalankan: node scripts/dev-server.mjs [port]
   ============================================================ */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleApi } from "../functions/_lib/api.js";
import { FileStore } from "../functions/_lib/store.node.js";
import { FileMedia } from "../functions/_lib/media.node.js";
import { site } from "../content/content.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, "..", "dist");
const DATA_FILE = path.join(ROOT, "..", ".data", "site.json");
const PORT = Number(process.argv[2] || 4173);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

const store = new FileStore(DATA_FILE);
const media = new FileMedia(path.join(ROOT, "..", ".data", "uploads"));

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  /* ---------- API ---------- */
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;

      const request = new Request(url, {
        method: req.method,
        headers: req.headers,
        body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
      });

      const response = await handleApi(request, { __store: store, __media: media });
      const out = Buffer.from(await response.arrayBuffer());

      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(out);
    } catch (err) {
      console.error("[api]", err);
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Kesalahan server: " + err.message }));
    }
    return;
  }

  /* ---------- berkas statis ---------- */
  const pathname = decodeURIComponent(url.pathname);
  let file = path.join(DIST, pathname);

  if (!file.startsWith(DIST)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    file = path.join(file, "index.html");
  }

  if (!fs.existsSync(file) && !path.extname(file)) {
    const alt = path.join(file, "index.html");
    if (fs.existsSync(alt)) file = alt;
  }

  if (!fs.existsSync(file)) {
    const notFound = path.join(DIST, "404.html");
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    res.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : "404");
    return;
  }

  res.writeHead(200, {
    "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
    "cache-control": "no-store",
  });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`
  Dewa Bali Tour — server lokal
  ─────────────────────────────────────────────
  Situs    : http://localhost:${PORT}/id/
  Rental   : http://localhost:${PORT}/id/rental/
  Admin    : http://localhost:${PORT}${site.adminPath}
  Data     : ${DATA_FILE}
  Login    : dewa-200280-bali / dewa-200280-bali
  ─────────────────────────────────────────────
`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`
  Port ${PORT} sudah dipakai proses lain.
  Biasanya karena server lama masih jalan di latar belakang.

  Cara cepat:
    lsof -ti tcp:${PORT} | xargs kill
    npm run dev

  Atau pakai port lain:
    node scripts/dev-server.mjs 4174
`);
  } else {
    console.error("\n  Server gagal jalan:", err.message, "\n");
  }
  process.exit(1);
});