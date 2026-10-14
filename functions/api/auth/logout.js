// POST /api/auth/logout
import { jsonResponse, getAuthToken, deleteSession } from '../_utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const token = getAuthToken(request);

  if (token) {
    await deleteSession(env, token);
  }

  const cookieHeader = 'fg_session=; Path=/; Max-Age=0; SameSite=Lax';

  return jsonResponse({
    success: true,
    message: 'Logout berhasil.'
  }, 200, {
    'Set-Cookie': cookieHeader
  });
}
