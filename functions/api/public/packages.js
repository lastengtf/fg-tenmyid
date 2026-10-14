// GET /api/public/packages - Public list of photography packages
import { jsonResponse, getAllPackages } from '../_utils.js';

export async function onRequestGet(context) {
  const { env } = context;
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
