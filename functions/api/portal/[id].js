// GET /api/portal/:id - Public Read-Only Endpoint for Client Portal
import { jsonResponse, getProject, getSettings } from '../_utils.js';

export async function onRequestGet(context) {
  const { env, params } = context;
  const id = params.id;

  let project = await getProject(env, id);
  if (!project) {
    const { getAllProjects } = await import('../_utils.js');
    const all = await getAllProjects(env);
    project = all.find(p => p.portalKey === id || p.id === id);
  }

  if (!project) {
    return jsonResponse({ error: 'Data sesi foto tidak ditemukan atau tautan salah.' }, 404);
  }

  const settings = await getSettings(env);

  // Return clean client-safe view (strip private internal notes)
  return jsonResponse({
    project: {
      id: project.id,
      title: project.title,
      clientName: project.clientName,
      category: project.category,
      date: project.date,
      time: project.time,
      endTime: project.endTime,
      location: project.location,
      mapsUrl: project.mapsUrl,
      packageName: project.packageName,
      packagePrice: project.packagePrice,
      addOns: project.addOns,
      addOnsPrice: project.addOnsPrice,
      totalPrice: project.totalPrice,
      dpAmount: project.dpAmount,
      dpDate: project.dpDate,
      paymentStatus: project.paymentStatus,
      paymentNotes: project.paymentNotes,
      workflowStatus: project.workflowStatus,
      driveUrl: project.driveUrl,
      selectionUrl: project.selectionUrl,
      selectionQuota: Number(project.selectionQuota) || 20,
      selectedPhotos: project.selectedPhotos || '',
      deliverables: project.deliverables || []
    },
    studio: {
      studioName: settings.studioName,
      phone: settings.phone,
      email: settings.email,
      instagram: settings.instagram,
      bankName: settings.bankName,
      bankAccount: settings.bankAccount,
      bankHolder: settings.bankHolder
    }
  });
}

// POST /api/portal/:id - Client submits selected photos
export async function onRequestPost(context) {
  const { request, env, params } = context;
  const id = params.id;

  let project = await getProject(env, id);
  if (!project) {
    const { getAllProjects } = await import('../_utils.js');
    const all = await getAllProjects(env);
    project = all.find(p => p.portalKey === id || p.id === id);
  }

  if (!project) {
    return jsonResponse({ error: 'Data sesi foto tidak ditemukan.' }, 404);
  }

  const data = await request.json();
  const rawPhotos = data.selectedPhotos;
  let photoList = [];

  if (Array.isArray(rawPhotos)) {
    photoList = rawPhotos.map(s => String(s).trim()).filter(Boolean);
  } else if (typeof rawPhotos === 'string') {
    photoList = rawPhotos.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
  }

  // Deduplicate
  photoList = [...new Set(photoList)];

  const quota = Number(project.selectionQuota) || 20;
  if (photoList.length > quota) {
    return jsonResponse({
      error: `Jumlah foto yang Anda pilih (${photoList.length} foto) melebihi batas kuota paket (${quota} foto). Silakan hapus beberapa foto.`
    }, 400);
  }

  project.selectedPhotos = photoList.join(', ');
  project.selectedAt = new Date().toISOString();
  if (project.workflowStatus === 'shooting_done') {
    project.workflowStatus = 'selection';
  }

  const { saveProject } = await import('../_utils.js');
  await saveProject(env, project);

  return jsonResponse({
    success: true,
    message: 'Daftar nomor foto pilihan Anda berhasil disimpan dan dikirim ke fotografer!',
    selectedPhotos: project.selectedPhotos,
    selectedCount: photoList.length,
    selectionQuota: quota
  });
}
