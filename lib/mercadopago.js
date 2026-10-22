import crypto from 'node:crypto';
import { brand, currency } from './config.js';

const API = 'https://api.mercadopago.com';

async function mp(path, init = {}) {
  const res = await fetch(API + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(`Mercado Pago ${res.status}: ${await res.text()}`);
  return res.json();
}

// Crea la preferencia de pago. Las respuestas del cuestionario viajan en
// "metadata" y vuelven en el pago, así no hace falta base de datos.
export function createPreference(order, product, siteUrl) {
  const orderId = crypto.randomUUID();
  return mp('/checkout/preferences', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': orderId },
    body: JSON.stringify({
      items: [{ id: product.id, title: `${product.title} — ${brand.name}`, quantity: 1, unit_price: product.price, currency_id: currency }],
      payer: { name: order.nombre, email: order.email },
      external_reference: orderId,
      metadata: order,
      back_urls: {
        success: `${siteUrl}/resultado.html`,
        pending: `${siteUrl}/resultado.html`,
        failure: `${siteUrl}/resultado.html`,
      },
      auto_return: 'approved',
      notification_url: `${siteUrl}/api/webhook`,
      statement_descriptor: brand.name.slice(0, 13),
    }),
  });
}

export function getPayment(id) {
  return mp(`/v1/payments/${encodeURIComponent(id)}`);
}

// Verifica la firma "x-signature" que manda Mercado Pago en cada notificación.
// https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
export function validSignature({ signature, requestId, dataId }, secret) {
  if (!signature) return false;
  const parts = Object.fromEntries(signature.split(',').map((kv) => kv.split('=').map((s) => s.trim())));
  if (!parts.ts || !parts.v1) return false;
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  let manifest = `id:${id};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${parts.ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  return expected.length === parts.v1.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}
