// GET /api/public/studio - Public studio info
import { jsonResponse, getSettings } from '../_utils.js';

export async function onRequestGet(context) {
  const { env } = context;
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
