/* Penyimpanan berbasis file — HANYA untuk dev server lokal.
   Di Cloudflare, data disimpan di D1 (lihat store.js). */

import fs from "node:fs/promises";
import path from "node:path";

export class FileStore {
  constructor(file) {
    this.file = file;
  }

  async read() {
    try {
      return JSON.parse(await fs.readFile(this.file, "utf8"));
    } catch {
      return null;
    }
  }

  async write(data) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(data, null, 2), "utf8");
  }
}