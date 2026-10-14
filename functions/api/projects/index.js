// GET & POST /api/projects
import { jsonResponse, getAllProjects, saveProject, getClient, saveClient } from '../_utils.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status');
  const searchFilter = (url.searchParams.get('q') || '').toLowerCase().trim();

  let projects = await getAllProjects(env);

  if (statusFilter && statusFilter !== 'all') {
    if (statusFilter === 'active') {
      // Active means not completed
      projects = projects.filter(p => p.workflowStatus !== 'completed');
    } else if (statusFilter === 'unpaid') {
      // Outstanding payments
      projects = projects.filter(p => p.paymentStatus !== 'paid');
    } else {
      projects = projects.filter(p => p.workflowStatus === statusFilter);
    }
  }

  if (searchFilter) {
    projects = projects.filter(p => 
      (p.title && p.title.toLowerCase().includes(searchFilter)) ||
      (p.clientName && p.clientName.toLowerCase().includes(searchFilter)) ||
      (p.clientPhone && p.clientPhone.includes(searchFilter)) ||
      (p.location && p.location.toLowerCase().includes(searchFilter)) ||
      (p.category && p.category.toLowerCase().includes(searchFilter))
    );
  }

  return jsonResponse({ projects });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const data = await request.json();
    if (!data.title || !data.title.trim()) {
      return jsonResponse({ error: 'Judul / nama sesi foto wajib diisi.' }, 400);
    }

    let clientId = data.clientId;
    let clientName = (data.clientName || '').trim();
    let clientPhone = (data.clientPhone || '').trim();
    let clientEmail = (data.clientEmail || '').trim();

    // Jika klien belum ada tapi nama klien diinput baru, otomatis simpan klien baru
    if (!clientId && clientName) {
      const newClient = await saveClient(env, {
        name: clientName,
        phone: clientPhone,
        email: clientEmail,
        notes: 'Dibuat otomatis dari proyek ' + data.title.trim()
      });
      clientId = newClient.id;
    } else if (clientId) {
      const existingClient = await getClient(env, clientId);
      if (existingClient) {
        clientName = existingClient.name;
        clientPhone = existingClient.phone;
        clientEmail = existingClient.email;
      }
    }

    const packagePrice = Number(data.packagePrice) || 0;
    const addOnsPrice = Number(data.addOnsPrice) || 0;
    const totalPrice = Number(data.totalPrice) || (packagePrice + addOnsPrice);
    const dpAmount = Number(data.dpAmount) || 0;

    let paymentStatus = data.paymentStatus || 'unpaid';
    if (dpAmount >= totalPrice && totalPrice > 0) {
      paymentStatus = 'paid';
    } else if (dpAmount > 0) {
      paymentStatus = 'dp_paid';
    }

    const newProject = await saveProject(env, {
      title: data.title.trim(),
      clientId: clientId || null,
      clientName: clientName || 'Klien',
      clientPhone: clientPhone || '',
      clientEmail: clientEmail || '',
      category: data.category || 'Lainnya',
      date: data.date || '',
      time: data.time || '',
      endTime: data.endTime || '',
      location: (data.location || '').trim(),
      mapsUrl: (data.mapsUrl || '').trim(),
      packageName: (data.packageName || '').trim(),
      packagePrice: packagePrice,
      addOns: (data.addOns || '').trim(),
      addOnsPrice: addOnsPrice,
      totalPrice: totalPrice,
      dpAmount: dpAmount,
      dpDate: data.dpDate || '',
      paymentStatus: paymentStatus,
      paymentNotes: (data.paymentNotes || '').trim(),
      workflowStatus: data.workflowStatus || 'inquiry',
      driveUrl: (data.driveUrl || '').trim(),
      selectionUrl: (data.selectionUrl || '').trim(),
      deliverables: Array.isArray(data.deliverables) ? data.deliverables : [
        { id: 1, text: 'Foto Selesai Diedit', done: false },
        { id: 2, text: 'File High-Res Dikirim via Cloud/Drive', done: false }
      ],
      expenses: Array.isArray(data.expenses) ? data.expenses : [],
      shotlist: Array.isArray(data.shotlist) ? data.shotlist : [],
      gearChecklist: Array.isArray(data.gearChecklist) ? data.gearChecklist : [],
      selectionQuota: Number(data.selectionQuota) || 20,
      selectedPhotos: (data.selectedPhotos || '').trim(),
      notes: (data.notes || '').trim()
    });

    return jsonResponse({ success: true, project: newProject }, 201);
  } catch (err) {
    return jsonResponse({ error: 'Gagal membuat sesi foto: ' + err.message }, 500);
  }
}
