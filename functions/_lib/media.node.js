/* Penyimpanan media lokal — HANYA untuk dev server.
   File disimpan di .data/uploads/img/... dan disajikan lewat /api/media/... */

import fs from "node:fs/promises";
import path from "node:path";

export class FileMedia {
  constructor(root) {
    this.root = root;
  }

  fileFor(key) {
    return path.join(this.root, key);
  }

  async put(key, body, contentType) {
    const file = this.fileFor(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const bytes = body instanceof Uint8Array ? body : new Uint8Array(await new Response(body).arrayBuffer());
    await fs.writeFile(file, bytes);
    await fs.writeFile(`${file}.type`, contentType, "utf8");
  }

  async get(key) {
    try {
      const file = this.fileFor(key);
      const bytes = await fs.readFile(file);
      let contentType = "application/octet-stream";
      try {
        contentType = (await fs.readFile(`${file}.type`, "utf8")).trim() || contentType;
      } catch {
        /* abaikan */
      }
      return { body: bytes, contentType };
    } catch {
      return null;
    }
  }
}