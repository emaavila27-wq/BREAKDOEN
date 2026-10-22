import { products } from '../lib/config.js';
import { parseOrder } from '../lib/order.js';
import { createPreference } from '../lib/mercadopago.js';

// POST /api/checkout — valida el cuestionario y devuelve el link de pago.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  if (req.body?.website) return res.status(400).json({ error: 'Solicitud inválida' }); // honeypot

  const { order, errors } = parseOrder(req.body ?? {});
  if (errors) return res.status(400).json({ error: errors.join(' ') });

  try {
    const siteUrl = (process.env.SITE_URL || `https://${req.headers.host}`).replace(/\/$/, '');
    const pref = await createPreference(order, products[order.producto], siteUrl);
    return res.status(200).json({ url: pref.init_point });
  } catch (err) {
    console.error('checkout', err);
    return res.status(502).json({ error: 'No pudimos iniciar el pago. Probá de nuevo en un rato.' });
  }
}
