import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { parseOrder } from '../lib/order.js';
import { buildTrainingPlan, buildDietPlan } from '../lib/plans.js';
import { validSignature } from '../lib/mercadopago.js';
import { products } from '../lib/config.js';
import webhook from '../api/webhook.js';
import checkout from '../api/checkout.js';

const combo = {
  producto: 'combo', nombre: 'Ana Pérez', email: 'ana@example.com', objetivo: 'bajar',
  nivel: 'intermedio', lugar: 'gym', dias: '4',
  sexo: 'f', edad: '30', peso: '72', altura: '165', actividad: 'ligero', dieta: 'omnivora',
};

function mockRes() {
  return {
    statusCode: 200, body: undefined, headers: {},
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    end() { return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
}

test('parseOrder valida y deja solo los campos necesarios', () => {
  const { order } = parseOrder({ ...combo, producto: 'entreno', peso: '72' });
  assert.equal(order.dias, 4);
  assert.equal(order.peso, undefined);
  assert.deepEqual(parseOrder({ ...combo, email: 'mal' }).errors, ['Ingresá un email válido.']);
  assert.ok(parseOrder({ ...combo, producto: 'asesoria' }).errors[0].includes('WhatsApp'));
  assert.ok(parseOrder({ producto: 'nada' }).errors);
});

test('rutina: un día por cada día elegido, en gym y en casa', () => {
  for (const dias of [3, 4, 5]) {
    for (const lugar of ['gym', 'casa']) {
      const plan = buildTrainingPlan({ objetivo: 'masa', nivel: 'avanzado', lugar, dias });
      assert.equal(plan.days.length, dias);
      for (const day of plan.days) for (const ex of day.exercises) assert.ok(ex.name && ex.sets && ex.reps);
    }
  }
});

test('dieta: macros cierran con las calorías y el menú se acerca al objetivo', () => {
  for (const objetivo of ['bajar', 'masa']) {
    for (const dieta of ['omnivora', 'vegetariana']) {
      const plan = buildDietPlan({ ...parseOrder({ ...combo, objetivo, dieta }).order });
      const fromMacros = plan.macros.protein * 4 + plan.macros.carbs * 4 + plan.macros.fat * 9;
      assert.ok(Math.abs(fromMacros - plan.kcal) < 60, `${objetivo}/${dieta}: ${fromMacros} vs ${plan.kcal}`);
      for (const meal of plan.meals) {
        for (const opt of meal.options) {
          assert.ok(Math.abs(opt.kcal - meal.kcal) / meal.kcal < 0.3, `${meal.name}: ${opt.kcal} vs ${meal.kcal}`);
        }
      }
    }
  }
  const cut = buildDietPlan(parseOrder(combo).order);
  const bulk = buildDietPlan(parseOrder({ ...combo, objetivo: 'masa' }).order);
  assert.ok(cut.kcal < cut.tdee && bulk.kcal > bulk.tdee);
});

test('firma de Mercado Pago', () => {
  const secret = 's3cr3t';
  const ts = '1700000000';
  const v1 = crypto.createHmac('sha256', secret).update(`id:123;request-id:abc;ts:${ts};`).digest('hex');
  assert.ok(validSignature({ signature: `ts=${ts},v1=${v1}`, requestId: 'abc', dataId: '123' }, secret));
  assert.ok(!validSignature({ signature: `ts=${ts},v1=${v1}`, requestId: 'abc', dataId: '124' }, secret));
  assert.ok(!validSignature({ signature: undefined, dataId: '123' }, secret));
});

// ---- Flujo completo con Mercado Pago y Resend simulados ----
let calls;
const realFetch = globalThis.fetch;
beforeEach(() => {
  calls = [];
  Object.assign(process.env, {
    MP_ACCESS_TOKEN: 'mp', RESEND_API_KEY: 're', EMAIL_FROM: 'x@y.com', COACH_EMAIL: 'coach@y.com', SITE_URL: 'https://sitio.test',
  });
  delete process.env.MP_WEBHOOK_SECRET;
});
afterEach(() => { globalThis.fetch = realFetch; });

function fakeFetch(payment) {
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : undefined });
    if (url.includes('/v1/payments/')) return Response.json(payment);
    if (url.includes('/checkout/preferences')) return Response.json({ init_point: 'https://mp.test/pay' });
    return Response.json({ id: 'email' });
  };
}

test('checkout crea la preferencia con el precio del servidor', async () => {
  fakeFetch();
  const res = mockRes();
  await checkout({ method: 'POST', headers: {}, body: { ...combo, price: 1 } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.url, 'https://mp.test/pay');
  const pref = calls[0].body;
  assert.equal(pref.items[0].unit_price, products.combo.price);
  assert.equal(pref.notification_url, 'https://sitio.test/api/webhook');
  assert.equal(pref.metadata.email, 'ana@example.com');
});

test('webhook con pago aprobado manda plan al cliente y aviso al coach', async () => {
  const order = parseOrder(combo).order;
  fakeFetch({ id: 99, status: 'approved', transaction_amount: products.combo.price, metadata: order });
  const res = mockRes();
  await webhook({ method: 'POST', query: { 'data.id': '99', type: 'payment' }, headers: {}, body: { type: 'payment', data: { id: '99' } } }, res);
  assert.equal(res.statusCode, 200);
  const mails = calls.filter((c) => c.url.includes('resend'));
  assert.equal(mails.length, 2);
  assert.deepEqual(mails[0].body.to, ['ana@example.com']);
  assert.match(mails[0].body.html, /Torso A/);
  assert.match(mails[0].body.html, /kcal \/ día/);
  assert.equal(mails[0].init.headers['Idempotency-Key'], 'plan-99');
  assert.deepEqual(mails[1].body.to, ['coach@y.com']);
});

test('webhook ignora pagos no aprobados y firmas inválidas', async () => {
  fakeFetch({ id: 1, status: 'pending', metadata: {} });
  let res = mockRes();
  await webhook({ method: 'POST', query: { 'data.id': '1', type: 'payment' }, headers: {}, body: {} }, res);
  assert.equal(res.body.status, 'pending');
  assert.equal(calls.filter((c) => c.url.includes('resend')).length, 0);

  process.env.MP_WEBHOOK_SECRET = 'abc';
  res = mockRes();
  await webhook({ method: 'POST', query: { 'data.id': '1', type: 'payment' }, headers: { 'x-signature': 'ts=1,v1=00' }, body: {} }, res);
  assert.equal(res.statusCode, 401);
});
