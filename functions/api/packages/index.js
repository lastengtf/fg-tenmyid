// GET & POST /api/packages
import { jsonResponse, getAllPackages, savePackage } from '../_utils.js';

export async function onRequestGet(context) {
  const { env } = context;
  const packages = await getAllPackages(env);
  return jsonResponse({ packages });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    if (!data.name || !data.name.trim()) {
      return jsonResponse({ error: 'Nama paket wajib diisi.' }, 400);
    }

    const pkg = await savePackage(env, {
      name: data.name.trim(),
      category: data.category || 'Wedding',
      price: Number(data.price) || 0,
      description: (data.description || '').trim()
    });

    return jsonResponse({ success: true, package: pkg }, 201);
  } catch (err) {
    return jsonResponse({ error: 'Gagal membuat paket: ' + err.message }, 500);
  }
}
