// Genera en preview/ los mails de ejemplo para verlos en el navegador
// sin pagar: npm run preview-email
import fs from 'node:fs';
import { products } from '../lib/config.js';
import { parseOrder } from '../lib/order.js';
import { buildTrainingPlan, buildDietPlan } from '../lib/plans.js';
import { planEmail, consultEmail } from '../lib/email.js';

const { order } = parseOrder({
  producto: 'combo', nombre: 'Ana Pérez', email: 'ana@example.com', whatsapp: '1122334455', objetivo: 'bajar',
  nivel: 'intermedio', lugar: 'gym', dias: 4, sexo: 'f', edad: 30, peso: 72, altura: 165, actividad: 'ligero', dieta: 'omnivora',
});
fs.mkdirSync('preview', { recursive: true });
const combo = planEmail(order, products.combo, { training: buildTrainingPlan(order), diet: buildDietPlan(order) });
fs.writeFileSync('preview/combo.html', combo.html);
fs.writeFileSync('preview/asesoria.html', consultEmail(order, products.asesoria).html);
console.log('Listo: preview/combo.html y preview/asesoria.html');
