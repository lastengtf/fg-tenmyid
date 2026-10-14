// Utility helpers for Cloudflare Pages Functions and KV Storage

const IN_MEMORY_STORE = {
  clients: {},
  clients_index: [],
  projects: {},
  projects_index: [],
  packages: {},
  packages_index: [],
  settings: null,
  sessions: {}
};

export function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...headers
    }
  });
}

export function getKV(env) {
  return env && env.FG_KV ? env.FG_KV : null;
}

// Generate unique ID
export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// --- Session & Auth Helpers ---
export function parseCookies(request) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = {};
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      cookies[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
  return cookies;
}

export function getAuthToken(request) {
  const authHeader = request.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const cookies = parseCookies(request);
  return cookies['fg_session'] || null;
}

export async function createSession(env, email) {
  const token = 'tok_' + Math.random().toString(36).substring(2) + Date.now().toString(36) + Math.random().toString(36).substring(2);
  const sessionData = {
    token,
    email,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
  };

  const kv = getKV(env);
  if (kv) {
    try {
      await kv.put(`session:${token}`, JSON.stringify(sessionData), {
        expirationTtl: 30 * 24 * 60 * 60
      });
      return token;
    } catch (e) {
      console.warn('KV createSession error, falling back to memory store:', e.message);
    }
  }
  IN_MEMORY_STORE.sessions[token] = sessionData;
  return token;
}

export async function verifySession(request, env) {
  const token = getAuthToken(request);
  if (!token) return null;

  const kv = getKV(env);
  let sessionData = null;
  if (kv) {
    try {
      const raw = await kv.get(`session:${token}`);
      if (raw) {
        sessionData = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('KV verifySession error, checking memory store:', e.message);
      sessionData = IN_MEMORY_STORE.sessions[token] || null;
    }
  } else {
    sessionData = IN_MEMORY_STORE.sessions[token] || null;
  }

  if (sessionData) {
    if (new Date(sessionData.expiresAt) > new Date()) {
      return sessionData;
    }
  }
  return null;
}

export async function deleteSession(env, token) {
  if (!token) return;
  const kv = getKV(env);
  if (kv) {
    try {
      await kv.delete(`session:${token}`);
    } catch (e) {
      console.warn('KV deleteSession error:', e.message);
    }
  }
  delete IN_MEMORY_STORE.sessions[token];
}

// --- KV Data Access Helpers ---

// Generic KV Getter
async function kvGet(env, key, fallback = null) {
  const kv = getKV(env);
  if (kv) {
    try {
      const val = await kv.get(key, 'json');
      if (val !== null && val !== undefined) return val;
    } catch (e) {
      console.warn('KV get error, using memory fallback:', e.message);
    }
  }
  const memVal = IN_MEMORY_STORE[key];
  return (memVal !== undefined && memVal !== null) ? memVal : fallback;
}

// Generic KV Setter
async function kvPut(env, key, val) {
  const kv = getKV(env);
  if (kv) {
    try {
      await kv.put(key, JSON.stringify(val));
      IN_MEMORY_STORE[key] = val; // also mirror to memory
      return;
    } catch (e) {
      console.warn('KV put error, saved to memory fallback:', e.message);
    }
  }
  IN_MEMORY_STORE[key] = val;
}

// Generic KV Delete
async function kvDelete(env, key) {
  const kv = getKV(env);
  if (kv) {
    try {
      await kv.delete(key);
    } catch (e) {
      console.warn('KV delete error:', e.message);
    }
  }
  delete IN_MEMORY_STORE[key];
}

// Clients
export async function getAllClients(env) {
  const index = await kvGet(env, 'clients_index', []);
  const clients = [];
  for (const id of index) {
    const c = await kvGet(env, `client:${id}`);
    if (c) clients.push(c);
  }
  return clients.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export async function getClient(env, id) {
  return await kvGet(env, `client:${id}`);
}

export async function saveClient(env, client) {
  if (!client.id) {
    client.id = generateId('client');
    client.createdAt = new Date().toISOString();
  }
  client.updatedAt = new Date().toISOString();

  await kvPut(env, `client:${client.id}`, client);

  const index = await kvGet(env, 'clients_index', []);
  if (!index.includes(client.id)) {
    index.unshift(client.id);
    await kvPut(env, 'clients_index', index);
  }
  return client;
}

export async function deleteClient(env, id) {
  await kvDelete(env, `client:${id}`);
  const index = await kvGet(env, 'clients_index', []);
  const newIndex = index.filter(i => i !== id);
  await kvPut(env, 'clients_index', newIndex);
}

// Projects (Photoshoot Workflow)
export async function getAllProjects(env) {
  const index = await kvGet(env, 'projects_index', []);
  const projects = [];
  for (const id of index) {
    const p = await kvGet(env, `project:${id}`);
    if (p) projects.push(p);
  }
  return projects.sort((a, b) => {
    // Sort by shoot date or created date
    const dateA = a.date || a.createdAt || '';
    const dateB = b.date || b.createdAt || '';
    return dateB.localeCompare(dateA);
  });
}

export async function getProject(env, id) {
  return await kvGet(env, `project:${id}`);
}

export async function saveProject(env, project) {
  if (!project.id) {
    project.id = generateId('proj');
    project.portalKey = Math.random().toString(36).substring(2, 10);
    project.createdAt = new Date().toISOString();
  }
  project.updatedAt = new Date().toISOString();

  await kvPut(env, `project:${project.id}`, project);

  const index = await kvGet(env, 'projects_index', []);
  if (!index.includes(project.id)) {
    index.unshift(project.id);
    await kvPut(env, 'projects_index', index);
  }
  return project;
}

export async function deleteProject(env, id) {
  await kvDelete(env, `project:${id}`);
  const index = await kvGet(env, 'projects_index', []);
  const newIndex = index.filter(i => i !== id);
  await kvPut(env, 'projects_index', newIndex);
}

// Packages (Price lists & Services)
export async function getPackage(env, id) {
  return await kvGet(env, `package:${id}`);
}

export async function getAllPackages(env) {
  let index = await kvGet(env, 'packages_index', null);
  
  // Seed default packages if empty
  if (!index || index.length === 0) {
    const defaults = [
      {
        id: 'pkg_wedding',
        name: 'Wedding Standard',
        category: 'Wedding',
        price: 5500000,
        description: 'Liputan akad & resepsi up to 8 jam, 2 fotografer, 50 edit high-res, all raw/original jpeg, flashdisk 32GB, 1 album magnetik 20x30.'
      },
      {
        id: 'pkg_prewed',
        name: 'Prewedding Outdoor',
        category: 'Prewedding',
        price: 2500000,
        description: 'Sesi outdoor 4 jam, 2 lokasi, 25 foto diedit, all softcopy, 1 cetak frame 40x60.'
      },
      {
        id: 'pkg_grad',
        name: 'Graduation / Wisuda Studio',
        category: 'Wisuda',
        price: 750000,
        description: 'Sesi studio 60 menit, max 5 orang, 10 foto edit, all softcopy, 1 cetak 10R.'
      },
      {
        id: 'pkg_portrait',
        name: 'Personal / Model Portrait',
        category: 'Portrait',
        price: 1200000,
        description: 'Sesi studio/outdoor 90 menit, 15 edited photos, moodboard styling consultation.'
      }
    ];

    index = [];
    for (const pkg of defaults) {
      await kvPut(env, `package:${pkg.id}`, pkg);
      index.push(pkg.id);
    }
    await kvPut(env, 'packages_index', index);
  }

  const packages = [];
  for (const id of index) {
    const pkg = await kvGet(env, `package:${id}`);
    if (pkg) packages.push(pkg);
  }
  return packages;
}

export async function savePackage(env, pkg) {
  if (!pkg.id) {
    pkg.id = generateId('pkg');
  }
  await kvPut(env, `package:${pkg.id}`, pkg);
  const index = await kvGet(env, 'packages_index', []);
  if (!index.includes(pkg.id)) {
    index.push(pkg.id);
    await kvPut(env, 'packages_index', index);
  }
  return pkg;
}

export async function deletePackage(env, id) {
  await kvDelete(env, `package:${id}`);
  const index = await kvGet(env, 'packages_index', []);
  const newIndex = index.filter(i => i !== id);
  await kvPut(env, 'packages_index', newIndex);
}

// Settings
export async function getSettings(env) {
  const defaults = {
    studioName: 'TEN Photography',
    domain: 'fg.ten.my.id',
    phone: '081234567890',
    email: 'kontak@fg.ten.my.id',
    instagram: '@tenphotography',
    bankName: 'BCA',
    bankAccount: '1234567890',
    bankHolder: 'TEN Fotografer',
    address: 'Indonesia'
  };
  const settings = await kvGet(env, 'settings', defaults);
  return settings;
}

export async function saveSettings(env, settings) {
  await kvPut(env, 'settings', settings);
  return settings;
}

// Auth Config with KV Persistence
export async function getAuthConfig(env) {
  let email = env.AUTH_EMAIL;
  let password = env.AUTH_PASSWORD;

  const saved = await kvGet(env, 'auth_config', null);
  if (saved) {
    if (!email && saved.email) email = saved.email;
    if (!password && saved.password) password = saved.password;
  }

  return {
    email: email || 'admin@fg.ten.my.id',
    password: password || 'admin123'
  };
}

export async function saveAuthConfig(env, email, password) {
  const config = { email, password, updatedAt: new Date().toISOString() };
  await kvPut(env, 'auth_config', config);
  return config;
}
