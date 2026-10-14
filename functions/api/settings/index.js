// GET & PUT /api/settings
import { jsonResponse, getSettings, saveSettings } from '../_utils.js';

export async function onRequestGet(context) {
  const { env } = context;
  const settings = await getSettings(env);
  return jsonResponse({ settings });
}

export async function onRequestPut(context) {
  const { request, env } = context;
  try {
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
      address: data.address !== undefined ? data.address.trim() : existing.address
    });
    return jsonResponse({ success: true, settings: updated });
  } catch (err) {
    return jsonResponse({ error: 'Gagal memperbarui pengaturan: ' + err.message }, 500);
  }
}
