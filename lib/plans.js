// Generación de los planes a partir del cuestionario del cliente.
// Todo es determinístico: el mismo cuestionario da siempre el mismo plan.

// ---------------------------------------------------------------- Entreno

const EXERCISES = {
  gym: {
    squat: 'Sentadilla con barra',
    hinge: 'Peso muerto rumano',
    lunge: 'Zancadas con mancuernas',
    legpress: 'Prensa de piernas',
    legcurl: 'Curl femoral en máquina',
    calf: 'Elevación de talones de pie',
    hpush: 'Press de banca con barra',
    incpush: 'Press inclinado con mancuernas',
    vpush: 'Press militar con mancuernas',
    hpull: 'Remo con barra',
    vpull: 'Jalón al pecho (o dominadas)',
    lateral: 'Elevaciones laterales',
    fly: 'Aperturas en polea',
    rear: 'Face pull en polea',
    biceps: 'Curl de bíceps con barra',
    triceps: 'Extensión de tríceps en polea',
    core: 'Plancha frontal',
    core2: 'Rueda abdominal (o crunch en polea)',
  },
  casa: {
    squat: 'Sentadilla goblet (con mochila o bidón)',
    hinge: 'Peso muerto rumano a una pierna',
    lunge: 'Sentadilla búlgara (pie atrás en silla)',
    legpress: 'Sentadilla con tempo 3-1-1',
    legcurl: 'Puente de glúteos a una pierna',
    calf: 'Elevación de talones a una pierna en escalón',
    hpush: 'Flexiones de brazos',
    incpush: 'Flexiones con pies elevados',
    vpush: 'Flexiones pike',
    hpull: 'Remo invertido bajo una mesa firme',
    vpull: 'Dominadas en barra de puerta (o remo con toalla en la puerta)',
    lateral: 'Elevaciones laterales con botellas o banda',
    fly: 'Flexiones con agarre abierto',
    rear: 'Pájaros con banda elástica',
    biceps: 'Curl de bíceps con mochila o banda',
    triceps: 'Fondos de tríceps en silla',
    core: 'Plancha frontal',
    core2: 'Dead bug',
  },
};

// Calistenia: barra y paralelas (plaza o parque). Cada ejercicio tiene una
// variante por nivel: [principiante, intermedio, avanzado].
const CALISTENIA = {
  squat: ['Sentadilla libre', 'Sentadilla búlgara (pie atrás en banco)', 'Pistol squat (sentadilla a una pierna)'],
  hinge: ['Puente de glúteos', 'Peso muerto a una pierna sin peso', 'Curl nórdico (bajada lenta)'],
  lunge: ['Zancadas alternadas', 'Zancadas con salto', 'Shrimp squat (sentadilla de patinador)'],
  legpress: ['Sentadilla con salto', 'Sentadilla búlgara con salto', 'Pistol squat con pausa abajo'],
  legcurl: ['Puente de glúteos a una pierna', 'Curl nórdico asistido con banda', 'Curl nórdico completo'],
  calf: ['Elevación de talones en escalón', 'Elevación de talones a una pierna', 'Elevación de talones a una pierna con pausa'],
  hpush: ['Flexiones (de rodillas si hace falta)', 'Flexiones', 'Flexiones arqueras'],
  incpush: ['Flexiones inclinadas (manos en banco)', 'Flexiones con pies elevados', 'Flexiones pseudo-planche'],
  vpush: ['Flexiones pike', 'Flexiones pike con pies elevados', 'Flexiones en pino contra la pared'],
  hpull: ['Remo australiano en barra baja (rodillas flexionadas)', 'Remo australiano (piernas estiradas)', 'Remo australiano con pies elevados'],
  vpull: ['Dominadas negativas (bajada en 5 seg)', 'Dominadas', 'Dominadas arqueras o lastradas'],
  lateral: ['Fondos en banco', 'Fondos en paralelas', 'Fondos en paralelas lastrados'],
  fly: ['Flexiones abiertas', 'Flexiones con pausa abajo', 'Flexiones explosivas con palmada'],
  rear: ['Retracción escapular colgado de la barra', 'Remo australiano agarre ancho', 'Front lever tuck (isométrico)'],
  biceps: ['Remo australiano agarre supino', 'Dominadas supinas (chin-ups)', 'Chin-ups con bajada lenta (3 seg)'],
  triceps: ['Flexiones diamante de rodillas', 'Flexiones diamante', 'Extensión de tríceps en barra baja'],
  core: ['Plancha frontal', 'L-sit en paralelas (rodillas flexionadas)', 'L-sit en paralelas'],
  core2: ['Elevación de rodillas colgado', 'Elevación de piernas colgado', 'Toes to bar'],
};
const LEVELS = ['principiante', 'intermedio', 'avanzado'];

const DAYS = {
  fullA: { name: 'Full Body A', moves: ['squat', 'hpush', 'hpull', 'hinge', 'lateral', 'core'] },
  fullB: { name: 'Full Body B', moves: ['hinge', 'vpush', 'vpull', 'lunge', 'biceps', 'triceps', 'core2'] },
  upperA: { name: 'Torso A', moves: ['hpush', 'hpull', 'vpush', 'vpull', 'lateral', 'biceps', 'triceps'] },
  lowerA: { name: 'Piernas A', moves: ['squat', 'hinge', 'lunge', 'legcurl', 'calf', 'core'] },
  upperB: { name: 'Torso B', moves: ['incpush', 'vpull', 'hpull', 'fly', 'rear', 'triceps', 'biceps'] },
  lowerB: { name: 'Piernas B', moves: ['hinge', 'legpress', 'lunge', 'legcurl', 'calf', 'core2'] },
  push: { name: 'Empuje (pecho, hombro, tríceps)', moves: ['hpush', 'incpush', 'vpush', 'lateral', 'fly', 'triceps'] },
  pull: { name: 'Tracción (espalda, bíceps)', moves: ['vpull', 'hpull', 'rear', 'biceps', 'core2'] },
  legs: { name: 'Piernas', moves: ['squat', 'hinge', 'legpress', 'legcurl', 'calf', 'core'] },
};

const SPLITS = {
  3: ['fullA', 'fullB', 'fullA'],
  4: ['upperA', 'lowerA', 'upperB', 'lowerB'],
  5: ['push', 'pull', 'legs', 'upperB', 'lowerB'],
};

const SPLIT_NAMES = { 3: 'Full Body', 4: 'Torso / Piernas', 5: 'Empuje / Tracción / Piernas + Torso / Piernas' };

function prescription(move, index, { objetivo, nivel, lugar }) {
  const cali = lugar === 'calistenia';
  if (move === 'core' || move === 'core2') {
    if (cali) return { sets: 3, reps: move === 'core' ? (nivel === 'principiante' ? '30-45 seg' : '10-20 seg') : '8-12', rest: '60 seg' };
    return { sets: 3, reps: move === 'core' ? '30-45 seg' : '10-12 por lado', rest: '45 seg' };
  }
  const compound = index < 2;
  const masa = objetivo === 'masa';
  const sets = compound && nivel !== 'principiante' ? 4 : 3;
  let reps;
  if (compound) reps = masa ? (nivel === 'principiante' ? '8-10' : '6-8') : '8-10';
  else reps = masa ? '10-12' : '12-15';
  const rest = compound ? (masa ? '2-3 min' : '90 seg') : (masa ? '60-90 seg' : '45-60 seg');
  let note = !compound && nivel === 'avanzado' ? (cali ? 'Última serie al fallo técnico' : 'Última serie con drop set') : '';
  if (cali && move === 'vpull' && nivel === 'principiante') note = 'Si no llegás a las reps, hacé las que puedas con buena técnica';
  return { sets, reps, rest, note };
}

function cardio({ objetivo, nivel }) {
  if (objetivo === 'bajar') {
    const items = [
      'Pasos diarios: apuntá a 8.000-10.000.',
      'Al final de cada sesión: 15-20 min de cardio suave (caminata en cinta inclinada, bici o escaladora).',
    ];
    if (nivel !== 'principiante') items.push('1-2 veces por semana, en días sin pesas: HIIT de 10 rondas de 30 seg fuerte / 60 seg suave.');
    return items;
  }
  return [
    'Pasos diarios: 6.000-8.000 para cuidar la salud sin gastar de más.',
    '2 sesiones por semana de 20 min de cardio suave en días libres o al final del entreno.',
  ];
}

export function buildTrainingPlan(order) {
  const { lugar, dias } = order;
  const cali = lugar === 'calistenia';
  const name = (move) => (cali ? CALISTENIA[move][LEVELS.indexOf(order.nivel)] : EXERCISES[lugar][move]);
  const days = SPLITS[dias].map((key, i) => ({
    title: `Día ${i + 1} — ${DAYS[key].name}`,
    exercises: DAYS[key].moves.map((move, idx) => ({ name: name(move), ...prescription(move, idx, order) })),
  }));

  return {
    split: SPLIT_NAMES[dias],
    dias,
    lugar,
    days,
    equipment: cali ? 'Necesitás una barra de dominadas y paralelas: cualquier plaza o parque de calistenia sirve. Si no tenés barra baja para los remos, usá la parte baja de las paralelas.' : '',
    warmup: [
      '5 min de movilidad general (círculos de cadera, hombros y tobillos).',
      ...(cali ? ['Movilidad de muñecas (círculos y apoyos en cuatro patas) y 2 series de 10 retracciones escapulares colgado.'] : []),
      '2 series de aproximación livianas del primer ejercicio antes de las series efectivas.',
    ],
    weeks: [
      { week: 1, text: 'Adaptación: dejá 3 repeticiones "en el tanque" (RIR 3). Enfocate en la técnica.' },
      { week: 2, text: 'Subí carga o reps. Dejá 2 repeticiones en reserva (RIR 2).' },
      { week: 3, text: 'Semana pesada: RIR 1. Anotá tus marcas, las vas a superar en el próximo bloque.' },
      { week: 4, text: 'Descarga: mismas cargas que la semana 1 pero con una serie menos por ejercicio.' },
    ],
    progression: cali
      ? 'Cuando completes el tope del rango de repeticiones en todas las series con buena técnica, pasá a la variante más difícil del ejercicio (por ejemplo: flexiones → flexiones con pies elevados → flexiones arqueras) o hacé la bajada más lenta (3-5 seg).'
      : 'Cuando completes el tope del rango de repeticiones en todas las series, subí el peso (2,5-5 kg en básicos, 1-2 kg en accesorios) o, en casa, pasá a una variante más difícil o más lenta.',
    cardio: cardio(order),
  };
}

// ----------------------------------------------------------------- Dieta

// Valores por 100 g (en cocido cuando corresponde).
const FOODS = {
  pollo: { name: 'Pechuga de pollo (cocida)', p: 31, c: 0, f: 3.6 },
  carne: { name: 'Carne vacuna magra: nalga, peceto o cuadril (cocida)', p: 30, c: 0, f: 7 },
  pescado: { name: 'Merluza o pescado blanco (cocido)', p: 20, c: 0, f: 1.5 },
  atun: { name: 'Atún al natural', p: 26, c: 0, f: 1 },
  huevo: { name: 'Huevos', p: 12.5, c: 1, f: 10, unit: 50, unitName: 'huevo' },
  yogur: { name: 'Yogur descremado o griego sin azúcar', p: 9, c: 4, f: 0.5 },
  queso: { name: 'Queso untable descremado', p: 12, c: 4, f: 3 },
  tofu: { name: 'Tofu firme', p: 13, c: 2, f: 7 },
  lentejas: { name: 'Lentejas o garbanzos (cocidos)', p: 9, c: 20, f: 0.5 },
  arroz: { name: 'Arroz (cocido)', p: 2.7, c: 28, f: 0.3 },
  papa: { name: 'Papa o batata (cocida)', p: 2, c: 20, f: 0.1 },
  fideos: { name: 'Fideos (cocidos)', p: 5.5, c: 30, f: 1 },
  avena: { name: 'Avena', p: 13, c: 60, f: 7 },
  pan: { name: 'Pan integral', p: 9, c: 45, f: 3, unit: 30, unitName: 'rebanada' },
  fruta: { name: 'Fruta (banana, manzana, naranja)', p: 1, c: 18, f: 0.3 },
  aceite: { name: 'Aceite de oliva', p: 0, c: 0, f: 100 },
  palta: { name: 'Palta', p: 2, c: 9, f: 15 },
  nueces: { name: 'Frutos secos (nueces, almendras)', p: 20, c: 15, f: 55 },
  mani: { name: 'Mantequilla de maní', p: 25, c: 20, f: 50 },
};

const MEALS = [
  {
    name: 'Desayuno', share: 0.25,
    options: {
      omnivora: [['yogur', 'avena', 'nueces'], ['huevo', 'pan', 'palta']],
      vegetariana: [['yogur', 'avena', 'nueces'], ['huevo', 'pan', 'palta']],
    },
  },
  {
    name: 'Almuerzo', share: 0.3, veg: true,
    options: {
      omnivora: [['pollo', 'arroz', 'aceite'], ['carne', 'papa', 'aceite']],
      vegetariana: [['tofu', 'arroz', 'aceite'], ['lentejas', 'fideos', 'aceite']],
    },
  },
  {
    name: 'Merienda', share: 0.15,
    options: {
      omnivora: [['yogur', 'fruta', 'mani'], ['queso', 'pan', 'nueces']],
      vegetariana: [['yogur', 'fruta', 'mani'], ['queso', 'pan', 'nueces']],
    },
  },
  {
    name: 'Cena', share: 0.3, veg: true,
    options: {
      omnivora: [['pescado', 'papa', 'aceite'], ['atun', 'fideos', 'aceite']],
      vegetariana: [['huevo', 'papa', 'aceite'], ['tofu', 'fideos', 'aceite']],
    },
  },
];

const ACTIVITY = { sedentario: 1.2, ligero: 1.375, moderado: 1.55, alto: 1.725 };
const ACTIVITY_TEXT = {
  sedentario: 'poco movimiento en el día',
  ligero: 'algo de movimiento diario',
  moderado: 'activo/a la mayor parte del día',
  alto: 'trabajo físico o muy activo/a',
};

const round = (n, step = 1) => Math.round(n / step) * step;

function portion(key, grams) {
  const food = FOODS[key];
  if (food.unit) {
    const units = Math.max(1, Math.round(grams / food.unit));
    return { food: food.name, amount: `${units} ${food.unitName}${units > 1 ? 's' : ''}`, grams: units * food.unit, key };
  }
  const g = Math.max(key === 'aceite' ? 5 : 10, round(grams, key === 'aceite' ? 5 : 10));
  return { food: food.name, amount: key === 'aceite' ? `${g} g (${g / 10} cda.)` : `${g} g`, grams: g, key };
}

// Arma una opción de comida eligiendo los gramos de cada alimento para
// acercarse a los macros de esa comida.
function mealOption([pk, ck, fk], target) {
  const pf = FOODS[pk], cf = FOODS[ck], ff = FOODS[fk];
  const prot = portion(pk, (target.p * 0.8) / pf.p * 100);
  const carbsLeft = Math.max(0, target.c - prot.grams * pf.c / 100);
  const carb = portion(ck, carbsLeft / cf.c * 100);
  const fatLeft = Math.max(0, target.f - prot.grams * pf.f / 100 - carb.grams * cf.f / 100);
  const items = [prot, carb];
  if (fatLeft >= 3) items.push(portion(fk, fatLeft / ff.f * 100));
  const totals = items.reduce((t, it) => {
    const f = FOODS[it.key];
    t.p += it.grams * f.p / 100; t.c += it.grams * f.c / 100; t.f += it.grams * f.f / 100;
    return t;
  }, { p: 0, c: 0, f: 0 });
  totals.kcal = round(totals.p * 4 + totals.c * 4 + totals.f * 9, 10);
  return { items: items.map(({ food, amount }) => ({ food, amount })), kcal: totals.kcal };
}

export function buildDietPlan(order) {
  const { sexo, edad, peso, altura, actividad, objetivo, dieta } = order;
  const bmr = 10 * peso + 6.25 * altura - 5 * edad + (sexo === 'm' ? 5 : -161);
  const tdee = bmr * ACTIVITY[actividad];
  const floor = sexo === 'm' ? 1500 : 1200;
  const kcal = round(Math.max(floor, objetivo === 'bajar' ? tdee * 0.8 : tdee * 1.1), 50);

  // Con IMC alto, la proteína se calcula sobre un peso de referencia (IMC 27)
  // para no pedir cantidades exageradas.
  const h = altura / 100;
  const bmi = peso / (h * h);
  const refWeight = bmi > 30 ? 27 * h * h : peso;
  const protein = round(refWeight * (objetivo === 'bajar' ? 2 : 1.8), 5);
  const fat = round(Math.max(refWeight * (objetivo === 'bajar' ? 0.8 : 1), kcal * 0.25 / 9), 5);
  const carbs = Math.max(50, round((kcal - protein * 4 - fat * 9) / 4, 5));

  const meals = MEALS.map((meal) => {
    const target = { p: protein * meal.share, c: carbs * meal.share, f: fat * meal.share };
    return {
      name: meal.name,
      kcal: round(kcal * meal.share, 10),
      macros: { p: round(target.p), c: round(target.c), f: round(target.f) },
      veg: !!meal.veg,
      options: meal.options[dieta].map((combo) => mealOption(combo, target)),
    };
  });

  const weekly = objetivo === 'bajar'
    ? 'Pesate 3 veces por semana en ayunas y mirá el promedio. Lo ideal es bajar entre 0,5% y 1% de tu peso por semana. Si en 2 semanas el promedio no bajó, restá 150 kcal (sacá carbohidratos). Si bajás más de 1% por semana durante varias semanas, sumá 100-150 kcal.'
    : 'Pesate 3 veces por semana en ayunas y mirá el promedio. Lo ideal es subir entre 0,25% y 0,5% de tu peso por semana. Si en 2 semanas no subiste, sumá 150 kcal (agregá carbohidratos). Si subís mucho más rápido, restá 100 kcal.';

  return {
    objetivo,
    dieta,
    bmr: round(bmr, 10),
    tdee: round(tdee, 10),
    activityText: ACTIVITY_TEXT[actividad],
    kcal,
    macros: { protein, carbs, fat },
    meals,
    weekly,
    tips: [
      'Verduras libres en almuerzo y cena: llená medio plato (hoja verde, tomate, zapallito, brócoli, etc.).',
      'Agua: entre 30 y 40 ml por kilo de peso por día; más si entrenás con calor.',
      'Dormí 7-9 horas: el descanso es parte del plan, no un extra.',
      'Podés intercambiar opciones entre días. Lo importante es el total del día.',
      'Pesá los alimentos las primeras 2 semanas; después vas a calcular "a ojo" mucho mejor.',
      'Bebidas: agua, soda, té, café, mate y gaseosas sin azúcar. El alcohol suma calorías y frena el progreso.',
    ],
  };
}
