/* Utilitas bersama (dipakai build & Functions). Hanya API standar Web/JS. */

/** JSON stabil (kunci terurut) — dipakai untuk menghitung revisi data. */
export function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

/** SHA-1 hex dari data — dipakai sebagai penanda revisi konten. */
export async function revOfAsync(value) {
  const data = new TextEncoder().encode(stableStringify(value));
  const digest = await crypto.subtle.digest("SHA-1", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 12);
}

/* Versi sinkron untuk build (Node) memakai crypto bawaan Node. */
export function revOf(value) {
  // eslint-disable-next-line no-undef
  const { createHash } = globalThis.process
    ? globalThis.process.getBuiltinModule
      ? globalThis.process.getBuiltinModule("node:crypto")
      : null
    : {};
  if (!createHash) throw new Error("revOf() hanya untuk Node; pakai revOfAsync() di runtime.");
  return createHash("sha1").update(stableStringify(value)).digest("hex").slice(0, 12);
}