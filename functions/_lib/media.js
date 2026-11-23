/* Penyimpanan media di Cloudflare R2 (produksi).
   Binding: BUCKET (lihat wrangler.toml / README). */

export class R2Media {
  constructor(bucket) {
    this.bucket = bucket;
  }

  async put(key, body, contentType) {
    await this.bucket.put(key, body, {
      httpMetadata: {
        contentType,
        cacheControl: "public, max-age=31536000, immutable",
      },
    });
  }

  async get(key) {
    const obj = await this.bucket.get(key);
    if (!obj) return null;
    return {
      body: obj.body,
      contentType: obj.httpMetadata?.contentType || "application/octet-stream",
    };
  }
}

export const MEDIA_KEY_RE = /^img\/[a-z0-9-]{6,60}\.(jpg|jpeg|png|webp|avif)$/i;

export const EXT_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};