import * as db from '/portal/db.js';
import { $, $$, esc, starsHtml, when, duration, toast, groupSets, threadHtml, initials, TAGS } from '/portal/ui.js';
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
  const pending = sessions.filter((s) => !s.rating).length;
  $('#pending-badge').hidden = !pending;
  $('#pending-badge').textContent = pending;
  $('#student-filter').innerHTML = '<option value="">Todos los alumnos</option>' +
    students.map((s) => `<option value="${s.id}"${s.id === studentFilter ? ' selected' : ''}>${esc(s.nombre || s.email)}</option>`).join('');
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
    .filter((s) => filter === 'all' || !s.rating || touched.has(s.id))
    .filter((s) => !studentFilter || s.student_id === studentFilter);
  $('#feed').innerHTML = list.length ? list.map(cardHtml).join('')
    : `<div class="empty">${filter === 'pending' ? 'No hay entrenamientos sin calificar. 🤘' : 'Todavía no hay entrenamientos.'}</div>`;
  wireCards();
}

function cardHtml(s) {
  const st = students.find((x) => x.id === s.student_id);
  const name = st?.nombre || st?.email || 'Alumno';
  return `
    <article class="sess${s.rating ? '' : ' unread'}" data-id="${s.id}">
      <div class="sess-head">
        <div class="avatar">${esc(initials(name))}</div>
        <div class="grow">
          <div class="t">${esc(name)} · ${esc(s.day_name)}</div>
          <div class="m">${esc(s.day_focus)} · ${when(s.finished_at)} · ${duration(s.started_at, s.finished_at)} · ${s.sets.length} series</div>
        </div>
      </div>
      <div class="sess-body">
        ${s.sets.length ? groupSets(s.sets).map((g) => `
          <div class="ex-sum">
            <div class="name">${esc(g.exercise)} <span class="m" style="font-weight:400;color:var(--muted)">· ${esc(g.block)}</span></div>
            <div class="reps">${g.sets.map((x) => `S${x.set_number}: ${esc(x.reps || '✓')}`).join(' · ')}</div>
            ${g.sets.some((x) => x.video_path) ? `<div class="videos">${g.sets.filter((x) => x.video_path).map((x) => `<button type="button" class="video-slot" data-video="${esc(x.video_path)}">▶ Serie ${x.set_number}</button>`).join('')}</div>` : ''}
          </div>`).join('') : '<div class="m" style="color:var(--muted)">No marcó series.</div>'}
        ${s.sensaciones ? `<div class="feel"><b>Sensaciones</b>${esc(s.sensaciones)}</div>` : ''}
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <span style="font:800 11px var(--heavy);letter-spacing:.2em;text-transform:uppercase;color:var(--muted)">Calificación</span>
          ${starsHtml(s.rating, { interactive: true })}
        </div>
        ${threadHtml(s.messages, me.id, nameOf)}
        <form class="reply" data-reply="${s.id}">
          <textarea name="body" rows="2" maxlength="2000" placeholder="Escribí una corrección…"></textarea>
          <button class="icon-btn ok" type="submit">Enviar</button>
        </form>
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
    const id = card.dataset.id;
    $$('[data-star]', card).forEach((b) => b.addEventListener('click', async () => {
      const rating = Number(b.dataset.star);
      try {
        await db.rateSession(id, rating);
        const s = sessions.find((x) => x.id === id);
        s.rating = rating;
        touched.add(id);
        $$('[data-star]', card).forEach((x) => x.classList.toggle('on', Number(x.dataset.star) <= rating));
        card.classList.remove('unread');
        const pending = sessions.filter((x) => !x.rating).length;
        $('#pending-badge').hidden = !pending;
        $('#pending-badge').textContent = pending;
        toast(`Calificado con ${rating} ${rating === 1 ? 'estrella' : 'estrellas'}`, 'ok');
      } catch (err) { toast(err.message, 'error'); }
    }));
  });

  $$('[data-reply]').forEach((form) => form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = form.body.value.trim();
    if (!body) return;
    const btn = $('button', form);
    btn.disabled = true;
    try {
      const msg = await db.sendMessage(form.dataset.reply, me.id, body);
      sessions.find((x) => x.id === form.dataset.reply).messages.push(msg);
      touched.add(form.dataset.reply);
      paintFeed();
      toast('Corrección enviada', 'ok');
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  }));
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
