import {
  jsonResponse,
  verifySession,
  createSession,
  deleteSession,
  getAllClients,
  getClient,
  saveClient,
  deleteClient,
  getAllProjects,
  getProject,
  saveProject,
  deleteProject,
  getAllPackages,
  getPackage,
  savePackage,
  deletePackage,
  getSettings,
  saveSettings,
  getAuthConfig,
  saveAuthConfig
} from '../functions/api/_utils.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    // 1. CORS Preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    // 2. API Routes
    if (pathname.startsWith('/api/')) {
      try {
        return await handleApi(pathname, method, request, env);
      } catch (err) {
        return jsonResponse({ error: 'Server Error: ' + err.message }, 500);
      }
    }

    // 3. Static Assets serving via ASSETS binding (Cloudflare Workers Static Assets)
    if (env.ASSETS) {
      if (pathname === '/admin' || pathname === '/admin/') {
        const adminReq = new Request(new URL('/admin/index.html', request.url), request);
        const res = await env.ASSETS.fetch(adminReq);
        if (res.status !== 404) return res;
      }
      if (pathname === '/portal' || pathname === '/portal/' || pathname.startsWith('/portal')) {
        const portalReq = new Request(new URL('/portal/index.html', request.url), request);
        const res = await env.ASSETS.fetch(portalReq);
        if (res.status !== 404) return res;
      }
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return assetResponse;
      }
      // If pathname starts with /admin, fallback to /admin/index.html
      if (pathname.startsWith('/admin')) {
        const adminIndexReq = new Request(new URL('/admin/index.html', request.url), request);
        return await env.ASSETS.fetch(adminIndexReq);
      }
      // If pathname starts with /portal, fallback to /portal/index.html
      if (pathname.startsWith('/portal')) {
        const portalIndexReq = new Request(new URL('/portal/index.html', request.url), request);
        return await env.ASSETS.fetch(portalIndexReq);
      }
      // SPA Fallback for client-side routing
      const indexReq = new Request(new URL('/', request.url), request);
      return await env.ASSETS.fetch(indexReq);
    }

    return new Response('Not found', { status: 404 });
  }
};

async function handleApi(pathname, method, request, env) {
  // Public Endpoint: Login
  if (pathname === '/api/auth/login' && method === 'POST') {
    const { email, password } = await request.json();
    if (!email || !password) {
      return jsonResponse({ error: 'Email dan password wajib diisi.' }, 400);
    }
    const authConfig = await getAuthConfig(env);
    const configuredEmail = authConfig.email;
    const configuredPassword = authConfig.password;
    if (email.trim().toLowerCase() !== configuredEmail.trim().toLowerCase() || password !== configuredPassword) {
      return jsonResponse({
        error: 'Email atau password salah. Pastikan sesuai dengan variabel AUTH_EMAIL & AUTH_PASSWORD di Cloudflare.'
      }, 401);
    }
    // Simpan ke KV sebagai backup permanen
    await saveAuthConfig(env, configuredEmail, configuredPassword);

    const token = await createSession(env, configuredEmail);
    const isHttps = request.url.startsWith('https');
    const cookieHeader = `fg_session=${token}; Path=/; Max-Age=2592000; SameSite=Lax${isHttps ? '; Secure' : ''}`;
    return jsonResponse({ success: true, token, email: configuredEmail, message: 'Login berhasil.' }, 200, {
      'Set-Cookie': cookieHeader
    });
  }

  // Public Endpoint: Client Portal
  if (pathname.startsWith('/api/portal/') && method === 'GET') {
    const id = pathname.replace('/api/portal/', '');
    let project = await getProject(env, id);
    if (!project) {
      const all = await getAllProjects(env);
      project = all.find(p => p.portalKey === id || p.id === id);
    }
    if (!project) {
      return jsonResponse({ error: 'Data sesi foto tidak ditemukan atau tautan salah.' }, 404);
    }
    const settings = await getSettings(env);
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
        photoNotes: project.photoNotes || {},
        drivePhotos: project.drivePhotos || [],
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

  // Public Endpoint: Fetch or Sync Google Drive Photos for a project
  if (pathname.startsWith('/api/portal/') && pathname.endsWith('/drive-photos')) {
    const id = pathname.replace('/api/portal/', '').replace('/drive-photos', '');
    let project = await getProject(env, id);
    if (!project) {
      const all = await getAllProjects(env);
      project = all.find(p => p.portalKey === id || p.id === id);
    }
    if (!project) {
      return jsonResponse({ error: 'Proyek foto tidak ditemukan.' }, 404);
    }

    const extractFolderId = (url) => {
      if (!url) return null;
      const match = url.match(/[-\w]{25,}/);
      return match ? match[0] : null;
    };

    if (method === 'GET') {
      if (Array.isArray(project.drivePhotos) && project.drivePhotos.length > 0) {
        return jsonResponse({
          photos: project.drivePhotos,
          source: 'cached',
          folderId: extractFolderId(project.selectionUrl || project.driveUrl)
        });
      }

      const folderUrl = project.selectionUrl || project.driveUrl;
      const folderId = extractFolderId(folderUrl);
      if (!folderId) {
        return jsonResponse({ photos: [], message: 'Belum ada tautan folder Google Drive yang valid.' });
      }

      const settings = await getSettings(env);
      const apiKey = env.GOOGLE_DRIVE_API_KEY || settings.googleDriveApiKey;
      if (apiKey) {
        try {
          const gUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false+and+mimeType+contains+'image/'&key=${apiKey}&fields=files(id,name,mimeType,thumbnailLink)&pageSize=250&orderBy=name`;
          const gRes = await fetch(gUrl);
          const gData = await gRes.json();
          if (gRes.ok && Array.isArray(gData.files)) {
            const photos = gData.files.map(f => ({
              id: f.id,
              name: f.name,
              thumbnailUrl: `https://lh3.googleusercontent.com/d/${f.id}=w600-h600`,
              previewUrl: `https://lh3.googleusercontent.com/d/${f.id}=s1600`
            }));
            project.drivePhotos = photos;
            await saveProject(env, project);
            return jsonResponse({ photos, source: 'google_api', count: photos.length });
          }
        } catch (e) {
          console.warn('Google Drive API error:', e.message);
        }
      }

      return jsonResponse({
        photos: project.drivePhotos || [],
        folderId,
        needApiKey: !apiKey,
        message: apiKey
          ? 'Tidak dapat memuat berkas gambar dari Google Drive. Pastikan folder dapat diakses siapa saja.'
          : 'Google Drive API Key belum disetel atau folder belum disinkronkan.'
      });
    }

    if (method === 'POST') {
      const data = await request.json();
      const folderUrl = data.driveUrl || project.selectionUrl || project.driveUrl;
      const folderId = extractFolderId(folderUrl);
      const settings = await getSettings(env);
      const apiKey = data.apiKey || env.GOOGLE_DRIVE_API_KEY || settings.googleDriveApiKey;

      if (folderId && apiKey) {
        try {
          const gUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false+and+mimeType+contains+'image/'&key=${apiKey}&fields=files(id,name,mimeType,thumbnailLink)&pageSize=300&orderBy=name`;
          const gRes = await fetch(gUrl);
          const gData = await gRes.json();
          if (!gRes.ok) {
            return jsonResponse({ error: gData.error ? gData.error.message : 'Google Drive API gagal.' }, 400);
          }
          const photos = (gData.files || []).map(f => ({
            id: f.id,
            name: f.name,
            thumbnailUrl: `https://lh3.googleusercontent.com/d/${f.id}=w600-h600`,
            previewUrl: `https://lh3.googleusercontent.com/d/${f.id}=s1600`
          }));
          project.drivePhotos = photos;
          await saveProject(env, project);
          return jsonResponse({
            success: true,
            message: `Berhasil mensinkronkan ${photos.length} foto dari Google Drive!`,
            count: photos.length,
            photos
          });
        } catch (err) {
          return jsonResponse({ error: 'Gagal sinkronisasi Google Drive: ' + err.message }, 500);
        }
      }

      if (Array.isArray(data.photos)) {
        project.drivePhotos = data.photos;
        await saveProject(env, project);
        return jsonResponse({
          success: true,
          message: `Tersimpan ${data.photos.length} foto ke proyek.`,
          count: data.photos.length,
          photos: project.drivePhotos
        });
      }

      return jsonResponse({ error: 'Masukkan URL Google Drive folder yang valid atau sertakan Google Drive API Key.' }, 400);
    }
  }

  // Public Endpoint: Submit photo selection & notes
  if (pathname.startsWith('/api/portal/') && method === 'POST') {
    const id = pathname.replace('/api/portal/', '');
    let project = await getProject(env, id);
    if (!project) {
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
    photoList = [...new Set(photoList)];

    const quota = Number(project.selectionQuota) || 20;
    if (photoList.length > quota) {
      return jsonResponse({
        error: `Jumlah foto yang Anda pilih (${photoList.length} foto) melebihi batas kuota paket (${quota} foto). Silakan hapus beberapa foto.`
      }, 400);
    }

    project.selectedPhotos = photoList.join(', ');
    project.photoNotes = (data.photoNotes && typeof data.photoNotes === 'object') ? data.photoNotes : (project.photoNotes || {});
    project.selectedAt = new Date().toISOString();
    if (project.workflowStatus === 'shooting_done') {
      project.workflowStatus = 'selection';
    }
    await saveProject(env, project);
    return jsonResponse({
      success: true,
      message: 'Daftar nomor foto pilihan Anda dan catatan berhasil disimpan!',
      selectedPhotos: project.selectedPhotos,
      photoNotes: project.photoNotes,
      selectedCount: photoList.length,
      selectionQuota: quota
    });
  }

  // Public Endpoint: Packages List
  if (pathname === '/api/public/packages' && method === 'GET') {
    const packages = await getAllPackages(env);
    return jsonResponse({
      packages: packages.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price,
        description: p.description
      }))
    });
  }

  // Public Endpoint: Studio Info
  if (pathname === '/api/public/studio' && method === 'GET') {
    const settings = await getSettings(env);
    return jsonResponse({
      studio: {
        studioName: settings.studioName || 'TEN Photography',
        tagline: settings.tagline || 'Visual Storyteller & Professional Photography Services',
        phone: settings.phone || '',
        email: settings.email || '',
        instagram: settings.instagram || '@tenphotography',
        bankName: settings.bankName || '',
        bankAccount: settings.bankAccount || '',
        bankHolder: settings.bankHolder || ''
      }
    });
  }

  // Public Endpoint: Inquiry Booking Submission
  if (pathname === '/api/public/book' && method === 'POST') {
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
  }

  // Public Endpoint: Track project
  if (pathname === '/api/public/track' && method === 'GET') {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim();
    if (!q) {
      return jsonResponse({ error: 'Masukkan ID Sesi Foto atau nomor WhatsApp Anda.' }, 400);
    }
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
        message: 'Tidak ditemukan sesi foto yang cocok dengan pencarian Anda.'
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

  // Auth protection for all other API endpoints
  const session = await verifySession(request, env);
  if (!session) {
    return jsonResponse({ error: 'Unauthorized. Silakan login terlebih dahulu.' }, 401);
  }

  // Auth me
  if (pathname === '/api/auth/me' && method === 'GET') {
    return jsonResponse({ authenticated: true, email: session.email, createdAt: session.createdAt });
  }

  // Auth logout
  if (pathname === '/api/auth/logout' && method === 'POST') {
    const token = session.token;
    if (token) await deleteSession(env, token);
    return jsonResponse({ success: true, message: 'Logout berhasil.' }, 200, {
      'Set-Cookie': 'fg_session=; Path=/; Max-Age=0; SameSite=Lax'
    });
  }

  // Stats
  if (pathname === '/api/stats' && method === 'GET') {
    const projects = await getAllProjects(env);
    const clients = await getAllClients(env);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let activeProjectsCount = 0;
    let upcomingShootsCount = 0;
    let inEditingCount = 0;
    let galleryReadyCount = 0;
    let totalRevenue = 0;
    let totalExpenses = 0;
    let totalUnpaidAmount = 0;
    let unpaidProjectsCount = 0;
    const upcomingList = [];

    for (const p of projects) {
      if (p.workflowStatus !== 'completed') activeProjectsCount++;
      if (p.workflowStatus === 'editing') inEditingCount++;
      if (p.workflowStatus === 'gallery_ready') galleryReadyCount++;
      if (p.date && p.date >= todayStr && p.date <= next7Days && p.workflowStatus !== 'completed') {
        upcomingShootsCount++;
        upcomingList.push(p);
      }
      const total = Number(p.totalPrice) || 0;
      const dp = Number(p.dpAmount) || 0;
      totalRevenue += dp;
      if (p.paymentStatus !== 'paid' && total > dp) {
        totalUnpaidAmount += (total - dp);
        unpaidProjectsCount++;
      } else if (p.paymentStatus === 'paid') {
        totalRevenue += (total - dp);
      }

      if (Array.isArray(p.expenses)) {
        for (const exp of p.expenses) {
          totalExpenses += Number(exp.amount) || 0;
        }
      }
    }
    upcomingList.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const netProfit = totalRevenue - totalExpenses;

    return jsonResponse({
      stats: {
        totalClients: clients.length,
        totalProjects: projects.length,
        activeProjects: activeProjectsCount,
        upcomingShoots: upcomingShootsCount,
        inEditing: inEditingCount,
        galleryReady: galleryReadyCount,
        totalUnpaidAmount,
        unpaidProjectsCount,
        totalRevenue,
        totalExpenses,
        netProfit
      },
      upcomingList: upcomingList.slice(0, 5),
      recentProjects: projects.slice(0, 5)
    });
  }

  // Clients
  if (pathname === '/api/clients') {
    if (method === 'GET') {
      const clients = await getAllClients(env);
      return jsonResponse({ clients });
    }
    if (method === 'POST') {
      const data = await request.json();
      if (!data.name || !data.name.trim()) return jsonResponse({ error: 'Nama klien wajib diisi.' }, 400);
      const newClient = await saveClient(env, {
        name: data.name.trim(),
        phone: (data.phone || '').trim(),
        email: (data.email || '').trim(),
        instagram: (data.instagram || '').trim(),
        notes: (data.notes || '').trim()
      });
      return jsonResponse({ success: true, client: newClient }, 201);
    }
  }

  if (pathname.startsWith('/api/clients/')) {
    const id = pathname.replace('/api/clients/', '');
    if (method === 'GET') {
      const client = await getClient(env, id);
      if (!client) return jsonResponse({ error: 'Klien tidak ditemukan.' }, 404);
      const allProjects = await getAllProjects(env);
      const clientProjects = allProjects.filter(p => p.clientId === id);
      return jsonResponse({ client, projects: clientProjects });
    }
    if (method === 'PUT') {
      const existing = await getClient(env, id);
      if (!existing) return jsonResponse({ error: 'Klien tidak ditemukan.' }, 404);
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
    }
    if (method === 'DELETE') {
      await deleteClient(env, id);
      return jsonResponse({ success: true, message: 'Klien berhasil dihapus.' });
    }
  }

  // Projects
  if (pathname === '/api/projects') {
    if (method === 'GET') {
      const url = new URL(request.url);
      const statusFilter = url.searchParams.get('status');
      const searchFilter = (url.searchParams.get('q') || '').toLowerCase().trim();
      let projects = await getAllProjects(env);

      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'active') projects = projects.filter(p => p.workflowStatus !== 'completed');
        else if (statusFilter === 'unpaid') projects = projects.filter(p => p.paymentStatus !== 'paid');
        else projects = projects.filter(p => p.workflowStatus === statusFilter);
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
    if (method === 'POST') {
      const data = await request.json();
      if (!data.title || !data.title.trim()) return jsonResponse({ error: 'Judul / nama sesi foto wajib diisi.' }, 400);

      let clientId = data.clientId;
      let clientName = (data.clientName || '').trim();
      let clientPhone = (data.clientPhone || '').trim();
      let clientEmail = (data.clientEmail || '').trim();

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
      if (dpAmount >= totalPrice && totalPrice > 0) paymentStatus = 'paid';
      else if (dpAmount > 0) paymentStatus = 'dp_paid';

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
        photoNotes: data.photoNotes || {},
        drivePhotos: Array.isArray(data.drivePhotos) ? data.drivePhotos : [],
        notes: (data.notes || '').trim()
      });

      return jsonResponse({ success: true, project: newProject }, 201);
    }
  }

  if (pathname.startsWith('/api/projects/')) {
    const id = pathname.replace('/api/projects/', '');
    if (method === 'GET') {
      const project = await getProject(env, id);
      if (!project) return jsonResponse({ error: 'Proyek foto tidak ditemukan.' }, 404);
      let client = null;
      if (project.clientId) client = await getClient(env, project.clientId);
      return jsonResponse({ project, client });
    }
    if (method === 'PUT') {
      const existing = await getProject(env, id);
      if (!existing) return jsonResponse({ error: 'Proyek foto tidak ditemukan.' }, 404);
      const data = await request.json();
      const packagePrice = data.packagePrice !== undefined ? Number(data.packagePrice) : (existing.packagePrice || 0);
      const addOnsPrice = data.addOnsPrice !== undefined ? Number(data.addOnsPrice) : (existing.addOnsPrice || 0);
      const totalPrice = data.totalPrice !== undefined ? Number(data.totalPrice) : (packagePrice + addOnsPrice);
      const dpAmount = data.dpAmount !== undefined ? Number(data.dpAmount) : (existing.dpAmount || 0);

      let paymentStatus = data.paymentStatus || existing.paymentStatus || 'unpaid';
      if (dpAmount >= totalPrice && totalPrice > 0) paymentStatus = 'paid';
      else if (dpAmount > 0 && paymentStatus === 'unpaid') paymentStatus = 'dp_paid';

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
    }
    if (method === 'DELETE') {
      await deleteProject(env, id);
      return jsonResponse({ success: true, message: 'Proyek foto berhasil dihapus.' });
    }
  }

  // Packages
  if (pathname === '/api/packages') {
    if (method === 'GET') {
      const packages = await getAllPackages(env);
      return jsonResponse({ packages });
    }
    if (method === 'POST') {
      const data = await request.json();
      if (!data.name || !data.name.trim()) return jsonResponse({ error: 'Nama paket wajib diisi.' }, 400);
      const pkg = await savePackage(env, {
        name: data.name.trim(),
        category: data.category || 'Wedding',
        price: Number(data.price) || 0,
        description: (data.description || '').trim()
      });
      return jsonResponse({ success: true, package: pkg }, 201);
    }
  }

  if (pathname.startsWith('/api/packages/')) {
    const id = pathname.replace('/api/packages/', '');
    if (method === 'GET') {
      const pkg = await getPackage(env, id);
      if (!pkg) return jsonResponse({ error: 'Paket tidak ditemukan.' }, 404);
      return jsonResponse({ package: pkg });
    }
    if (method === 'PUT') {
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
    }
    if (method === 'DELETE') {
      await deletePackage(env, id);
      return jsonResponse({ success: true, message: 'Paket berhasil dihapus.' });
    }
  }

  // Settings
  if (pathname === '/api/settings') {
    if (method === 'GET') {
      const settings = await getSettings(env);
      return jsonResponse({ settings });
    }
    if (method === 'PUT') {
      const existing = await getSettings(env);
      const data = await request.json();
      const updated = await saveSettings(env, {
        ...existing,
        studioName: data.studioName !== undefined ? data.studioName.trim() : existing.studioName,
        domain: data.domain !== undefined ? data.domain.trim() : existing.domain,
        phone: data.phone !== undefined ? data.phone.trim() : existing.phone,
        email: data.email !== undefined ? data.email.trim() : existing.email,
        instagram: data.instagram !== undefined ? data.instagram.trim() : existing.instagram,
        bankName: data.bankName !== undefined ? data.bankName.trim() : existing.bankName,
        bankAccount: data.bankAccount !== undefined ? data.bankAccount.trim() : existing.bankAccount,
        bankHolder: data.bankHolder !== undefined ? data.bankHolder.trim() : existing.bankHolder,
        googleDriveApiKey: data.googleDriveApiKey !== undefined ? data.googleDriveApiKey.trim() : existing.googleDriveApiKey,
        address: data.address !== undefined ? data.address.trim() : existing.address
      });
      return jsonResponse({ success: true, settings: updated });
    }
  }

  return jsonResponse({ error: 'Endpoint not found' }, 404);
}
