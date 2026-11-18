import * as db from '/portal/db.js';
import { $, $$, esc, when, duration, toast, groupSets, initials, TAGS, videosHtml, needsReview, exKey, exerciseFeedbackHtml, generalMessagesHtml, sendAllHtml, refreshSendAll } from '/portal/ui.js';
import { SAMPLE_ROUTINE } from '/portal/sample-routine.js';

let me = null;
let students = [];   // perfiles de alumnos
let routines = [];   // rutinas de todos
let sessions = [];   // entrenamientos terminados
let filter = 'pending';
let studentFilter = '';
// Entrenamientos que calificaste/corregiste en esta visita: siguen visibles en "Sin calificar".
const touched = new Set();

function show(id) {
  $$('.view').forEach((v) => { v.hidden = v.id !== id; });
  window.scrollTo(0, 0);
}
const nameOf = (id) => (id === me.id ? 'Vos' : students.find((s) => s.id === id)?.nombre || 'Alumno');

// --------------------------------------------------------------- Login
$('#f-auth').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const msg = $('.form-msg', f);
  try {
    await db.signIn(f.email.value.trim(), f.password.value);
    await boot();
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'form-msg error';
  }
});
$('#logout').addEventListener('click', async () => {
  await db.signOut();
  $('#nav-user').hidden = true;
  show('v-auth');
});
$$('[data-go]').forEach((b) => b.addEventListener('click', () => (b.dataset.go === 'feed' ? renderFeed() : renderStudents())));

// ------------------------------------------------------- Entrenamientos
$$('[data-filter]').forEach((b) => b.addEventListener('click', () => {
  filter = b.dataset.filter;
  $$('[data-filter]').forEach((x) => x.classList.toggle('on', x === b));
  paintFeed();
}));
$('#student-filter').addEventListener('change', (e) => { studentFilter = e.target.value; paintFeed(); });

async function loadAll() {
  [students, routines, sessions] = await Promise.all([db.listStudents(), db.listRoutines(), db.listSessions()]);
  updateBadge();
  $('#student-filter').innerHTML = '<option value="">Todos los alumnos</option>' +
    students.map((s) => `<option value="${s.id}"${s.id === studentFilter ? ' selected' : ''}>${esc(s.nombre || s.email)}</option>`).join('');
}

const pendingOf = (s) => needsReview(s, [me.id]);
function updateBadge() {
  const pending = sessions.filter(pendingOf).length;
  $('#pending-badge').hidden = !pending;
  $('#pending-badge').textContent = pending;
}

async function renderFeed() {
  show('v-feed');
  $('#feed').innerHTML = '<div class="empty">Cargando…</div>';
  try {
    await loadAll();
    paintFeed();
  } catch (err) { $('#feed').innerHTML = `<div class="empty">${esc(err.message)}</div>`; }
}

function paintFeed() {
  const list = sessions
    .filter((s) => filter === 'all' || pendingOf(s) || touched.has(s.id))
    .filter((s) => !studentFilter || s.student_id === studentFilter);
  $('#feed').innerHTML = list.length ? list.map(cardHtml).join('')
    : `<div class="empty">${filter === 'pending' ? 'No hay entrenamientos sin calificar. 🤘' : 'Todavía no hay entrenamientos.'}</div>`;
  wireCards();
}

function cardHtml(s) {
  const st = students.find((x) => x.id === s.student_id);
  const name = st?.nombre || st?.email || 'Alumno';
  return `
    <article class="sess${pendingOf(s) ? ' unread' : ''}" data-id="${s.id}">
      <div class="sess-head">
        <div class="avatar">${esc(initials(name))}</div>
        <div class="grow">
          <div class="t">${esc(name)} · ${esc(s.day_name)}</div>
          <div class="m">${esc(s.day_focus)} · ${when(s.finished_at)} · ${duration(s.started_at, s.finished_at)} · ${s.sets.length} series</div>
        </div>
      </div>
      <div class="sess-body">
        ${s.sensaciones ? `<div class="feel"><b>Sensaciones</b>${esc(s.sensaciones)}</div>` : ''}
        ${s.sets.length ? groupSets(s.sets).map((g) => `
          <div class="ex-sum">
            <div class="name">${esc(g.exercise)} <span class="m" style="font-weight:400;color:var(--muted)">· ${esc(g.block)}</span></div>
            <div class="reps">${g.sets.map((x) => `S${x.set_number}: ${esc(x.reps || '✓')}`).join(' · ')}</div>
            ${videosHtml(g.sets, { interactive: true })}
            ${exerciseFeedbackHtml(s, exKey(g), me.id, nameOf, `Corrección para ${g.exercise}…`)}
          </div>`).join('') : '<div class="m" style="color:var(--muted)">No marcó series.</div>'}
        ${generalMessagesHtml(s, me.id, nameOf)}
        ${sendAllHtml(s, 'Enviar devolución')}
      </div>
    </article>`;
}

function wireCards() {
  $$('[data-video]').forEach((slot) => slot.addEventListener('click', async () => {
    slot.textContent = 'Cargando…';
    try {
      const v = document.createElement('video');
      v.src = await db.videoUrl(slot.dataset.video);
      v.controls = true; v.playsInline = true; v.autoplay = true;
      slot.replaceWith(v);
    } catch (err) { slot.textContent = err.message; }
  }, { once: true }));

  $$('.sess').forEach((card) => {
    const sessionId = card.dataset.id;
    // Estrellas marcadas que todavía no se mandaron: id de la serie → estrellas.
    const ratings = new Map();
    const refresh = () => refreshSendAll(card, ratings.size);

    $$('.video-card', card).forEach((vc) => {
      $$('[data-star]', vc).forEach((b) => b.addEventListener('click', () => {
        const rating = Number(b.dataset.star);
        ratings.set(vc.dataset.set, rating);
        $$('[data-star]', vc).forEach((x) => {
          x.classList.toggle('on', Number(x.dataset.star) <= rating);
          x.classList.toggle('changed', Number(x.dataset.star) <= rating);
        });
        refresh();
      }));
    });
    $$('.ex-reply', card).forEach((t) => t.addEventListener('input', refresh));

    // Botón único: manda estrellas y correcciones de todos los ejercicios juntos.
    $('[data-send-all]', card)?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const replies = $$('.ex-reply', card).filter((t) => t.value.trim());
      if (!ratings.size && !replies.length) return;
      btn.disabled = true;
      btn.textContent = 'Enviando…';
      const s = sessions.find((x) => x.id === sessionId);
      try {
        // Lo que se va guardando se saca de la lista: si algo falla, no se duplica al reintentar.
        for (const [setId, rating] of [...ratings]) {
          await db.rateSet(setId, rating);
          s.sets.find((x) => x.id === setId).rating = rating;
          ratings.delete(setId);
        }
        for (const t of replies) {
          s.messages.push(await db.sendMessage(sessionId, me.id, t.value.trim(), t.dataset.ex));
          t.value = '';
        }
        await db.markReviewed(sessionId).catch(() => {});
        touched.add(sessionId);
        updateBadge();
        paintFeed();
        toast('Devolución enviada 🤘', 'ok');
      } catch (err) {
        toast(err.message, 'error');
        refresh();
      }
    });
  });
}

// ------------------------------------------------------------- Alumnos
async function renderStudents() {
  show('v-students');
  $('#students').innerHTML = '<div class="empty">Cargando…</div>';
  try {
    await loadAll();
    $('#students').innerHTML = students.length ? students.map((s) => {
      const r = routines.find((x) => x.student_id === s.id);
      const done = sessions.filter((x) => x.student_id === s.id);
      return `
        <div class="student">
          <div class="avatar">${esc(initials(s.nombre || s.email))}</div>
          <div class="grow">
            <div class="t" style="font:800 15px var(--heavy)">${esc(s.nombre || 'Sin nombre')}</div>
            <div class="em">${esc(s.email)} · ${r ? `Rutina: ${esc(r.title)}` : '<span style="color:var(--red-hot)">Sin rutina</span>'} · ${done.length} entrenamientos</div>
          </div>
          <button class="btn btn-sm" data-edit="${s.id}">${r ? 'Editar rutina' : 'Armar rutina'}</button>
        </div>`;
    }).join('') : '<div class="empty">Todavía no se registró ningún alumno. Pasales el link breakdownfit.com/alumnos.</div>';
    $$('[data-edit]').forEach((b) => b.addEventListener('click', () => openEditor(b.dataset.edit)));
  } catch (err) { $('#students').innerHTML = `<div class="empty">${esc(err.message)}</div>`; }
}

// --------------------------------------------------------------- Editor
let ed = null; // { studentId, title, days }

const tagsToText = (tags = []) => tags.map((t) => (t.startsWith('kg:') ? t.slice(3) : t)).join(', ');
function textToTags(text) {
  return text.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean).map((t) => {
    if (/kg/.test(t) || t.startsWith('+')) return `kg:${t.replace(/\s*kg$/, '').replace(/^\+?\s*/, '+')} kg`;
    if (t.startsWith('pies')) return 'pies';
    if (t.includes('espalda')) return 'espalda';
    const k = Object.keys(TAGS).find((x) => t === x || t === `banda ${x}`);
    return k ?? t;
  });
}
const blankExercise = () => ({ name: '', sets: 3, target: '', rest: 90, tags: [] });
const blankBlock = () => ({ title: 'Bloque principal', exercises: [blankExercise()] });
const blankDay = () => ({ name: 'Día', focus: '', blocks: [blankBlock()] });

function openEditor(studentId) {
  const st = students.find((s) => s.id === studentId);
  const r = routines.find((x) => x.student_id === studentId);
  ed = { studentId, title: r?.title ?? 'Mi rutina', days: structuredClone(r?.data?.days ?? [blankDay()]) };
  $('#ed-title').innerHTML = `Rutina de <span>${esc(st?.nombre || st?.email || 'alumno')}</span>`;
  $('#ed-name').value = ed.title;
  $('#ed-copy').innerHTML = '<option value="">Copiar rutina de otro alumno…</option>' + routines
    .filter((x) => x.student_id !== studentId)
    .map((x) => `<option value="${x.student_id}">${esc(students.find((s) => s.id === x.student_id)?.nombre || 'Alumno')} — ${esc(x.title)}</option>`).join('');
  show('v-editor');
  paintEditor();
}

function paintEditor() {
  $('#ed-days').innerHTML = ed.days.map((d, di) => `
    <div class="day-ed">
      <div class="row2">
        <input data-f="day-name" data-d="${di}" value="${esc(d.name)}" placeholder="Día (ej: Lunes)">
        <input data-f="day-focus" data-d="${di}" value="${esc(d.focus)}" placeholder="Foco (ej: Front Lever)">
        <button type="button" class="x" data-del-day="${di}" title="Borrar día">✕</button>
      </div>
      ${d.blocks.map((b, bi) => `
        <div class="block-ed">
          <div class="row2" style="grid-template-columns:1fr auto">
            <input data-f="block-title" data-d="${di}" data-b="${bi}" value="${esc(b.title)}" placeholder="Bloque (ej: Post calentamiento)">
            <button type="button" class="x" data-del-block="${di}-${bi}" title="Borrar bloque">✕</button>
          </div>
          <div class="ex-labels"><span>Ejercicio</span><span>Series</span><span>Reps / tiempo</span><span>Desc. (s)</span><span>Etiquetas</span><span></span></div>
          ${b.exercises.map((x, xi) => `
            <div class="ex-ed">
              <input data-f="name" data-d="${di}" data-b="${bi}" data-x="${xi}" value="${esc(x.name)}" placeholder="Ejercicio">
              <input data-f="sets" data-d="${di}" data-b="${bi}" data-x="${xi}" value="${esc(x.sets)}" type="number" min="1" max="20" placeholder="Series">
              <input data-f="target" data-d="${di}" data-b="${bi}" data-x="${xi}" value="${esc(x.target)}" placeholder="Ej: 6 reps / máx. hold">
              <input data-f="rest" data-d="${di}" data-b="${bi}" data-x="${xi}" value="${esc(x.rest)}" type="number" min="0" max="900" step="15" placeholder="Desc.">
              <input data-f="tags" data-d="${di}" data-b="${bi}" data-x="${xi}" value="${esc(tagsToText(x.tags))}" placeholder="roja, pies, +5 kg">
              <button type="button" class="x" data-del-ex="${di}-${bi}-${xi}" title="Borrar ejercicio">✕</button>
            </div>`).join('')}
          <button type="button" class="add" data-add-ex="${di}-${bi}">+ Ejercicio</button>
        </div>`).join('')}
      <button type="button" class="add" data-add-block="${di}">+ Bloque</button>
    </div>`).join('');

  $$('#ed-days input').forEach((inp) => inp.addEventListener('input', () => {
    const { f, d, b, x } = inp.dataset;
    const day = ed.days[d];
    if (f === 'day-name') day.name = inp.value;
    else if (f === 'day-focus') day.focus = inp.value;
    else if (f === 'block-title') day.blocks[b].title = inp.value;
    else {
      const ex = day.blocks[b].exercises[x];
      if (f === 'sets' || f === 'rest') ex[f] = Number(inp.value) || 0;
      else if (f === 'tags') ex.tags = textToTags(inp.value);
      else ex[f] = inp.value;
    }
  }));
  const idx = (s) => s.split('-').map(Number);
  $$('[data-del-day]').forEach((b) => b.addEventListener('click', () => { if (confirm('¿Borrar este día?')) { ed.days.splice(Number(b.dataset.delDay), 1); paintEditor(); } }));
  $$('[data-del-block]').forEach((b) => b.addEventListener('click', () => { const [d, bl] = idx(b.dataset.delBlock); ed.days[d].blocks.splice(bl, 1); paintEditor(); }));
  $$('[data-del-ex]').forEach((b) => b.addEventListener('click', () => { const [d, bl, x] = idx(b.dataset.delEx); ed.days[d].blocks[bl].exercises.splice(x, 1); paintEditor(); }));
  $$('[data-add-ex]').forEach((b) => b.addEventListener('click', () => { const [d, bl] = idx(b.dataset.addEx); ed.days[d].blocks[bl].exercises.push(blankExercise()); paintEditor(); }));
  $$('[data-add-block]').forEach((b) => b.addEventListener('click', () => { ed.days[Number(b.dataset.addBlock)].blocks.push(blankBlock()); paintEditor(); }));
}

$('#ed-add-day').addEventListener('click', () => { ed.days.push(blankDay()); paintEditor(); });
$('#ed-name').addEventListener('input', (e) => { ed.title = e.target.value; });
$('#ed-sample').addEventListener('click', () => {
  if (ed.days.some((d) => d.blocks.some((b) => b.exercises.some((x) => x.name))) && !confirm('Esto reemplaza la rutina actual por el ejemplo. ¿Seguir?')) return;
  ed.title = SAMPLE_ROUTINE.title;
  ed.days = structuredClone(SAMPLE_ROUTINE.data.days);
  $('#ed-name').value = ed.title;
  paintEditor();
});
$('#ed-copy').addEventListener('change', (e) => {
  const r = routines.find((x) => x.student_id === e.target.value);
  e.target.value = '';
  if (!r || !confirm(`¿Reemplazar por "${r.title}"?`)) return;
  ed.title = r.title;
  ed.days = structuredClone(r.data.days);
  $('#ed-name').value = ed.title;
  paintEditor();
});

$('#ed-save').addEventListener('click', async () => {
  // Limpia ejercicios sin nombre, bloques y días vacíos.
  const days = ed.days
    .map((d) => ({ ...d, name: d.name.trim() || 'Día', blocks: d.blocks
      .map((b) => ({ ...b, exercises: b.exercises.filter((x) => x.name.trim()).map((x) => ({ ...x, name: x.name.trim(), sets: Math.max(1, x.sets || 1) })) }))
      .filter((b) => b.exercises.length) }))
    .filter((d) => d.blocks.length);
  if (!days.length) { toast('Agregá al menos un ejercicio.', 'error'); return; }
  const btn = $('#ed-save');
  btn.disabled = true;
  try {
    await db.saveRoutine(ed.studentId, ed.title.trim() || 'Mi rutina', { days });
    toast('Rutina guardada. El alumno ya la ve en su portal. 🤘', 'ok');
    renderStudents();
  } catch (err) { toast(err.message, 'error'); }
  finally { btn.disabled = false; }
});

// ------------------------------------------------------------- Arranque
async function boot() {
  if (!db.configured) { show('v-config'); return; }
  const user = await db.currentUser();
  if (!user) { show('v-auth'); return; }
  const profile = await db.getProfile(user.id);
  if (profile?.role !== 'coach') { show('v-denied'); return; }
  me = user;
  $('#nav-user').hidden = false;
  renderFeed();
}
boot().catch((err) => { toast(err.message, 'error'); show('v-auth'); });
