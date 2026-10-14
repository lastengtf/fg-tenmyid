// GET & POST /api/portal/:id/drive-photos
// Directly extracts photo list from public Google Drive folder (Zero Configuration Required!)
import { jsonResponse, getProject, saveProject, getSettings } from '../../_utils.js';

function extractFolderId(url) {
  if (!url) return null;
  const str = String(url).trim();
  const idParam = str.match(/[?&]id=([-\w]{25,})/);
  if (idParam) return idParam[1];
  const folderMatch = str.match(/\/folders\/([-\w]{25,})/);
  if (folderMatch) return folderMatch[1];
  const generalMatch = str.match(/[-\w]{25,}/);
  return generalMatch ? generalMatch[0] : null;
}

async function fetchDrivePhotosDirect(folderId) {
  const url = `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#list`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });

  if (!res.ok) {
    throw new Error(`Google Drive merespon status ${res.status}. Pastikan folder disetel "Siapa saja yang memiliki link dapat melihat".`);
  }

  const html = await res.text();
  const photos = [];
  const fileRegex = /<a [^>]*href="https:\/\/drive\.google\.com\/file\/d\/([-\w]{25,})\/view[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  let match;

  while ((match = fileRegex.exec(html)) !== null) {
    const fileId = match[1];
    const innerHtml = match[2];
    let name = '';
    const titleMatch = innerHtml.match(/<div class="flip-entry-title">([\s\S]*?)<\/div>/i);
    if (titleMatch) {
      name = titleMatch[1].replace(/<[^>]+>/g, '').trim();
    } else {
      name = innerHtml.replace(/<[^>]+>/g, '').trim();
    }

    photos.push({
      id: fileId,
      name: name || `Foto_${fileId.substring(0, 8)}`,
      thumbnailUrl: `https://lh3.googleusercontent.com/d/${fileId}=w600-h600`,
      previewUrl: `https://lh3.googleusercontent.com/d/${fileId}=s1600`
    });
  }

  // Fallback: If markup changed but file IDs are present
  if (photos.length === 0) {
    const idMatches = [...html.matchAll(/https:\/\/drive\.google\.com\/file\/d\/([-\w]{25,})\/view/g)];
    const uniqueIds = [...new Set(idMatches.map(m => m[1]))];
    uniqueIds.forEach((fileId, idx) => {
      photos.push({
        id: fileId,
        name: `Foto_${String(idx + 1).padStart(3, '0')}`,
        thumbnailUrl: `https://lh3.googleusercontent.com/d/${fileId}=w600-h600`,
        previewUrl: `https://lh3.googleusercontent.com/d/${fileId}=s1600`
      });
    });
  }

  // Deduplicate by file ID
  const seenIds = new Set();
  const uniquePhotos = [];
  for (const p of photos) {
    if (!seenIds.has(p.id)) {
      seenIds.add(p.id);
      uniquePhotos.push(p);
    }
  }

  // Sort by filename naturally
  uniquePhotos.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  return uniquePhotos;
}

export async function onRequestGet(context) {
  const { env, params } = context;
  const id = params.id;

  let project = await getProject(env, id);
  if (!project) {
    const { getAllProjects } = await import('../../_utils.js');
    const all = await getAllProjects(env);
    project = all.find(p => p.portalKey === id || p.id === id);
  }

  if (!project) {
    return jsonResponse({ error: 'Proyek foto tidak ditemukan.' }, 404);
  }

  // 1. If project already has cached drivePhotos, return them immediately
  if (Array.isArray(project.drivePhotos) && project.drivePhotos.length > 0) {
    return jsonResponse({
      photos: project.drivePhotos,
      source: 'cached',
      folderId: extractFolderId(project.driveUrl || project.selectionUrl)
    });
  }

  // 2. Extract folderId
  const folderUrl = project.selectionUrl || project.driveUrl;
  const folderId = extractFolderId(folderUrl);

  if (!folderId) {
    return jsonResponse({
      photos: [],
      message: 'Belum ada tautan folder Google Drive yang valid.'
    });
  }

  // 3. PRIORITY #1: Direct fetch from Google Drive folder (No API Key or Apps Script needed!)
  try {
    const directPhotos = await fetchDrivePhotosDirect(folderId);
    if (directPhotos.length > 0) {
      project.drivePhotos = directPhotos;
      await saveProject(env, project);
      return jsonResponse({
        photos: directPhotos,
        source: 'direct_drive',
        count: directPhotos.length
      });
    }
  } catch (err) {
    console.warn('Direct drive fetch failed:', err.message);
  }

  // 4. Secondary fallback: Apps Script or API Key if configured
  const settings = await getSettings(env);
  const appsScriptUrl = env.GOOGLE_APPS_SCRIPT_URL || settings.googleAppsScriptUrl;
  if (appsScriptUrl) {
    try {
      const targetUrl = `${appsScriptUrl}${appsScriptUrl.includes('?') ? '&' : '?'}folderId=${encodeURIComponent(folderId)}`;
      const asRes = await fetch(targetUrl, { method: 'GET', redirect: 'follow' });
      const asData = await asRes.json();
      const rawList = asData.files || asData.photos || [];
      if (Array.isArray(rawList) && rawList.length > 0) {
        const photos = rawList.map(f => ({
          id: f.id,
          name: f.name || f.title || f.filename,
          thumbnailUrl: f.thumbnailUrl || `https://lh3.googleusercontent.com/d/${f.id}=w600-h600`,
          previewUrl: f.previewUrl || `https://lh3.googleusercontent.com/d/${f.id}=s1600`
        }));
        project.drivePhotos = photos;
        await saveProject(env, project);
        return jsonResponse({ photos, source: 'apps_script', count: photos.length });
      }
    } catch (e) {
      console.warn('Apps Script fallback error:', e.message);
    }
  }

  return jsonResponse({
    photos: project.drivePhotos || [],
    folderId,
    message: 'Tidak ada foto ditemukan di folder Google Drive ini. Pastikan izin berbagi folder sudah disetel ke "Siapa saja yang memiliki link dapat melihat".'
  });
}

// POST: Photographer syncs photo list directly from Google Drive
export async function onRequestPost(context) {
  const { request, env, params } = context;
  const id = params.id;

  let project = await getProject(env, id);
  if (!project) {
    const { getAllProjects } = await import('../../_utils.js');
    const all = await getAllProjects(env);
    project = all.find(p => p.portalKey === id || p.id === id);
  }

  if (!project) {
    return jsonResponse({ error: 'Proyek foto tidak ditemukan.' }, 404);
  }

  const data = await request.json();
  const folderUrl = data.driveUrl || project.selectionUrl || project.driveUrl;
  const folderId = extractFolderId(folderUrl);

  if (!folderId) {
    return jsonResponse({ error: 'Link Google Drive tidak valid atau tidak memiliki folder ID.' }, 400);
  }

  // 1. PRIORITY #1: Direct fetch from Google Drive (Zero configuration!)
  try {
    const photos = await fetchDrivePhotosDirect(folderId);
    if (photos.length > 0) {
      project.drivePhotos = photos;
      await saveProject(env, project);

      return jsonResponse({
        success: true,
        message: `Berhasil mensinkronkan ${photos.length} foto langsung dari Google Drive!`,
        count: photos.length,
        photos,
        source: 'direct_drive'
      });
    }
  } catch (err) {
    console.warn('Direct drive fetch failed in POST:', err.message);
  }

  // 2. Secondary fallback: Apps Script Web App
  const settings = await getSettings(env);
  const appsScriptUrl = data.appsScriptUrl || env.GOOGLE_APPS_SCRIPT_URL || settings.googleAppsScriptUrl;
  if (appsScriptUrl) {
    try {
      const targetUrl = `${appsScriptUrl}${appsScriptUrl.includes('?') ? '&' : '?'}folderId=${encodeURIComponent(folderId)}`;
      const asRes = await fetch(targetUrl, { method: 'GET', redirect: 'follow' });
      const asData = await asRes.json();
      const rawList = asData.files || asData.photos || [];
      if (Array.isArray(rawList) && rawList.length > 0) {
        const photos = rawList.map(f => ({
          id: f.id,
          name: f.name || f.title || f.filename,
          thumbnailUrl: f.thumbnailUrl || `https://lh3.googleusercontent.com/d/${f.id}=w600-h600`,
          previewUrl: f.previewUrl || `https://lh3.googleusercontent.com/d/${f.id}=s1600`
        }));
        project.drivePhotos = photos;
        await saveProject(env, project);
        return jsonResponse({
          success: true,
          message: `Berhasil mensinkronkan ${photos.length} foto dari Google Drive via Apps Script!`,
          count: photos.length,
          photos,
          source: 'apps_script'
        });
      }
    } catch (e) {
      console.warn('Apps Script error:', e.message);
    }
  }

  // 3. Manual photos list passed directly
  if (Array.isArray(data.photos) && data.photos.length > 0) {
    project.drivePhotos = data.photos;
    await saveProject(env, project);
    return jsonResponse({
      success: true,
      message: `Tersimpan ${data.photos.length} foto ke proyek.`,
      count: data.photos.length,
      photos: project.drivePhotos
    });
  }

  return jsonResponse({
    error: 'Tidak dapat membaca foto dari folder Google Drive ini. Pastikan folder disetel "Siapa saja yang memiliki link dapat melihat" (Anyone with the link can view).'
  }, 400);
}
