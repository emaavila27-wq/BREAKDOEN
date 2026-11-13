// Rutina de ejemplo (Front Lever / Planche) para cargar desde el editor del coach.
// sets = series, target = reps o tiempo, rest = descanso en segundos.
const ex = (name, sets, target, rest, tags = []) => ({ name, sets, target, rest, tags });

export const SAMPLE_ROUTINE = {
  title: 'Front & Planche',
  data: {
    days: [
      { name: 'Lunes', focus: 'Front + motor de movimiento FP', blocks: [
        { title: 'Post calentamiento · Motor de movimiento FP', exercises: [
          ex('Lean Planche Pro-Retraction', 3, '6 reps', 90, ['espalda']),
          ex('90 Degree', 2, 'máx. hold', 120, ['pies']),
        ] },
        { title: 'Front', exercises: [
          ex('FL L-Pull', 4, 'máx. reps', 150, ['roja']),
          ex('Touch en Tuck Advanced', 3, 'máx. reps', 120, ['banda']),
          ex('FL One Leg', 3, 'máx. press', 150, ['roja']),
          ex('FL Raises', 3, 'máx. reps', 120),
          ex('Dominadas', 3, '5 reps', 150, ['kg:+5 kg']),
        ] },
      ] },
      { name: 'Martes', focus: 'Planche con activación para Front', blocks: [
        { title: 'Post calentamiento · Activación FL', exercises: [
          ex('FL One Leg', 2, 'máx. hold', 120, ['roja']),
          ex('FL en L-Pull', 4, '6 reps', 120, ['amarilla']),
        ] },
        { title: 'Planche', exercises: [
          ex('Lean Planche to Pike', 3, 'máx. reps', 120, ['pies']),
          ex('Box to Handstand', 3, '3 reps', 120),
          ex('Lean Planche Push Up', 3, 'máx. reps', 120, ['pies']),
          ex('Lean Planche Pro-Retraction', 5, '6 reps', 90, ['espalda']),
          ex('Handstand Push Up', 3, 'máx. reps', 150, ['kg:+2 kg']),
          ex('90 Degree', 4, 'máx. hold', 120, ['pies']),
        ] },
      ] },
      { name: 'Jueves', focus: 'Front, handstand y planche', blocks: [
        { title: 'Post calentamiento · Motor de movimiento FP', exercises: [
          ex('Box to Handstand', 3, '3 reps', 120),
          ex('90 Degree', 2, 'máx. hold', 120, ['pies']),
        ] },
        { title: 'Front', exercises: [
          ex('FL One Leg', 3, 'máx. hold', 150),
          ex('FL One Leg alternando pierna', 3, '6 reps', 120),
          ex('FL Straddle', 3, 'máx. hold', 150, ['roja']),
          ex('L-Pull', 3, 'máx. reps', 120, ['roja']),
          ex('FL Raises', 3, 'máx. reps', 120, ['amarilla']),
          ex('Dominadas', 3, '5 reps', 150, ['kg:+5 kg']),
        ] },
      ] },
      { name: 'Viernes', focus: 'Planche + motor de movimiento FL', blocks: [
        { title: 'Post calentamiento · Motor de movimiento FL', exercises: [
          ex('Straddle', 3, 'máx. hold', 120, ['roja']),
          ex('FL One Leg', 2, 'máx. hold', 120, ['roja']),
        ] },
        { title: 'Planche', exercises: [
          ex('Straddle', 3, 'máx. hold', 150, ['amarilla']),
          ex('Handstand negativa a tuck', 4, '3 reps', 120, ['amarilla']),
          ex('90 Degree 3 seg to Push', 4, '3 reps', 120, ['pies']),
          ex('Handstand Push Up', 4, '7 reps', 150, ['kg:+2 kg']),
        ] },
      ] },
    ],
  },
};
