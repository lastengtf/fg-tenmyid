// GET, PUT, DELETE /api/clients/:id
import { jsonResponse, getClient, saveClient, deleteClient, getAllProjects } from '../_utils.js';

export async function onRequestGet(context) {
  const { env, params } = context;
  const id = params.id;
  const client = await getClient(env, id);

  if (!client) {
    return jsonResponse({ error: 'Klien tidak ditemukan.' }, 404);
  }

  // Ambil semua proyek yang terkait dengan klien ini
  const allProjects = await getAllProjects(env);
  const clientProjects = allProjects.filter(p => p.clientId === id);

  return jsonResponse({ client, projects: clientProjects });
}

export async function onRequestPut(context) {
  const { request, env, params } = context;
  const id = params.id;

  try {
    const existing = await getClient(env, id);
    if (!existing) {
      return jsonResponse({ error: 'Klien tidak ditemukan.' }, 404);
    }

    const data = await request.json();
    const updated = await saveClient(env, {
      ...existing,
      name: data.name !== undefined ? data.name.trim() : existing.name,
      phone: data.phone !== undefined ? data.phone.trim() : existing.phone,
      email: data.email !== undefined ? data.email.trim() : existing.email,
      instagram: data.instagram !== undefined ? data.instagram.trim() : existing.instagram,
      notes: data.notes !== undefined ? data.notes.trim() : existing.notes
    });

    return jsonResponse({ success: true, client: updated });
  } catch (err) {
    return jsonResponse({ error: 'Gagal memperbarui klien: ' + err.message }, 500);
  }
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const id = params.id;

  try {
    await deleteClient(env, id);
    return jsonResponse({ success: true, message: 'Klien berhasil dihapus.' });
  } catch (err) {
    return jsonResponse({ error: 'Gagal menghapus klien: ' + err.message }, 500);
  }
}
