import { products } from '../lib/config.js';
import { parseOrder } from '../lib/order.js';
import { getPayment, validSignature } from '../lib/mercadopago.js';
import { buildTrainingPlan, buildDietPlan } from '../lib/plans.js';
import { sendEmail, planEmail, consultEmail, coachSaleEmail } from '../lib/email.js';

// POST /api/webhook — Mercado Pago avisa acá cada cambio en un pago.
// Si el pago está aprobado, genera el plan y lo manda por mail.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const type = req.body?.type ?? req.query.type ?? req.query.topic;
  const dataId = String(req.query['data.id'] ?? req.body?.data?.id ?? req.query.id ?? '');
  if (type !== 'payment' || !dataId) return res.status(200).json({ ignored: true });

  const secret = process.env.MP_WEBHOOK_SECRET;
  if (secret && !validSignature({ signature: req.headers['x-signature'], requestId: req.headers['x-request-id'], dataId }, secret)) {
    return res.status(401).json({ error: 'Firma inválida' });
  }

  try {
    // Consultamos el pago directo a Mercado Pago: nunca confiamos en el cuerpo de la notificación.
    const payment = await getPayment(dataId);
    if (payment.status !== 'approved') return res.status(200).json({ status: payment.status });

    const { order, errors } = parseOrder(payment.metadata ?? {});
    if (errors) throw new Error(`Pago ${dataId} con metadata inválida: ${errors.join(' ')}`);
    const product = products[order.producto];
    if (Number(payment.transaction_amount) < product.price) throw new Error(`Pago ${dataId} con monto menor al precio`);

    const mail = product.consult
      ? consultEmail(order, product)
      : planEmail(order, product, {
          training: product.needsTraining ? buildTrainingPlan(order) : null,
          diet: product.needsDiet ? buildDietPlan(order) : null,
        });

    await sendEmail({ to: order.email, ...mail, replyTo: process.env.COACH_EMAIL, idempotencyKey: `plan-${dataId}` });

    if (process.env.COACH_EMAIL) {
      const sale = coachSaleEmail(order, product, { id: dataId, amount: payment.transaction_amount });
      await sendEmail({ to: process.env.COACH_EMAIL, ...sale, replyTo: order.email, idempotencyKey: `venta-${dataId}` });
    }
    return res.status(200).json({ sent: true });
  } catch (err) {
    // Un 500 hace que Mercado Pago reintente más tarde.
    console.error('webhook', err);
    return res.status(500).json({ error: 'Error procesando el pago' });
  }
}
