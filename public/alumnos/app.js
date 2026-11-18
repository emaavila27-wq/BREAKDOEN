import * as db from '/portal/db.js';
import { $, $$, esc, tagHtml, starsHtml, when, duration, toast, groupSets, videosHtml, exKey, exerciseFeedbackHtml, generalMessagesHtml, sendAllHtml, refreshSendAll } from '/portal/ui.js';
import { compressVideo } from '/portal/compress.js';

const DEFAULT_REST = 90;
const COMPRESS_OVER = 20 * 1024 * 1024; // los videos más pesados se achican antes de subir
const SAVED = 'bd-workout'; // entrenamiento en curso (por si se cierra la pestaña)

let me = null;       // usuario de Supabase
let profile = null;  // fila de profiles
let routine = null;  // fila de routines
let wk = null;       // entrenamiento en curso

// ------------------------------------------------------------- Vistas
function show(id) {
  $$('.view').forEach((v) => { v.hidden = v.id !== id; });
  const training = id === 'v-workout';
  $('#wk-head').hidden = !training;
  $('#finish-bar').hidden = !training;
  const bar = $('.progress');
  if (bar) bar.hidden = !training;
  $('.nav').hidden = training;
  document.body.classList.toggle('training', training);
  window.scrollTo(0, 0);
}
function setMsg(form, text, kind = '') {
  const el = $('.form-msg', form);
  el.textContent = text;
  el.className = `form-msg ${kind}`;
}

// --------------------------------------------------------------- Login
let authMode = 'login';
function setAuthMode(mode) {
  authMode = mode;
  $$('.auth-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === mode));
  $$('[data-only="signup"]').forEach((el) => { el.hidden = mode !== 'signup'; });
  $('#auth-submit').textContent = mode === 'signup' ? 'Crear cuenta' : 'Ingresar';
  $('#f-auth').password.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
  setMsg($('#f-auth'), '');
}
$$('.auth-tabs button').forEach((b) => b.addEventListener('click', () => setAuthMode(b.dataset.tab)));

$('#f-auth').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const email = f.email.value.trim();
  const password = f.password.value;
  const nombre = f.nombre.value.trim();
  if (!email || password.length < 6 || (authMode === 'signup' && nombre.length < 2)) {
    setMsg(f, authMode === 'signup' ? 'Completá nombre, email y una contraseña de 6 caracteres o más.' : 'Completá email y contraseña.', 'error');
    return;
  }
  const btn = $('#auth-submit');
  btn.disabled = true;
  try {
    if (authMode === 'signup') {
      const { needsConfirmation } = await db.signUp(email, password, nombre);
      if (needsConfirmation) {
        setMsg(f, 'Te mandamos un mail para confirmar tu cuenta. Abrilo y después ingresá acá.', 'ok');
        setAuthMode('login');
        f.email.value = email;
        return;
      }
    } else {
      await db.signIn(email, password);
    }
    await boot();
  } catch (err) {
    setMsg(f, err.message, 'error');
  } finally {
    btn.disabled = false;
  }
});

$('#forgot').addEventListener('click', async () => {
  const f = $('#f-auth');
  const email = f.email.value.trim();
  if (!email) { setMsg(f, 'Escribí tu email y tocá de nuevo "Olvidé mi contraseña".', 'error'); return; }
  try {
    await db.resetPassword(email);
    setMsg(f, 'Te mandamos un mail para crear una contraseña nueva.', 'ok');
  } catch (err) { setMsg(f, err.message, 'error'); }
});

$('#f-reset').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.password.value.length < 6) { setMsg(f, 'Mínimo 6 caracteres.', 'error'); return; }
  try {
    await db.updatePassword(f.password.value);
    history.replaceState(null, '', '/alumnos/');
    toast('Contraseña actualizada', 'ok');
    await boot();
  } catch (err) { setMsg(f, err.message, 'error'); }
});

$('#logout').addEventListener('click', async () => {
  await db.signOut();
  me = profile = routine = null;
  $('#nav-user').hidden = true;
  setAuthMode('login');
  show('v-auth');
});

// ---------------------------------------------------------------- Inicio
const dayExercises = (day) => day.blocks.flatMap((b) => b.exercises.map((ex) => ({ ...ex, block: b.title })));

async function renderHome() {
  show('v-home');
  const first = (profile?.nombre || me.email).split(' ')[0];
  $('#hello').innerHTML = `Hola, <span>${esc(first)}</span>`;
  const days = routine?.data?.days ?? [];
  $('#routine-title').textContent = days.length ? routine.title : '';

  const saved = loadSaved();
  $('#resume').innerHTML = saved ? `
    <div class="panel" style="border-color:var(--red)">
      <h3>Tenés un entrenamiento sin terminar</h3>
      <p class="p-sub" style="margin-bottom:12px">${esc(saved.day.name)} · ${esc(saved.day.focus || '')}</p>
      <button class="btn" id="resume-btn">Continuar</button>
      <button class="link-btn" id="discard-btn" style="margin-left:12px">Descartar</button>
    </div>` : '';
  if (saved) {
    $('#resume-btn').onclick = () => openWorkout(saved);
    $('#discard-btn').onclick = async () => {
      if (!confirm('¿Descartar el entrenamiento sin terminar?')) return;
      await db.discardSession(saved.sessionId).catch(() => {});
      clearSaved();
      renderHome();
    };
  }

  $('#days').innerHTML = days.length ? days.map((d, i) => {
    const exs = dayExercises(d);
    const sets = exs.reduce((n, ex) => n + (Number(ex.sets) || 0), 0);
    return `
      <article class="day-card">
        <div class="grow">
          <div class="d-name">${esc(d.name)}</div>
          <div class="d-focus">${esc(d.focus || '')}</div>
          <div class="d-meta">${exs.length} ejercicios · ${sets} series</div>
        </div>
        <button class="btn btn-sm" data-start="${i}" ${saved ? 'disabled' : ''}>Iniciar</button>
      </article>`;
  }).join('') : '<div class="empty">Tu coach todavía no cargó tu rutina. Te avisamos cuando esté lista. 🤘</div>';
  $$('[data-start]').forEach((b) => b.addEventListener('click', () => startWorkout(days[Number(b.dataset.start)])));

  renderHistory();
}

async function renderHistory() {
  const box = $('#history');
  box.innerHTML = '<div class="empty">Cargando…</div>';
  try {
    const sessions = await db.listSessions({ studentId: me.id });
    if (!sessions.length) { box.innerHTML = '<div class="empty">Todavía no terminaste ningún entrenamiento.</div>'; return; }
    box.innerHTML = sessions.map(sessionHtml).join('');
    wireSessions(box, sessions);
    // En cada día de la rutina, avisa si tiene correcciones pendientes de la vez anterior.
    (routine?.data?.days ?? []).forEach((d, i) => {
      const n = Object.values(lastNotesFrom(sessions, d.name).notes).flat().length;
      const meta = $(`[data-start="${i}"]`)?.closest('.day-card')?.querySelector('.d-meta');
      if (n && meta) meta.insertAdjacentHTML('afterend', `<div class="d-notes">📝 ${n} ${n === 1 ? 'corrección' : 'correcciones'} de tu coach</div>`);
    });
  } catch (err) {
    box.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}

function unread(s) {
  const seen = s.student_seen_at ? new Date(s.student_seen_at) : null;
  const coachNews = [s.reviewed_at, ...s.messages.filter((m) => m.author_id !== me.id).map((m) => m.created_at)].filter(Boolean);
  return coachNews.some((t) => !seen || new Date(t) > seen);
}

function sessionHtml(s) {
  const names = (id) => (id === me.id ? 'Vos' : 'Coach');
  return `
    <article class="sess${unread(s) ? ' unread' : ''}" data-id="${s.id}">
      <div class="sess-head">
        <div class="grow">
          <div class="t">${esc(s.day_name)} · ${esc(s.day_focus)}</div>
          <div class="m">${when(s.finished_at)} · ${duration(s.started_at, s.finished_at)} · ${s.sets.length} series</div>
        </div>
        ${ratingSummary(s)}
      </div>
      <div class="sess-body">
        ${s.sensaciones ? `<div class="feel"><b>Mis sensaciones</b>${esc(s.sensaciones)}</div>` : ''}
        ${groupSets(s.sets).map((g) => `
          <div class="ex-sum">
            <div class="name">${esc(g.exercise)}</div>
            <div class="reps">${g.sets.map((x) => `S${x.set_number}: ${esc(x.reps || '✓')}`).join(' · ')}</div>
            ${videosHtml(g.sets)}
            ${exerciseFeedbackHtml(s, exKey(g), me.id, names, 'Preguntale a tu coach sobre este ejercicio…')}
          </div>`).join('')}
        ${generalMessagesHtml(s, me.id, names)}
        ${sendAllHtml(s, 'Enviar respuestas')}
      </div>
    </article>`;
}

// Promedio de estrellas de los videos calificados (o el estado de revisión).
function ratingSummary(s) {
  const rated = s.sets.filter((x) => x.video_path && x.rating);
  if (rated.length) {
    const avg = rated.reduce((n, x) => n + x.rating, 0) / rated.length;
    return `<span class="m" style="text-align:right">${starsHtml(Math.round(avg))}<br>${avg.toFixed(1).replace('.', ',')} promedio</span>`;
  }
  return `<span class="m">${s.sets.some((x) => x.video_path) ? 'Videos sin calificar' : ''}</span>`;
}

// Los videos se cargan recién cuando los tocan (link firmado temporal).
function wireVideos(root) {
  $$('[data-video]', root).forEach((slot) => slot.addEventListener('click', async () => {
    slot.textContent = 'Cargando…';
    try {
      const url = await db.videoUrl(slot.dataset.video);
      const v = document.createElement('video');
      v.src = url; v.controls = true; v.playsInline = true; v.autoplay = true;
      slot.replaceWith(v);
    } catch (err) { slot.textContent = err.message; }
  }, { once: true }));
}

function wireSessions(root, sessions) {
  wireVideos(root);
  $$('.sess', root).forEach((card) => {
    $$('.ex-reply', card).forEach((t) => t.addEventListener('input', () => refreshSendAll(card)));
    // Botón único: manda las respuestas de todos los ejercicios juntas.
    $('[data-send-all]', card)?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const replies = $$('.ex-reply', card).filter((t) => t.value.trim());
      if (!replies.length) return;
      btn.disabled = true;
      btn.textContent = 'Enviando…';
      try {
        for (const t of replies) {
          await db.sendMessage(card.dataset.id, me.id, t.value.trim(), t.dataset.ex);
          t.value = '';
        }
        toast('Respuestas enviadas a tu coach', 'ok');
        renderHistory();
      } catch (err) {
        toast(err.message, 'error');
        refreshSendAll(card);
      }
    });
  });
  // Marca como vistas las novedades del coach.
  sessions.filter(unread).forEach((s) => db.markSeen(s.id).catch(() => {}));
}

// ------------------------------------------------------- Entrenamiento
function loadSaved() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVED) || 'null');
    return s && s.userId === me.id ? s : null;
  } catch { return null; }
}
function persist() {
  try { localStorage.setItem(SAVED, JSON.stringify(wk)); } catch { /* sin almacenamiento local */ }
}
function clearSaved() {
  try { localStorage.removeItem(SAVED); } catch { /* sin almacenamiento local */ }
}

// Correcciones del coach del último entrenamiento de ese mismo día que las tenga:
// { notes: { "bloque|ejercicio": ["texto", …] }, date }.
function lastNotesFrom(sessions, dayName) {
  for (const s of sessions) {
    if (s.day_name !== dayName) continue;
    const notes = {};
    for (const m of s.messages) {
      if (m.exercise && m.author_id !== me.id) (notes[m.exercise] ??= []).push(m.body);
    }
    if (Object.keys(notes).length) return { notes, date: s.finished_at };
  }
  return { notes: {}, date: null };
}

async function startWorkout(day) {
  try {
    const previous = await db.listSessions({ studentId: me.id }).then((ss) => lastNotesFrom(ss, day.name)).catch(() => ({ notes: {}, date: null }));
    const session = await db.startSession(me.id, day);
    openWorkout({ userId: me.id, sessionId: session.id, day, startedAt: session.started_at, current: 0, logs: {}, notes: previous.notes, notesDate: previous.date });
  } catch (err) { toast(err.message, 'error'); }
}

const shortDate = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
function coachNoteHtml(ex) {
  const notes = wk.notes?.[`${ex.block}|${ex.name}`];
  if (!notes?.length) return '';
  const when = wk.notesDate ? ` (${shortDate.format(new Date(wk.notesDate))})` : '';
  return `<div class="coach-note"><b>📝 Tu coach te corrigió${esc(when)}</b>${notes.map((n) => `<span>${esc(n)}</span>`).join('')}</div>`;
}

let clockTimer;
let wakeLock;
function openWorkout(state) {
  wk = state;
  persist();
  show('v-workout');
  $('#wk-title').textContent = `${wk.day.name} · ${wk.day.focus || ''}`;
  clearInterval(clockTimer);
  const tick = () => {
    const s = Math.floor((Date.now() - new Date(wk.startedAt)) / 1000);
    $('#wk-clock').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };
  tick();
  clockTimer = setInterval(tick, 1000);
  navigator.wakeLock?.request('screen').then((l) => { wakeLock = l; }).catch(() => {});
  renderExercises();
}

const key = (i, n) => `${i}-${n}`;

function renderExercises() {
  const exs = dayExercises(wk.day);
  let lastBlock = '';
  $('#exercises').innerHTML = exs.map((ex, i) => {
    const sets = Math.max(1, Number(ex.sets) || 1);
    const doneCount = Array.from({ length: sets }, (_, n) => wk.logs[key(i, n + 1)]).filter(Boolean).length;
    const header = ex.block !== lastBlock ? `<div class="ex-block" style="margin:18px 0 8px">${esc(ex.block)}</div>` : '';
    lastBlock = ex.block;
    return `${header}
      <article class="ex${i === wk.current ? ' current' : ''}${doneCount === sets ? ' done' : ''}" data-ex="${i}">
        <div class="ex-head">
          <div class="ex-num">${i + 1}</div>
          <div class="grow">
            <div class="ex-name">${esc(ex.name)}</div>
            <div class="ex-meta">${sets} × ${esc(ex.target || '')} · descanso ${restOf(ex)} s · ${doneCount}/${sets}</div>
            <div>${(ex.tags || []).map(tagHtml).join('')}</div>
            ${coachNoteHtml(ex)}
          </div>
        </div>
        <div class="ex-body">
          <div class="sets">${Array.from({ length: sets }, (_, n) => setRowHtml(i, n + 1, ex)).join('')}</div>
        </div>
      </article>`;
  }).join('');

  $$('.ex-head').forEach((h) => h.addEventListener('click', () => {
    wk.current = Number(h.parentElement.dataset.ex);
    persist();
    renderExercises();
    h.parentElement.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }));
  $$('[data-done]').forEach((b) => b.addEventListener('click', () => completeSet(b)));
  $$('[data-vid]').forEach((b) => b.addEventListener('click', () => pickVideo(b)));
  $$('[data-reps]').forEach((inp) => inp.addEventListener('change', () => saveReps(inp)));
  updateProgress();
  paintUploads();
}

const restOf = (ex) => Number(ex.rest) || DEFAULT_REST;

function setRowHtml(i, n, ex) {
  const log = wk.logs[key(i, n)];
  return `
    <div class="set-row${log ? ' done' : ''}">
      <div class="n">S${n}</div>
      <input data-reps="${i}-${n}" value="${esc(log?.reps ?? '')}" placeholder="${esc(ex.target || 'reps')}" inputmode="text" aria-label="Repeticiones serie ${n}">
      <button class="icon-btn${log?.video_path ? ' has-video' : ''}" data-vid="${i}-${n}" aria-label="Subir video de la serie ${n}">${log?.video_path ? '🎥 ✓' : '🎥'}</button>
      <button class="icon-btn${log ? '' : ' ok'}" data-done="${i}-${n}">${log ? '✓' : 'Hecha'}</button>
    </div>`;
}

function updateProgress() {
  const exs = dayExercises(wk.day);
  const total = exs.reduce((n, ex) => n + Math.max(1, Number(ex.sets) || 1), 0);
  const done = Object.keys(wk.logs).length;
  let bar = $('#wk-progress');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'progress';
    bar.innerHTML = '<div id="wk-progress"></div>';
    $('#wk-head').after(bar);
    bar = $('#wk-progress');
  }
  bar.style.width = `${Math.round((done / total) * 100)}%`;
  bar.parentElement.hidden = $('#wk-head').hidden;
}

// Guarda la serie en la base (si todavía no estaba guardada).
async function ensureLog(i, n) {
  const k = key(i, n);
  if (wk.logs[k]) return wk.logs[k];
  const ex = dayExercises(wk.day)[i];
  const reps = $(`[data-reps="${k}"]`)?.value.trim() ?? '';
  const row = await db.logSet({ session_id: wk.sessionId, student_id: me.id, block_title: ex.block, exercise: ex.name, set_number: n, reps });
  wk.logs[k] = { id: row.id, reps, video_path: null };
  persist();
  return wk.logs[k];
}

async function completeSet(btn) {
  const [i, n] = btn.dataset.done.split('-').map(Number);
  if (wk.logs[key(i, n)]) return;
  btn.disabled = true;
  try {
    await ensureLog(i, n);
  } catch (err) {
    btn.disabled = false;
    toast(err.message, 'error');
    return;
  }
  const exs = dayExercises(wk.day);
  const ex = exs[i];
  const sets = Math.max(1, Number(ex.sets) || 1);
  const exDone = Array.from({ length: sets }, (_, m) => wk.logs[key(i, m + 1)]).every(Boolean);
  // Próximo paso: siguiente serie, o primer ejercicio que tenga series pendientes.
  let next = null;
  if (!exDone) next = { ex, set: n + 1 <= sets && !wk.logs[key(i, n + 1)] ? n + 1 : null };
  else {
    const j = exs.findIndex((e, idx) => idx !== i && Array.from({ length: Math.max(1, Number(e.sets) || 1) }, (_, m) => wk.logs[key(idx, m + 1)]).some((l) => !l));
    if (j !== -1) { wk.current = j; next = { ex: exs[j], set: 1 }; }
  }
  persist();
  renderExercises();
  if (next) startRest(restOf(ex), next);
  else toast('¡Terminaste todas las series! Tocá "Terminar entrenamiento". 🤘', 'ok');
}

async function saveReps(inp) {
  const [i, n] = inp.dataset.reps.split('-').map(Number);
  const log = wk.logs[key(i, n)];
  if (!log) return;
  try {
    await db.updateSet(log.id, { reps: inp.value.trim() });
    log.reps = inp.value.trim();
    persist();
  } catch (err) { toast(err.message, 'error'); }
}

let videoTarget = null;
function pickVideo(btn) {
  videoTarget = btn;
  const input = $('#video-input');
  input.value = '';
  input.click();
}
$('#video-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const btn = videoTarget;
  if (!file || !btn) return;
  const [i, n] = btn.dataset.vid.split('-').map(Number);
  btn.disabled = true;
  try {
    const log = await ensureLog(i, n);
    enqueueVideo({ k: key(i, n), sessionId: wk.sessionId, log, file });
  } catch (err) {
    toast(err.message, 'error');
  }
  renderExercises();
});

// ------------------------------------------- Videos en segundo plano
// Los videos se achican y suben de a uno, sin bloquear la pantalla: el alumno
// sigue entrenando (o navegando el portal) mientras tanto.
const uploads = [];          // { k, sessionId, log, file, phase, progress }
let uploading = false;

function uploadJob(sessionId, k) {
  return uploads.find((u) => u.sessionId === sessionId && u.k === k);
}

function enqueueVideo(job) {
  uploads.push({ ...job, phase: 'wait', progress: 0 });
  paintUploads();
  if (!uploading) runUploads();
}

async function runUploads() {
  uploading = true;
  if (!wakeLock) navigator.wakeLock?.request('screen').then((l) => { wakeLock = l; }).catch(() => {});
  while (uploads.length) {
    const job = uploads[0];
    try {
      let file = job.file;
      if (file.size > COMPRESS_OVER) {
        job.phase = 'compress';
        paintUploads();
        file = await compressVideo(file, (p) => { job.progress = p; paintUploads(); });
      }
      job.phase = 'upload';
      paintUploads();
      const path = await db.uploadVideo(me.id, job.sessionId, job.log.id, file);
      await db.updateSet(job.log.id, { video_path: path });
      job.log.video_path = path;
      // Si el entrenamiento sigue abierto, que quede guardado que la serie tiene video.
      if (wk?.sessionId === job.sessionId && wk.logs[job.k]) { wk.logs[job.k].video_path = path; persist(); }
      toast('Video subido ✓', 'ok');
    } catch (err) {
      toast(`No se pudo subir el video: ${err.message}`, 'error');
    }
    uploads.shift();
    if (wk?.sessionId === job.sessionId && !$('#v-workout').hidden) renderExercises();
    paintUploads();
  }
  uploading = false;
  if (!wk) releaseWakeLock();
}

function paintUploads() {
  const box = $('#uploads');
  box.hidden = !uploads.length;
  if (!uploads.length) return;
  const job = uploads[0];
  const more = uploads.length > 1 ? ` · ${uploads.length - 1} en espera` : '';
  const mb = Math.round(job.file.size / 1048576);
  $('#up-title').textContent = job.phase === 'compress'
    ? `🎥 Achicando video (${mb} MB) · ${Math.round(job.progress * 100)}%${more}`
    : job.phase === 'upload' ? `🎥 Subiendo video…${more}` : `🎥 Video en espera${more}`;
  const bar = $('#up-bar');
  bar.classList.toggle('indeterminate', job.phase !== 'compress');
  bar.style.width = `${Math.round(job.progress * 100)}%`;
  // En la fila de la serie, mostrar que su video se está procesando.
  for (const u of uploads) {
    const btn = wk?.sessionId === u.sessionId ? $(`[data-vid="${u.k}"]`) : null;
    if (!btn) continue;
    btn.disabled = true;
    btn.classList.add('uploading');
    btn.textContent = u === job && u.phase === 'compress' ? `${Math.round(u.progress * 100)}%` : '⏳';
  }
}

// La pantalla queda prendida mientras se entrena o se procesan videos.
function releaseWakeLock() {
  if (uploads.length) return;
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}

// Avisar si quiere cerrar la página con videos sin subir.
addEventListener('beforeunload', (e) => {
  if (uploads.length) { e.preventDefault(); e.returnValue = ''; }
});

// --------------------------------------------------- Contador de descanso
const rest = { end: 0, total: 0, timer: null };
const ARC = 282.74;
function startRest(seconds, next) {
  rest.total = seconds;
  rest.end = Date.now() + seconds * 1000;
  $('#rest').hidden = false;
  $('#rest').classList.remove('finished');
  $('#rest-label').textContent = 'Descanso';
  $('#rest-next').innerHTML = next?.ex ? `Sigue: <b>${esc(next.ex.name)}</b>${next.set ? ` · serie ${next.set}` : ''}` : '';
  unlockAudio();
  clearInterval(rest.timer);
  rest.timer = setInterval(restTick, 250);
  restTick();
}
function restTick() {
  const left = Math.max(0, Math.ceil((rest.end - Date.now()) / 1000));
  $('#rest-time').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  $('#rest-arc').style.strokeDashoffset = String(ARC * (1 - left / Math.max(1, rest.total)));
  if (left === 0) {
    clearInterval(rest.timer);
    $('#rest').classList.add('finished');
    $('#rest-label').textContent = '¡A la próxima serie!';
    beep();
    navigator.vibrate?.([300, 120, 300]);
    setTimeout(closeRest, 2500);
  }
}
function closeRest() {
  clearInterval(rest.timer);
  $('#rest').hidden = true;
}
$('#rest-plus').addEventListener('click', () => { rest.end += 15000; rest.total += 15; restTick(); });
$('#rest-minus').addEventListener('click', () => { rest.end -= 15000; restTick(); });
$('#rest-skip').addEventListener('click', closeRest);

let audio;
function unlockAudio() {
  try { audio ??= new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch { audio = null; }
}
function beep() {
  if (!audio) return;
  [0, 0.25, 0.5].forEach((t, k) => {
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = k === 2 ? 1320 : 880;
    g.gain.setValueAtTime(0.0001, audio.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.4, audio.currentTime + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + t + 0.2);
    o.connect(g).connect(audio.destination);
    o.start(audio.currentTime + t);
    o.stop(audio.currentTime + t + 0.22);
  });
}

// ------------------------------------------------------------ Terminar
$('#go-finish').addEventListener('click', () => {
  const done = Object.keys(wk.logs).length;
  if (!done && !confirm('No marcaste ninguna serie. ¿Terminar igual?')) return;
  closeRest();
  show('v-finish');
  $('#finish-sum').textContent = `${wk.day.name} · ${done} series hechas · ${$('#wk-clock').textContent} de entrenamiento`
    + (uploads.length ? ' · Tus videos se siguen subiendo, podés enviar igual.' : '');
});
$('#back-to-workout').addEventListener('click', () => { show('v-workout'); updateProgress(); });
$('#wk-exit').addEventListener('click', () => {
  // El progreso queda guardado: se puede continuar desde el inicio.
  clearInterval(clockTimer);
  closeRest();
  releaseWakeLock();
  renderHome();
});

$('#f-finish').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const btn = $('button[type=submit]', f);
  btn.disabled = true;
  try {
    await db.finishSession(wk.sessionId, f.sensaciones.value.trim());
    clearSaved();
    clearInterval(clockTimer);
    releaseWakeLock();
    wk = null;
    f.reset();
    toast('¡Entrenamiento enviado a tu coach! 🔥', 'ok');
    renderHome();
  } catch (err) {
    setMsg(f, err.message, 'error');
  } finally {
    btn.disabled = false;
  }
});

// ------------------------------------------------------------- Arranque
async function boot() {
  if (!db.configured) { show('v-config'); return; }
  me = await db.currentUser();
  if (!me) { show('v-auth'); return; }
  if (new URLSearchParams(location.search).get('reset')) { show('v-reset'); return; }
  profile = await db.getProfile(me.id);
  if (profile?.role === 'coach') { location.href = '/coach/'; return; }
  routine = await db.getRoutine(me.id);
  $('#who').textContent = profile?.nombre || me.email;
  $('#nav-user').hidden = false;
  const saved = loadSaved();
  if (saved) openWorkout(saved);
  else renderHome();
}

if (db.configured) {
  db.onAuthChange((event) => { if (event === 'PASSWORD_RECOVERY') show('v-reset'); });
}
boot().catch((err) => { toast(err.message, 'error'); show('v-auth'); });
