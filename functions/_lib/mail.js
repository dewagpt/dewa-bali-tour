/* Pengiriman email transaksional lewat API HTTP (Resend).
   Cloudflare Workers/Pages tidak mendukung SMTP, jadi memakai HTTP API.

   Env yang dipakai:
     RESEND_API_KEY  → API key dari resend.com (wajib untuk kirim email)
     MAIL_FROM       → pengirim, mis. "Dewa Bali Tour <no-reply@dewabalitour.com>"
     ADMIN_EMAIL     → alamat penerima reset kata sandi
*/

const DEFAULT_FROM = "Dewa Bali Tour <no-reply@dewabalitour.com>";

export function mailConfigured(env) {
  return Boolean(env.RESEND_API_KEY);
}

export function resetEmailHtml({ name, link, minutes }) {
  return `<!doctype html>
<html lang="id"><body style="margin:0;padding:24px;background:#f6f2ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#14121a">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:20px;padding:28px;border:1px solid rgba(24,18,44,.08)">
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#0e9488;font-weight:700">${name}</p>
    <h1 style="margin:0 0 12px;font-size:22px;letter-spacing:-.02em">Reset kata sandi panel admin</h1>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#56506a">
      Kami menerima permintaan untuk mengatur ulang kata sandi panel admin. Klik tombol di bawah untuk membuat kata sandi baru.
      Tautan ini berlaku ${minutes} menit dan hanya bisa dipakai sekali.
    </p>
    <p style="margin:0 0 22px">
      <a href="${link}" style="display:inline-block;padding:13px 22px;border-radius:999px;background:#0e9488;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px">Buat kata sandi baru</a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#8b849c">Kalau tombol tidak bisa diklik, salin tautan ini ke browser:</p>
    <p style="margin:0 0 18px;font-size:12px;word-break:break-all;color:#0a6e6a">${link}</p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#8b849c">
      Tidak merasa meminta ini? Abaikan email ini — kata sandi Anda tidak berubah.
    </p>
  </div>
</body></html>`;
}

export async function sendMail(env, { to, subject, html, text }) {
  if (!mailConfigured(env)) {
    throw new Error("Email belum dikonfigurasi (RESEND_API_KEY belum diset).");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.MAIL_FROM || DEFAULT_FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text: text || undefined,
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      detail = await res.text().catch(() => "");
    }
    throw new Error(`Pengiriman email gagal (${res.status}): ${detail.slice(0, 200)}`);
  }
  return res.json().catch(() => ({ ok: true }));
}