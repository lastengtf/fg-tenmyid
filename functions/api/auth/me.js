// GET /api/auth/me
import { jsonResponse } from '../_utils.js';

export async function onRequestGet(context) {
  const user = context.data ? context.data.user : null;
  if (!user) {
    return jsonResponse({ authenticated: false }, 401);
  }
  return jsonResponse({
    authenticated: true,
    email: user.email,
    createdAt: user.createdAt
  });
}
