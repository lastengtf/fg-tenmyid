// POST /api/public/book - Public inquiry & booking submission
import {
  jsonResponse,
  getAllClients,
  saveClient,
  saveProject,
  getAllPackages
} from '../_utils.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const data = await request.json();
    const clientName = (data.name || data.clientName || '').trim();
    const clientPhone = (data.phone || data.clientPhone || '').trim();
    const clientEmail = (data.email || data.clientEmail || '').trim();
    const category = (data.category || 'Wedding').trim();
    const packageId = data.packageId || '';
    const date = (data.date || '').trim();
    const time = (data.time || '').trim();
    const location = (data.location || '').trim();
    const notes = (data.notes || '').trim();

    if (!clientName || !clientPhone) {
      return jsonResponse({ error: 'Nama dan nomor WhatsApp wajib diisi.' }, 400);
    }

    // Match or create client
    const allClients = await getAllClients(env);
    const cleanPhone = clientPhone.replace(/\D/g, '');
    let client = allClients.find(c => (c.phone || '').replace(/\D/g, '') === cleanPhone);

    if (!client) {
      client = {
        id: `cli_${Date.now()}`,
        name: clientName,
        phone: clientPhone,
        email: clientEmail,
        instagram: (data.instagram || '').trim(),
        notes: `Klien dari formulir reservasi publik web`,
        createdAt: new Date().toISOString()
      };
      await saveClient(env, client);
    }

    // Match package details
    let packageName = data.packageName || '';
    let packagePrice = Number(data.packagePrice) || 0;
    if (packageId) {
      const allPkgs = await getAllPackages(env);
      const pkg = allPkgs.find(p => p.id === packageId);
      if (pkg) {
        packageName = pkg.name;
        packagePrice = pkg.price || 0;
      }
    }

    const projectId = `proj_${Date.now()}`;
    const portalKey = `pk_${Math.random().toString(36).substring(2, 10)}`;

    const newProject = {
      id: projectId,
      title: `${category} - ${clientName}`,
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      clientEmail: client.email || clientEmail,
      category,
      packageName,
      packagePrice,
      addOns: [],
      addOnsPrice: 0,
      totalPrice: packagePrice,
      dpAmount: 0,
      dpDate: '',
      paymentStatus: 'unpaid',
      paymentNotes: 'Menunggu konfirmasi reservasi & DP',
      workflowStatus: 'inquiry',
      date,
      time,
      endTime: '',
      location,
      mapsUrl: '',
      driveUrl: '',
      selectionUrl: '',
      selectedPhotos: '',
      deliverables: [
        { id: 1, text: 'Konfirmasi Jadwal & Pembayaran DP', done: false },
        { id: 2, text: 'Sesi Pemotretan di Lokasi', done: false },
        { id: 3, text: 'Kurasi & Seleksi Foto Pilihan', done: false },
        { id: 4, text: 'Retouching & Color Grading Selesai', done: false },
        { id: 5, text: 'Pengiriman Berkas Final via Cloud/Drive', done: false }
      ],
      expenses: [],
      shotlist: [],
      gearChecklist: [],
      notes: notes ? `[Catatan Reservasi Klien]\n${notes}` : '',
      portalKey,
      source: 'public_booking',
      createdAt: new Date().toISOString()
    };

    await saveProject(env, newProject);

    return jsonResponse({
      success: true,
      message: 'Permintaan reservasi Anda berhasil dikirim! Tim fotografer kami akan segera menghubungi Anda melalui WhatsApp.',
      project: {
        id: projectId,
        portalKey,
        title: newProject.title,
        category: newProject.category,
        date: newProject.date,
        portalUrl: `/portal?id=${projectId}`
      }
    });
  } catch (err) {
    return jsonResponse({ error: 'Gagal memproses reservasi: ' + err.message }, 500);
  }
}
