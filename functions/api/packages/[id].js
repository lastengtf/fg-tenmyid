// GET, PUT, DELETE /api/packages/:id
import { jsonResponse, getPackage, savePackage, deletePackage } from '../_utils.js';

export async function onRequestGet(context) {
  const { env, params } = context;
  const pkg = await getPackage(env, params.id);
  if (!pkg) return jsonResponse({ error: 'Paket tidak ditemukan.' }, 404);
  return jsonResponse({ package: pkg });
}

export async function onRequestPut(context) {
  const { request, env, params } = context;
  const id = params.id;
  try {
    const existing = await getPackage(env, id);
    if (!existing) return jsonResponse({ error: 'Paket tidak ditemukan.' }, 404);

    const data = await request.json();
    const updated = await savePackage(env, {
      ...existing,
      name: data.name !== undefined ? data.name.trim() : existing.name,
      category: data.category !== undefined ? data.category : existing.category,
      price: data.price !== undefined ? Number(data.price) : existing.price,
      description: data.description !== undefined ? data.description.trim() : existing.description
    });
    return jsonResponse({ success: true, package: updated });
  } catch (err) {
    return jsonResponse({ error: 'Gagal memperbarui paket: ' + err.message }, 500);
  }
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  try {
    await deletePackage(env, params.id);
    return jsonResponse({ success: true, message: 'Paket berhasil dihapus.' });
  } catch (err) {
    return jsonResponse({ error: 'Gagal menghapus paket: ' + err.message }, 500);
  }
}
