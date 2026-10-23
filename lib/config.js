// Datos de la marca y catálogo. Es el único archivo que hace falta tocar
// para cambiar nombre, precios o datos de contacto.

export const brand = {
  name: 'BREAKDOWN',
  tagline: 'Entrenamiento & Nutrición',
  coachName: 'Tu Coach',
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
export const products = {
  entreno: {
    id: 'entreno',
    title: 'Plan de Entrenamiento',
    price: 25000,
    tag: 'RUTINA',
    blurb: 'Rutina de 4 semanas armada según tu objetivo, nivel, días disponibles y si entrenás en casa o en el gym.',
    features: ['Bloque de 4 semanas con progresión', 'Gym o casa (con lo que tengas)', 'Series, reps, descansos y RIR', 'Cardio según tu objetivo'],
    needsTraining: true,
  },
  dieta: {
    id: 'dieta',
    title: 'Plan de Alimentación',
    price: 25000,
    tag: 'DIETA',
    blurb: 'Calorías y macros calculados para bajar de peso o ganar masa muscular, con menú de ejemplo en gramos.',
    features: ['Calorías y macros personalizados', 'Menú con 2 opciones por comida', 'Opción vegetariana', 'Guía de ajustes semana a semana'],
    needsDiet: true,
  },
  combo: {
    id: 'combo',
    title: 'Combo Entreno + Dieta',
    price: 100, // TEMPORAL: compra de prueba (precio real 40000)
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
  },
};

export function publicCatalog() {
  return {
    brand,
    currency,
    products: Object.values(products).map(({ id, title, price, tag, blurb, features, featured, needsTraining, needsDiet, consult }) => ({
      id, title, price, tag, blurb, features,
      featured: !!featured, needsTraining: !!needsTraining, needsDiet: !!needsDiet, consult: !!consult,
    })),
  };
}
