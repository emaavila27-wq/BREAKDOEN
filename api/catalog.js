import { publicCatalog } from '../lib/config.js';

// GET /api/catalog — marca, precios y planes para armar la página.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=60');
  return res.status(200).json(publicCatalog());
}
