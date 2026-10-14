// GET & POST /api/clients
import { jsonResponse, getAllClients, saveClient } from '../_utils.js';

export async function onRequestGet(context) {
  const { env } = context;
  const clients = await getAllClients(env);
  return jsonResponse({ clients });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    if (!data.name || !data.name.trim()) {
      return jsonResponse({ error: 'Nama klien wajib diisi.' }, 400);
    }

    const newClient = await saveClient(env, {
      name: data.name.trim(),
      phone: (data.phone || '').trim(),
      email: (data.email || '').trim(),
      instagram: (data.instagram || '').trim(),
      notes: (data.notes || '').trim()
    });

    return jsonResponse({ success: true, client: newClient }, 201);
  } catch (err) {
    return jsonResponse({ error: 'Gagal membuat klien: ' + err.message }, 500);
  }
}
