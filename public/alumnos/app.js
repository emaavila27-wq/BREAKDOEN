import * as db from '/portal/db.js';
import { $, $$, esc, tagHtml, starsHtml, when, duration, toast, groupSets, threadHtml } from '/portal/ui.js';

const DEFAULT_REST = 90;
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
        ${s.rating ? starsHtml(s.rating) : '<span class="m">Sin calificar</span>'}
      </div>
      <div class="sess-body">
        ${groupSets(s.sets).map((g) => `
          <div class="ex-sum">
            <div class="name">${esc(g.exercise)}</div>
            <div class="reps">${g.sets.map((x) => `S${x.set_number}: ${esc(x.reps || '✓')}`).join(' · ')}</div>
            ${videosHtml(g.sets)}
          </div>`).join('')}
        ${s.sensaciones ? `<div class="feel"><b>Mis sensaciones</b>${esc(s.sensaciones)}</div>` : ''}
        ${threadHtml(s.messages, me.id, names)}
        <form class="reply" data-reply="${s.id}">
          <textarea name="body" rows="1" maxlength="2000" placeholder="Responderle a tu coach…"></textarea>
          <button class="icon-btn ok" type="submit">Enviar</button>
        </form>
      </div>
    </article>`;
}

function videosHtml(sets) {
  const withVideo = sets.filter((x) => x.video_path);
  if (!withVideo.length) return '';
  return `<div class="videos">${withVideo.map((x) => `<button type="button" class="video-slot" data-video="${esc(x.video_path)}">▶ Serie ${x.set_number}</button>`).join('')}</div>`;
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
  $$('[data-reply]', root).forEach((form) => form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = form.body.value.trim();
    if (!body) return;
    try {
      await db.sendMessage(form.dataset.reply, me.id, body);
      toast('Mensaje enviado', 'ok');
      renderHistory();
    } catch (err) { toast(err.message, 'error'); }
  }));
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

async function startWorkout(day) {
  try {
    const session = await db.startSession(me.id, day);
    openWorkout({ userId: me.id, sessionId: session.id, day, startedAt: session.started_at, current: 0, logs: {} });
  } catch (err) { toast(err.message, 'error'); }
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
  btn.textContent = 'Subiendo…';
  try {
    const log = await ensureLog(i, n);
    const path = await db.uploadVideo(me.id, wk.sessionId, log.id, file);
    await db.updateSet(log.id, { video_path: path });
    log.video_path = path;
    persist();
    toast('Video subido', 'ok');
  } catch (err) {
    toast(err.message, 'error');
  }
  renderExercises();
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
  $('#finish-sum').textContent = `${wk.day.name} · ${done} series hechas · ${$('#wk-clock').textContent} de entrenamiento`;
});
$('#back-to-workout').addEventListener('click', () => { show('v-workout'); updateProgress(); });
$('#wk-exit').addEventListener('click', () => {
  // El progreso queda guardado: se puede continuar desde el inicio.
  clearInterval(clockTimer);
  closeRest();
  wakeLock?.release().catch(() => {});
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
    wakeLock?.release().catch(() => {});
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
