import { publicCatalog } from '../lib/config.js';

// GET /api/catalog — marca, precios y planes para armar la página.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
  return res.status(200).json(publicCatalog());
}
