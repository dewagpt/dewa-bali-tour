/* Primitif kripto — hanya Web Crypto (bisa jalan di Workers & Node 20+). */

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64url(bytes) {
  let s = "";
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(str) {
  const pad = str.length % 4 ? "=".repeat(4 - (str.length % 4)) : "";
  const s = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function timingSafeBytes(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function timingSafeStrings(a = "", b = "") {
  return timingSafeBytes(enc.encode(String(a)), enc.encode(String(b)));
}

async function pbkdf2Bits(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256
  );
  return new Uint8Array(bits);
}

/** Format: pbkdf2$<iterasi>$<salt-b64url>$<hash-b64url> */
export async function hashPassword(password, iterations = 20000) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await pbkdf2Bits(password, salt, iterations);
  return `pbkdf2$${iterations}$${b64url(salt)}$${b64url(bits)}`;
}

export async function verifyPassword(password, stored) {
  try {
    const [scheme, iter, saltB64, hashB64] = String(stored).split("$");
    if (scheme !== "pbkdf2") return false;
    const iterations = Number(iter);
    if (!Number.isFinite(iterations) || iterations < 1000) return false;
    const salt = b64urlDecode(saltB64);
    const expected = b64urlDecode(hashB64);
    const bits = await pbkdf2Bits(password, salt, iterations);
    return timingSafeBytes(bits, expected);
  } catch {
    return false;
  }
}

export async function hmacSha256(data, secret) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

export function randomId(bytes = 12) {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export { enc, dec };