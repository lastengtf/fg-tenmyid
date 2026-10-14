// GET /api/public/track?q=... - Search project by portal ID or client phone
import { jsonResponse, getAllProjects, getProject } from '../_utils.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();

  if (!q) {
    return jsonResponse({ error: 'Masukkan ID Sesi Foto atau nomor WhatsApp Anda.' }, 400);
  }

  // Check direct project id
  let project = await getProject(env, q);
  if (project) {
    return jsonResponse({
      found: true,
      projectId: project.id,
      title: project.title,
      clientName: project.clientName,
      workflowStatus: project.workflowStatus,
      date: project.date
    });
  }

  // Search by portalKey or phone
  const allProjects = await getAllProjects(env);
  const cleanQ = q.replace(/\D/g, '');

  const matched = allProjects.find(p => {
    if (p.portalKey === q || p.id === q) return true;
    if (cleanQ && cleanQ.length >= 8) {
      const cleanPhone = (p.clientPhone || '').replace(/\D/g, '');
      return cleanPhone.endsWith(cleanQ) || cleanQ.endsWith(cleanPhone);
    }
    return false;
  });

  if (!matched) {
    return jsonResponse({
      found: false,
      message: 'Tidak ditemukan sesi foto yang cocok dengan pencarian Anda. Silakan cek kembali nomor WA atau ID Sesi Anda.'
    }, 404);
  }

  return jsonResponse({
    found: true,
    projectId: matched.id,
    title: matched.title,
    clientName: matched.clientName,
    workflowStatus: matched.workflowStatus,
    date: matched.date
  });
}
