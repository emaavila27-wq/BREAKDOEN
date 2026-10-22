import { products } from './config.js';

const OPTIONS = {
  objetivo: ['bajar', 'masa'],
  nivel: ['principiante', 'intermedio', 'avanzado'],
  lugar: ['gym', 'casa'],
  dias: [3, 4, 5],
  sexo: ['m', 'f'],
  actividad: ['sedentario', 'ligero', 'moderado', 'alto'],
  dieta: ['omnivora', 'vegetariana'],
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function text(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function pick(errors, field, value, label) {
  const options = OPTIONS[field];
  const v = typeof options[0] === 'number' ? Number(value) : String(value ?? '').trim().toLowerCase();
  if (!options.includes(v)) errors.push(`Elegí ${label}.`);
  return v;
}

function num(errors, value, min, max, label) {
  const n = Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(n) || n < min || n > max) errors.push(`${label} debe estar entre ${min} y ${max}.`);
  return Math.round(n * 10) / 10;
}

// Valida lo que manda el formulario de compra y devuelve un pedido limpio
// (solo con los campos que el producto necesita) o la lista de errores.
export function parseOrder(body) {
  const errors = [];
  const product = products[String(body?.producto ?? '')];
  if (!product) return { errors: ['Elegí un plan válido.'] };

  const order = {
    producto: product.id,
    nombre: text(body.nombre, 80),
    email: text(body.email, 120).toLowerCase(),
    whatsapp: text(body.whatsapp, 30),
    objetivo: pick(errors, 'objetivo', body.objetivo, 'tu objetivo'),
  };
  if (order.nombre.length < 2) errors.push('Ingresá tu nombre.');
  if (!EMAIL_RE.test(order.email)) errors.push('Ingresá un email válido.');

  if (product.needsTraining) {
    order.nivel = pick(errors, 'nivel', body.nivel, 'tu nivel');
    order.lugar = pick(errors, 'lugar', body.lugar, 'dónde entrenás');
    order.dias = pick(errors, 'dias', body.dias, 'cuántos días entrenás');
  }
  if (product.needsDiet) {
    order.sexo = pick(errors, 'sexo', body.sexo, 'tu sexo biológico');
    order.edad = num(errors, body.edad, 16, 80, 'La edad');
    order.peso = num(errors, body.peso, 35, 250, 'El peso (kg)');
    order.altura = num(errors, body.altura, 130, 230, 'La altura (cm)');
    order.actividad = pick(errors, 'actividad', body.actividad, 'tu nivel de actividad');
    order.dieta = pick(errors, 'dieta', body.dieta, 'tu tipo de alimentación');
  }
  if (product.consult) {
    if (order.whatsapp.replace(/\D/g, '').length < 8) errors.push('Ingresá tu WhatsApp para coordinar la asesoría.');
  }
  order.notas = text(body.notas, 500);

  return errors.length ? { errors } : { order };
}
