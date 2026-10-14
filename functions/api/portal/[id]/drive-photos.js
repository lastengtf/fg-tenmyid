// GET & POST /api/portal/:id/drive-photos
// Fetches image list from Google Drive folder or retrieves cached drivePhotos
import { jsonResponse, getProject, saveProject, getSettings } from '../../_utils.js';

function extractFolderId(url) {
  if (!url) return null;
  const match = url.match(/[-\w]{25,}/);
  return match ? match[0] : null;
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

  // 1. If project already has cached drivePhotos, return them
  if (Array.isArray(project.drivePhotos) && project.drivePhotos.length > 0) {
    return jsonResponse({
      photos: project.drivePhotos,
      source: 'cached',
      folderId: extractFolderId(project.driveUrl || project.selectionUrl)
    });
  }

  // 2. Attempt to fetch photos from Google Drive if URL is provided
  const folderUrl = project.selectionUrl || project.driveUrl;
  const folderId = extractFolderId(folderUrl);

  if (!folderId) {
    return jsonResponse({
      photos: [],
      message: 'Belum ada tautan folder Google Drive yang valid.'
    });
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

        // Cache into project
        project.drivePhotos = photos;
        await saveProject(env, project);

        return jsonResponse({ photos, source: 'google_api', count: photos.length });
      }
    } catch (e) {
      console.warn('Google Drive API error:', e.message);
    }
  }

  // Fallback: return empty with instructions
  return jsonResponse({
    photos: project.drivePhotos || [],
    folderId,
    needApiKey: !apiKey,
    message: apiKey
      ? 'Tidak dapat memuat berkas gambar dari folder Google Drive ini. Pastikan folder disetel "Siapa saja yang memiliki link dapat melihat".'
      : 'Google Drive API Key belum disetel atau folder belum disinkronkan.'
  });
}

// POST: Photographer or system syncs photo list directly
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
      return jsonResponse({ error: 'Gagal mengambil foto dari Google Drive: ' + err.message }, 500);
    }
  }

  // If photos list passed directly (manual or external parsed)
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

  return jsonResponse({
    error: 'Masukkan URL Google Drive folder yang valid atau sertakan Google Drive API Key.'
  }, 400);
}
