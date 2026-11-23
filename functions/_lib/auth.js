/* Sesi admin: token HMAC (stateless) di cookie HttpOnly. */

import { b64url, b64urlDecode, dec, enc, hmacSha256, timingSafeStrings } from "./crypto.js";
import { MAX_LOGIN_ATTEMPTS, LOGIN_WINDOW_MS, SESSION_TTL } from "./config.js";

export const COOKIE_NAME = "dbt_admin";

export function parseCookies(header = "") {
  const out = {};
  String(header)
    .split(";")
    .forEach((part) => {
      const i = part.indexOf("=");
      if (i < 0) return;
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    });
  return out;
}

export async function createSession(secret, user, version = "", ttl = SESSION_TTL) {
  const now = Date.now();
  const body = b64url(enc.encode(JSON.stringify({ u: user, v: version, iat: now, exp: now + ttl * 1000 })));
  const sig = b64url(await hmacSha256(`v1.${body}`, secret));
  return `${body}.${sig}`;
}

export async function readSession(request, secret) {
  if (!secret) return null;
  const token = parseCookies(request.headers.get("cookie") || "")[COOKIE_NAME];
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = b64url(await hmacSha256(`v1.${body}`, secret));
  if (!timingSafeStrings(expected, sig)) return null;
  try {
    const payload = JSON.parse(dec.decode(b64urlDecode(body)));
    if (!payload?.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookie(request, token, ttl = SESSION_TTL) {
  const secure = new URL(request.url).protocol === "https:";
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${ttl}${
    secure ? "; Secure" : ""
  }`;
}

export function clearSessionCookie(request) {
  const secure = new URL(request.url).protocol === "https:";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`;
}

export function clientIp(request) {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "local";
}

/* Rate limit login (in-memory per instance; cukup untuk satu admin). */
const attempts = new Map();

export function loginBlocked(ip) {
  const rec = attempts.get(ip);
  if (!rec) return 0;
  if (Date.now() > rec.until) {
    attempts.delete(ip);
    return 0;
  }
  return rec.n >= MAX_LOGIN_ATTEMPTS ? Math.ceil((rec.until - Date.now()) / 1000) : 0;
}

export function noteLoginFailure(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now > rec.until) {
    attempts.set(ip, { n: 1, until: now + LOGIN_WINDOW_MS });
    return;
  }
  rec.n += 1;
  rec.until = now + LOGIN_WINDOW_MS;
}

export function resetLoginFailures(ip) {
  attempts.delete(ip);
}

/* Rate limit permintaan reset kata sandi: 3 kali / 15 menit per IP. */
const forgot = new Map();
const FORGOT_MAX = 3;
const FORGOT_WINDOW_MS = 15 * 60 * 1000;

export function forgotBlocked(ip) {
  const rec = forgot.get(ip);
  if (!rec) return 0;
  if (Date.now() > rec.until) {
    forgot.delete(ip);
    return 0;
  }
  return rec.n >= FORGOT_MAX ? Math.ceil((rec.until - Date.now()) / 1000) : 0;
}

export function noteForgot(ip) {
  const now = Date.now();
  const rec = forgot.get(ip);
  if (!rec || now > rec.until) {
    forgot.set(ip, { n: 1, until: now + FORGOT_WINDOW_MS });
    return;
  }
  rec.n += 1;
  rec.until = now + FORGOT_WINDOW_MS;
}

export function isLocalRequest(request) {
  try {
    const host = new URL(request.url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".local");
  } catch {
    return false;
  }
}