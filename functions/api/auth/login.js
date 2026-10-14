// POST /api/auth/login
import { jsonResponse, createSession } from '../_utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return jsonResponse({ error: 'Email dan password wajib diisi.' }, 400);
    }

    // Ambil kredensial dari environment variable Cloudflare Dashboard
    const configuredEmail = env.AUTH_EMAIL || 'admin@fg.ten.my.id';
    const configuredPassword = env.AUTH_PASSWORD || 'admin123';

    // Verifikasi kredensial
    const isEmailValid = email.trim().toLowerCase() === configuredEmail.trim().toLowerCase();
    const isPasswordValid = password === configuredPassword;

    if (!isEmailValid || !isPasswordValid) {
      return jsonResponse({
        error: 'Email atau password salah. Pastikan sesuai dengan variabel AUTH_EMAIL & AUTH_PASSWORD di Cloudflare.'
      }, 401);
    }

    // Buat token sesi dan simpan di KV
    const token = await createSession(env, configuredEmail);

    // Set cookie fg_session
    const isHttps = request.url.startsWith('https');
    const cookieFlags = `Path=/; Max-Age=2592000; SameSite=Lax${isHttps ? '; Secure' : ''}`;
    const cookieHeader = `fg_session=${token}; ${cookieFlags}`;

    return jsonResponse({
      success: true,
      token,
      email: configuredEmail,
      message: 'Login berhasil.'
    }, 200, {
      'Set-Cookie': cookieHeader
    });
  } catch (err) {
    return jsonResponse({ error: 'Terjadi kesalahan server saat login: ' + err.message }, 500);
  }
}
