import { brand } from './config.js';

// Envía un mail con Resend (https://resend.com). La idempotencyKey evita
// mandar el mismo plan dos veces si Mercado Pago repite la notificación.
export async function sendEmail({ to, subject, html, replyTo, idempotencyKey }) {
  const headers = {
    Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || `${brand.name} <planes@${brand.domain}>`,
      to: [to],
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return res.json();
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const C = { bg: '#121212', card: '#1a1a1a', line: '#2e2e2e', text: '#ece8e1', muted: '#9a958d', red: '#c4161c', alt: '#6e6a64' };

const h2 = (t) => `<h2 style="margin:32px 0 12px;font:800 22px/1.2 Impact,'Arial Narrow',Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;color:${C.red}">${t}</h2>`;
const p = (t) => `<p style="margin:0 0 12px;font:15px/1.6 Arial,sans-serif;color:${C.text}">${t}</p>`;
const ul = (items) => `<ul style="margin:0 0 12px;padding-left:20px;font:15px/1.6 Arial,sans-serif;color:${C.text}">${items.map((i) => `<li style="margin-bottom:6px">${i}</li>`).join('')}</ul>`;
const th = (t, align = 'left') => `<th style="padding:8px 10px;text-align:${align};font:700 12px Arial,sans-serif;text-transform:uppercase;letter-spacing:.5px;color:${C.muted};border-bottom:1px solid ${C.line}">${t}</th>`;
const td = (t, align = 'left') => `<td style="padding:8px 10px;text-align:${align};font:14px/1.4 Arial,sans-serif;color:${C.text};border-bottom:1px solid ${C.line}">${t}</td>`;

// El logo en PNG se sirve desde el sitio (los mails no muestran SVG).
const logoUrl = () => `${(process.env.SITE_URL || `https://www.${brand.domain}`).replace(/\/$/, '')}/logo-email.png`;

function layout(title, body) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.bg}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px">
<tr><td style="padding:28px 24px;background:#000;border-top:4px solid ${C.red};text-align:center">
${logoUrl() ? `<img src="${logoUrl()}" width="280" alt="${esc(brand.name)}" style="display:block;margin:0 auto;width:280px;max-width:80%;height:auto;border:0;color:${C.red};font:900 36px Impact,Arial,sans-serif">` : `<div style="font:900 40px/1 Impact,'Arial Black',Arial,sans-serif;letter-spacing:6px;color:${C.red}">${esc(brand.name)}</div>`}
<div style="margin-top:8px;font:800 12px Arial,sans-serif;letter-spacing:5px;text-transform:uppercase;color:${C.text}">${esc(brand.tagline)}</div>
</td></tr>
<tr><td style="padding:24px;background:${C.card}">${body}</td></tr>
<tr><td style="padding:20px 24px;text-align:center;font:12px/1.6 Arial,sans-serif;color:${C.muted}">
¿Dudas? Respondé este mail o escribime por <a href="https://wa.me/${brand.whatsapp}" style="color:${C.text}">WhatsApp</a>.<br>
Este plan es orientativo y no reemplaza la consulta con un médico o nutricionista. Si tenés alguna condición de salud, consultá antes de empezar.
</td></tr>
</table></td></tr></table></body></html>`;
}

function trainingHtml(plan) {
  const days = plan.days.map((day) => `
<h3 style="margin:24px 0 8px;font:800 17px Impact,'Arial Narrow',Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;color:${C.text}">${esc(day.title)}</h3>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#0f0f11">
<tr>${th('Ejercicio')}${th('Series', 'center')}${th('Reps', 'center')}${th('Descanso', 'center')}</tr>
${day.exercises.map((e) => `<tr>${td(`${esc(e.name)}${e.note ? `<br><span style="font-size:12px;color:${C.red}">${esc(e.note)}</span>` : ''}`)}${td(e.sets, 'center')}${td(esc(e.reps), 'center')}${td(esc(e.rest), 'center')}</tr>`).join('')}
</table>`).join('');

  return `${h2('Tu plan de entrenamiento')}
${p(`<strong>División:</strong> ${esc(plan.split)} · <strong>${plan.dias} días por semana</strong> · ${plan.lugar === 'gym' ? 'En gimnasio' : 'En casa'}`)}
${p('<strong>Entrada en calor (siempre):</strong>')}${ul(plan.warmup.map(esc))}
${days}
${h2('Las 4 semanas del bloque')}
${ul(plan.weeks.map((w) => `<strong>Semana ${w.week}:</strong> ${esc(w.text)}`))}
${p(`<strong>Cómo progresar:</strong> ${esc(plan.progression)}`)}
${p('<strong>RIR</strong> = repeticiones en reserva: cuántas más podrías hacer con buena técnica antes de fallar.')}
${h2('Cardio y movimiento')}${ul(plan.cardio.map(esc))}`;
}

function dietHtml(plan) {
  const meals = plan.meals.map((meal) => `
<h3 style="margin:24px 0 4px;font:800 17px Impact,'Arial Narrow',Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;color:${C.text}">${meal.name} <span style="font:13px Arial,sans-serif;color:${C.muted};text-transform:none;letter-spacing:0">≈ ${meal.kcal} kcal · P ${meal.macros.p} g · C ${meal.macros.c} g · G ${meal.macros.f} g</span></h3>
${meal.options.map((opt, i) => `<div style="margin:8px 0;padding:12px 14px;background:#0f0f11;border-left:3px solid ${i ? C.alt : C.red}">
<div style="font:700 12px Arial,sans-serif;text-transform:uppercase;letter-spacing:1px;color:${C.muted};margin-bottom:6px">Opción ${i + 1}</div>
${opt.items.map((it) => `<div style="font:14px/1.6 Arial,sans-serif;color:${C.text}"><strong>${esc(it.amount)}</strong> — ${esc(it.food)}</div>`).join('')}
${meal.veg ? `<div style="font:14px/1.6 Arial,sans-serif;color:${C.muted}">+ verduras libres</div>` : ''}
</div>`).join('')}`).join('');

  return `${h2(`Tu plan de alimentación — ${plan.objetivo === 'bajar' ? 'pérdida de grasa' : 'ganancia muscular'}`)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:12px">
<tr>
<td style="padding:14px;background:#000;text-align:center;border:1px solid ${C.line}"><div style="font:900 28px Impact,Arial,sans-serif;color:${C.red}">${plan.kcal}</div><div style="font:12px Arial,sans-serif;color:${C.muted};text-transform:uppercase">kcal / día</div></td>
<td style="padding:14px;background:#000;text-align:center;border:1px solid ${C.line}"><div style="font:900 28px Impact,Arial,sans-serif;color:${C.text}">${plan.macros.protein} g</div><div style="font:12px Arial,sans-serif;color:${C.muted};text-transform:uppercase">Proteína</div></td>
<td style="padding:14px;background:#000;text-align:center;border:1px solid ${C.line}"><div style="font:900 28px Impact,Arial,sans-serif;color:${C.text}">${plan.macros.carbs} g</div><div style="font:12px Arial,sans-serif;color:${C.muted};text-transform:uppercase">Carbos</div></td>
<td style="padding:14px;background:#000;text-align:center;border:1px solid ${C.line}"><div style="font:900 28px Impact,Arial,sans-serif;color:${C.text}">${plan.macros.fat} g</div><div style="font:12px Arial,sans-serif;color:${C.muted};text-transform:uppercase">Grasas</div></td>
</tr></table>
${p(`Tu metabolismo basal estimado es de <strong>${plan.bmr} kcal</strong> y, con ${esc(plan.activityText)}, gastás alrededor de <strong>${plan.tdee} kcal</strong> por día. Por eso tu objetivo diario es <strong>${plan.kcal} kcal</strong>.`)}
${p('Cada comida tiene dos opciones equivalentes: elegí la que más te guste o alternalas.')}
${meals}
${h2('Ajustes semana a semana')}${p(esc(plan.weekly))}
${h2('Reglas de oro')}${ul(plan.tips.map(esc))}`;
}

export function planEmail(order, product, { training, diet }) {
  const first = esc(order.nombre.split(' ')[0]);
  const body = `${p(`<span style="font:900 26px Impact,Arial,sans-serif;color:${C.text};text-transform:uppercase">¡Bienvenido/a al hierro, ${first}!</span>`)}
${p(`Gracias por comprar el <strong>${esc(product.title)}</strong>. Acá abajo tenés todo armado con los datos que cargaste. Guardá este mail: es tu plan.`)}
${training ? trainingHtml(training) : ''}
${diet ? dietHtml(diet) : ''}
${h2('Último consejo')}
${p('La constancia le gana a la intensidad. Cumplí el plan 4 semanas, anotá tus pesos y respondé este mail contándome cómo te fue.')}`;
  return { subject: `🔥 Tu ${product.title} — ${brand.name}`, html: layout(product.title, body) };
}

export function consultEmail(order, product) {
  const first = esc(order.nombre.split(' ')[0]);
  const body = `${p(`<span style="font:900 26px Impact,Arial,sans-serif;color:${C.text};text-transform:uppercase">¡Arrancamos, ${first}!</span>`)}
${p(`Recibí el pago de tu <strong>${esc(product.title)}</strong>. En las próximas 24-48 horas hábiles te escribo al WhatsApp <strong>${esc(order.whatsapp)}</strong> para coordinar la videollamada de evaluación.`)}
${h2('Para la primera llamada tené a mano')}
${ul(['Tu peso actual y, si podés, medidas de cintura y cadera.', 'Fotos de frente, perfil y espalda (solo las ves vos y yo).', 'Qué días y horarios podés entrenar.', 'Lesiones, medicación o estudios médicos recientes.', 'Qué comés en un día normal.'])}
${p('Si preferís, podés adelantarme todo respondiendo este mail.')}`;
  return { subject: `🤘 Tu asesoría 1 a 1 está confirmada — ${brand.name}`, html: layout(product.title, body) };
}

const LABELS = {
  producto: 'Producto', nombre: 'Nombre', email: 'Email', whatsapp: 'WhatsApp', objetivo: 'Objetivo',
  nivel: 'Nivel', lugar: 'Lugar', dias: 'Días/semana', sexo: 'Sexo', edad: 'Edad', peso: 'Peso (kg)',
  altura: 'Altura (cm)', actividad: 'Actividad', dieta: 'Alimentación', notas: 'Notas',
};

function dataTable(data) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${Object.entries(data)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `<tr>${td(`<strong>${esc(LABELS[k] ?? k)}</strong>`)}${td(esc(v))}</tr>`).join('')}</table>`;
}

export function coachSaleEmail(order, product, payment) {
  const body = `${p(`<strong>Nueva venta:</strong> ${esc(product.title)} por $${Number(payment.amount).toLocaleString('es-AR')} (pago #${esc(payment.id)}).`)}
${p(product.consult ? '⚠️ Es una asesoría: contactá al cliente por WhatsApp.' : 'El plan ya se le envió al cliente por mail.')}
${dataTable(order)}`;
  return { subject: `💰 Venta: ${product.title} — ${order.nombre}`, html: layout('Nueva venta', body) };
}

export function contactEmail(data) {
  const body = `${p('<strong>Nueva consulta desde la web</strong>')}
${dataTable({ nombre: data.nombre, email: data.email, whatsapp: data.whatsapp, Motivo: data.motivo })}
<div style="margin-top:16px;padding:14px;background:#0f0f11;border-left:3px solid ${C.red};font:15px/1.6 Arial,sans-serif;color:${C.text};white-space:pre-wrap">${esc(data.mensaje)}</div>
${p('<br>Respondé este mail para contestarle directamente.')}`;
  return { subject: `📩 Consulta web: ${data.motivo} — ${data.nombre}`, html: layout('Consulta', body) };
}
