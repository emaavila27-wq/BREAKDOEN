// Acceso a Supabase para el portal de alumnos y el panel del coach.
// Todo pasa por acá: si cambia el proveedor, se cambia este archivo.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const sb = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export const MAX_VIDEO_MB = 50;

function check({ data, error }) {
  if (error) throw new Error(translate(error.message));
  return data;
}

// Mensajes de error de Supabase en castellano.
function translate(msg = '') {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'Mail o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return 'Todavía no confirmaste tu mail. Revisá tu bandeja (y spam).';
  if (m.includes('already registered')) return 'Ese mail ya tiene cuenta. Iniciá sesión.';
  if (m.includes('password should be')) return 'La contraseña tiene que tener al menos 6 caracteres.';
  if (m.includes('exceeded') || m.includes('too large') || m.includes('payload')) return `El video supera los ${MAX_VIDEO_MB} MB. Grabalo más corto o en 720p.`;
  if (m.includes('rate limit')) return 'Demasiados intentos. Esperá un minuto y probá de nuevo.';
  return msg || 'Algo salió mal. Probá de nuevo.';
}

// ---------------------------------------------------------------- Sesión
export async function currentUser() {
  const { data } = await sb.auth.getSession();
  return data.session?.user ?? null;
}
export async function signIn(email, password) {
  return check(await sb.auth.signInWithPassword({ email, password })).user;
}
export async function signUp(email, password, nombre) {
  const data = check(await sb.auth.signUp({
    email, password,
    options: { data: { nombre }, emailRedirectTo: `${location.origin}/alumnos/` },
  }));
  return { user: data.user, needsConfirmation: !data.session };
}
export async function resetPassword(email) {
  check(await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/alumnos/?reset=1` }));
}
export async function updatePassword(password) {
  check(await sb.auth.updateUser({ password }));
}
export async function signOut() {
  await sb.auth.signOut();
}
export function onAuthChange(cb) {
  sb.auth.onAuthStateChange((event, session) => cb(event, session?.user ?? null));
}

// -------------------------------------------------------------- Perfiles
export async function getProfile(id) {
  return check(await sb.from('profiles').select('*').eq('id', id).maybeSingle());
}
export async function listStudents() {
  return check(await sb.from('profiles').select('*').eq('role', 'alumno').order('created_at', { ascending: false }));
}

// --------------------------------------------------------------- Rutinas
export async function getRoutine(studentId) {
  return check(await sb.from('routines').select('*').eq('student_id', studentId).maybeSingle());
}
export async function listRoutines() {
  return check(await sb.from('routines').select('*'));
}
export async function saveRoutine(studentId, title, data) {
  return check(await sb.from('routines')
    .upsert({ student_id: studentId, title, data, updated_at: new Date().toISOString() }, { onConflict: 'student_id' })
    .select().single());
}

// -------------------------------------------------------- Entrenamientos
export async function startSession(studentId, day) {
  return check(await sb.from('sessions')
    .insert({ student_id: studentId, day_name: day.name, day_focus: day.focus || '' })
    .select().single());
}
export async function finishSession(id, sensaciones) {
  return check(await sb.from('sessions')
    .update({ finished_at: new Date().toISOString(), sensaciones })
    .eq('id', id).select().single());
}
export async function discardSession(id) {
  check(await sb.from('sessions').delete().eq('id', id));
}
export async function logSet(log) {
  return check(await sb.from('set_logs').insert(log).select().single());
}
export async function updateSet(id, fields) {
  return check(await sb.from('set_logs').update(fields).eq('id', id).select().single());
}

// Entrenamientos terminados, con series y mensajes (del alumno, o de todos si sos coach).
export async function listSessions({ studentId } = {}) {
  let q = sb.from('sessions').select('*').not('finished_at', 'is', null).order('finished_at', { ascending: false }).limit(60);
  if (studentId) q = q.eq('student_id', studentId);
  const sessions = check(await q);
  if (!sessions.length) return [];
  const ids = sessions.map((s) => s.id);
  const [sets, msgs] = await Promise.all([
    sb.from('set_logs').select('*').in('session_id', ids).order('created_at', { ascending: true }).then(check),
    sb.from('messages').select('*').in('session_id', ids).order('created_at', { ascending: true }).then(check),
  ]);
  return sessions.map((s) => ({
    ...s,
    sets: sets.filter((x) => x.session_id === s.id),
    messages: msgs.filter((m) => m.session_id === s.id),
  }));
}

export async function rateSession(id, rating) {
  return check(await sb.from('sessions')
    .update({ rating, reviewed_at: new Date().toISOString() })
    .eq('id', id).select().single());
}
export async function markSeen(id) {
  check(await sb.from('sessions').update({ student_seen_at: new Date().toISOString() }).eq('id', id));
}
export async function sendMessage(sessionId, authorId, body) {
  return check(await sb.from('messages').insert({ session_id: sessionId, author_id: authorId, body }).select().single());
}

// ---------------------------------------------------------------- Videos
export async function uploadVideo(studentId, sessionId, setId, file) {
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) throw new Error(translate('exceeded'));
  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
  const path = `${studentId}/${sessionId}/${setId}.${ext}`;
  check(await sb.storage.from('videos').upload(path, file, { contentType: file.type || 'video/mp4', upsert: true }));
  return path;
}
export async function videoUrl(path) {
  return check(await sb.storage.from('videos').createSignedUrl(path, 60 * 60)).signedUrl;
}
