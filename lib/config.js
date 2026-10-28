// Datos de la marca y catálogo. Es el único archivo que hace falta tocar
// para cambiar nombre, precios o datos de contacto.

export const brand = {
  name: 'BREAKDOWN',
  tagline: 'Entrenamiento & Nutrición',
  coachName: 'Emanuel Noguera',
  // Dominio propio: los mails salen de planes@<dominio>.
  domain: 'breakdownfit.com',
  instagram: 'https://www.instagram.com/emanogue_',
  // Número con código de país, sin "+" ni espacios (ej. 5491122334455).
  whatsapp: '5493482303272',
  // Cambiá este número para generar otra versión del logo (npm run logo).
  logoSeed: 11,
};

export const currency = 'ARS';

// Qué datos pide cada producto y qué entrega.
//   needsTraining → genera la rutina
//   needsDiet     → genera el plan de alimentación
//   consult       → es una asesoría 1 a 1 (el coach contacta al cliente)
//   presencial    → clase presencial: el cliente elige la disciplina
//   per           → texto chico al lado del precio ("mes", "clase")
export const products = {
  entreno: {
    id: 'entreno',
    title: 'Plan de Entrenamiento',
    price: 25000,
    tag: 'RUTINA',
    blurb: 'Rutina de 4 semanas armada según tu objetivo, nivel, días disponibles y si entrenás en el gym, en casa o calistenia en la plaza.',
    features: ['Bloque de 4 semanas con progresión', 'Gym, casa o calistenia', 'Series, reps, descansos y RIR', 'Cardio según tu objetivo'],
    needsTraining: true,
  },
  dieta: {
    id: 'dieta',
    title: 'Plan de Alimentación',
    price: 25000,
    tag: 'DIETA',
    blurb: 'Calorías y macros calculados para bajar de peso o ganar masa muscular, con menú de ejemplo en gramos.',
    features: ['Calorías y macros personalizados', 'Menú con 2 opciones por comida', 'Vegetariana, vegana, sin TACC o sin lactosa', 'Guía de ajustes semana a semana'],
    needsDiet: true,
  },
  combo: {
    id: 'combo',
    title: 'Combo Entreno + Dieta',
    price: 40000,
    tag: 'FULL POWER',
    featured: true,
    blurb: 'Rutina y plan de alimentación juntos, pensados para el mismo objetivo. Lo más completo para transformarte.',
    features: ['Todo lo del plan de entrenamiento', 'Todo lo del plan de alimentación', 'Ahorrás $10.000', 'Un solo pago, llega todo junto'],
    needsTraining: true,
    needsDiet: true,
  },
  asesoria: {
    id: 'asesoria',
    title: 'Asesoría Personalizada 1 a 1',
    price: 60000,
    tag: 'MENTORÍA',
    blurb: 'Seguimiento mensual conmigo: evaluación inicial, rutina y dieta a medida, ajustes y contacto directo por WhatsApp.',
    features: ['Videollamada de evaluación', 'Plan 100% a medida', 'Ajustes cada 2 semanas', 'Consultas por WhatsApp'],
    consult: true,
    per: 'mes',
  },
  presencial: {
    id: 'presencial',
    title: 'Clase Personalizada Presencial',
    price: 25000,
    tag: 'PRESENCIAL',
    blurb: 'Entrenamos juntos, cara a cara, en la disciplina que elijas. Corrección técnica en el momento y una clase pensada para vos.',
    features: ['Calistenia, musculación, funcional o powerlifting', 'Clase suelta o pack de 1 a 5 veces por semana', 'Corrección técnica en vivo', 'Coordinamos día y horario por WhatsApp'],
    consult: true,
    presencial: true,
    per: 'clase',
    // Packs: clases que incluye cada opción y descuento sobre el precio por clase
    // (0.1 = 10% off). Los packs semanales son por mes (4 semanas).
    packs: {
      suelta: { label: 'Clase suelta', clases: 1, descuento: 0 },
      x1: { label: '1 vez por semana', clases: 4, descuento: 0 },
      x2: { label: '2 veces por semana', clases: 8, descuento: 0 },
      x3: { label: '3 veces por semana', clases: 12, descuento: 0 },
      x4: { label: '4 veces por semana', clases: 16, descuento: 0 },
      x5: { label: '5 veces por semana', clases: 20, descuento: 0 },
    },
  },
};

export const disciplinas = {
  calistenia: 'Calistenia',
  musculacion: 'Musculación / gym',
  funcional: 'Funcional',
  powerlifting: 'Powerlifting',
  movilidad: 'Movilidad y flexibilidad',
  otra: 'Otra (contame en las notas)',
};

// Precio final de un pedido (en los packs depende de la frecuencia elegida).
export function priceFor(product, order) {
  const pack = product.packs?.[order.frecuencia];
  if (!pack) return product.price;
  return Math.round((product.price * pack.clases * (1 - pack.descuento)) / 100) * 100;
}

export function publicCatalog() {
  return {
    brand,
    currency,
    products: Object.values(products).map(({ id, title, price, tag, blurb, features, featured, needsTraining, needsDiet, consult, presencial, per, packs }) => ({
      id, title, price, tag, blurb, features, per: per ?? '',
      packs: packs ? Object.entries(packs).map(([pid, pk]) => ({ id: pid, ...pk, total: priceFor({ price, packs }, { frecuencia: pid }) })) : null,
      featured: !!featured, needsTraining: !!needsTraining, needsDiet: !!needsDiet, consult: !!consult, presencial: !!presencial,
    })),
  };
}
