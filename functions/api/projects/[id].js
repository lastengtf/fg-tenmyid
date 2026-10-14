// GET, PUT, DELETE /api/projects/:id
import { jsonResponse, getProject, saveProject, deleteProject, getClient } from '../_utils.js';

export async function onRequestGet(context) {
  const { env, params } = context;
  const id = params.id;
  const project = await getProject(env, id);

  if (!project) {
    return jsonResponse({ error: 'Proyek foto tidak ditemukan.' }, 404);
  }

  // Also include fresh client info if available
  let client = null;
  if (project.clientId) {
    client = await getClient(env, project.clientId);
  }

  return jsonResponse({ project, client });
}

export async function onRequestPut(context) {
  const { request, env, params } = context;
  const id = params.id;

  try {
    const existing = await getProject(env, id);
    if (!existing) {
      return jsonResponse({ error: 'Proyek foto tidak ditemukan.' }, 404);
    }

    const data = await request.json();

    const packagePrice = data.packagePrice !== undefined ? Number(data.packagePrice) : (existing.packagePrice || 0);
    const addOnsPrice = data.addOnsPrice !== undefined ? Number(data.addOnsPrice) : (existing.addOnsPrice || 0);
    const totalPrice = data.totalPrice !== undefined ? Number(data.totalPrice) : (packagePrice + addOnsPrice);
    const dpAmount = data.dpAmount !== undefined ? Number(data.dpAmount) : (existing.dpAmount || 0);

    let paymentStatus = data.paymentStatus || existing.paymentStatus || 'unpaid';
    if (dpAmount >= totalPrice && totalPrice > 0) {
      paymentStatus = 'paid';
    } else if (dpAmount > 0 && paymentStatus === 'unpaid') {
      paymentStatus = 'dp_paid';
    }

    const updated = await saveProject(env, {
      ...existing,
      title: data.title !== undefined ? data.title.trim() : existing.title,
      clientId: data.clientId !== undefined ? data.clientId : existing.clientId,
      clientName: data.clientName !== undefined ? data.clientName.trim() : existing.clientName,
      clientPhone: data.clientPhone !== undefined ? data.clientPhone.trim() : existing.clientPhone,
      clientEmail: data.clientEmail !== undefined ? data.clientEmail.trim() : existing.clientEmail,
      category: data.category !== undefined ? data.category : existing.category,
      date: data.date !== undefined ? data.date : existing.date,
      time: data.time !== undefined ? data.time : existing.time,
      endTime: data.endTime !== undefined ? data.endTime : existing.endTime,
      location: data.location !== undefined ? data.location.trim() : existing.location,
      mapsUrl: data.mapsUrl !== undefined ? data.mapsUrl.trim() : existing.mapsUrl,
      packageName: data.packageName !== undefined ? data.packageName.trim() : existing.packageName,
      packagePrice: packagePrice,
      addOns: data.addOns !== undefined ? data.addOns.trim() : existing.addOns,
      addOnsPrice: addOnsPrice,
      totalPrice: totalPrice,
      dpAmount: dpAmount,
      dpDate: data.dpDate !== undefined ? data.dpDate : existing.dpDate,
      paymentStatus: paymentStatus,
      paymentNotes: data.paymentNotes !== undefined ? data.paymentNotes.trim() : existing.paymentNotes,
      workflowStatus: data.workflowStatus !== undefined ? data.workflowStatus : existing.workflowStatus,
      driveUrl: data.driveUrl !== undefined ? data.driveUrl.trim() : existing.driveUrl,
      selectionUrl: data.selectionUrl !== undefined ? data.selectionUrl.trim() : existing.selectionUrl,
      deliverables: data.deliverables !== undefined ? data.deliverables : existing.deliverables,
      expenses: data.expenses !== undefined ? data.expenses : (existing.expenses || []),
      shotlist: data.shotlist !== undefined ? data.shotlist : (existing.shotlist || []),
      gearChecklist: data.gearChecklist !== undefined ? data.gearChecklist : (existing.gearChecklist || []),
      selectionQuota: data.selectionQuota !== undefined ? (Number(data.selectionQuota) || 20) : (existing.selectionQuota || 20),
      selectedPhotos: data.selectedPhotos !== undefined ? data.selectedPhotos.trim() : (existing.selectedPhotos || ''),
      photoNotes: data.photoNotes !== undefined ? data.photoNotes : (existing.photoNotes || {}),
      drivePhotos: data.drivePhotos !== undefined ? data.drivePhotos : (existing.drivePhotos || []),
      notes: data.notes !== undefined ? data.notes.trim() : existing.notes
    });

    return jsonResponse({ success: true, project: updated });
  } catch (err) {
    return jsonResponse({ error: 'Gagal memperbarui proyek foto: ' + err.message }, 500);
  }
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const id = params.id;

  try {
    await deleteProject(env, id);
    return jsonResponse({ success: true, message: 'Proyek foto berhasil dihapus.' });
  } catch (err) {
    return jsonResponse({ error: 'Gagal menghapus proyek: ' + err.message }, 500);
  }
}
