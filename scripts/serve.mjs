#!/usr/bin/env node
/* Server statis kecil untuk pratinjau lokal — tanpa dependensi.
   Pakai: node scripts/serve.mjs [folder] [port] */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(process.argv[2] || path.join(ROOT, "..", "dist"));
const port = Number(process.argv[3] || 4173);

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

http
  .createServer((req, res) => {
    const url = decodeURIComponent((req.url || "/").split("?")[0]);
    let file = path.join(dir, url);

    if (!file.startsWith(dir)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file) && fs.existsSync(`${file}.html`)) file = `${file}.html`;

    if (!fs.existsSync(file)) {
      const notFound = path.join(dir, "404.html");
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      res.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : "404");
      return;
    }

    res.writeHead(200, {
      "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store",
    });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => {
    console.log(`\n  Dewa Bali Tour → http://localhost:${port}/id/\n  (folder: ${dir})\n`);
  })
  .on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `\n  Port ${port} sudah dipakai proses lain.\n` +
          `  Kemungkinan server lama masih jalan di latar belakang.\n\n` +
          `  Cara cepat:\n` +
          `    lsof -ti tcp:${port} | xargs kill\n` +
          `    npm run preview\n\n` +
          `  Atau pakai port lain:  node scripts/serve.mjs dist 4174\n`
      );
    } else {
      console.error("\n  Server gagal jalan:", err.message, "\n");
    }
    process.exit(1);
  });