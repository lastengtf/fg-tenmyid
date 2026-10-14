// Middleware for Authentication & Route Protection
import { jsonResponse, verifySession } from './api/_utils.js';

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }

  // Public paths that do not require login
  const pathname = url.pathname;
  const isApi = pathname.startsWith('/api/');
  const isPublicAuth = pathname === '/api/auth/login';
  const isPortal = pathname.startsWith('/api/portal/');
  const isPublicApi = pathname.startsWith('/api/public/');

  // Allow static files and public API endpoints
  if (!isApi || isPublicAuth || isPortal || isPublicApi) {
    return await next();
  }

  // Check auth session
  const session = await verifySession(request, env);
  if (!session) {
    return jsonResponse({ error: 'Unauthorized. Silakan login terlebih dahulu.' }, 401);
  }

  // Attach session user to data
  context.data = context.data || {};
  context.data.user = session;

  return await next();
}
