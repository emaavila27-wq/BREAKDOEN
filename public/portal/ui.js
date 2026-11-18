// Piezas de interfaz compartidas entre el portal del alumno y el panel del coach.

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Etiquetas de los ejercicios (bandas, pies elevados, lastre).
export const TAGS = {
  roja: 'Banda roja',
  amarilla: 'Banda amarilla',
  banda: 'Banda',
  espalda: 'Banda en la espalda',
  pies: 'Pies elevados',
};
export function tagHtml(t) {
  if (t.startsWith('kg:')) return `<span class="ptag kg">${esc(t.slice(3))}</span>`;
  return `<span class="ptag ${esc(t)}">${esc(TAGS[t] ?? t)}</span>`;
}

export function starsHtml(rating, { interactive = false } = {}) {
  return `<span class="stars${interactive ? ' interactive' : ''}" role="${interactive ? 'radiogroup' : 'img'}" aria-label="${rating || 0} de 5 estrellas">${
    [1, 2, 3, 4, 5].map((n) => interactive
      ? `<button type="button" data-star="${n}" class="${n <= (rating || 0) ? 'on' : ''}" aria-label="${n} estrella${n > 1 ? 's' : ''}">★</button>`
      : `<span class="${n <= (rating || 0) ? 'on' : ''}">★</span>`).join('')
  }</span>`;
}

const fmtDate = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const when = (iso) => fmtDate.format(new Date(iso));
export function duration(a, b) {
  const min = Math.max(1, Math.round((new Date(b) - new Date(a)) / 60000));
  return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`;
}
export const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

let toastTimer;
export function toast(text, kind = '') {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = text;
  el.className = `show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 3500);
}

// Series agrupadas por ejercicio para mostrarlas en el historial y en el panel.
export function groupSets(sets) {
  const groups = [];
  for (const s of sets) {
    const last = groups[groups.length - 1];
    if (last && last.exercise === s.exercise && last.block === s.block_title) last.sets.push(s);
    else groups.push({ exercise: s.exercise, block: s.block_title, sets: [s] });
  }
  return groups;
}

// Videos de un ejercicio, cada uno con sus estrellas (el coach las puede tocar).
export function videosHtml(sets, { interactive = false } = {}) {
  const withVideo = sets.filter((x) => x.video_path);
  if (!withVideo.length) return '';
  return `<div class="videos">${withVideo.map((x) => `
    <div class="video-card" data-set="${esc(x.id)}">
      <button type="button" class="video-slot" data-video="${esc(x.video_path)}">▶ Serie ${x.set_number}</button>
      <div class="video-rate">${x.rating || interactive ? starsHtml(x.rating, { interactive }) : '<span class="pending-rate">Sin calificar</span>'}</div>
    </div>`).join('')}</div>`;
}

// ¿El entrenamiento tiene algo que el coach no revisó? (videos sin estrellas, o sin respuesta si no hay videos)
export function needsReview(s, coachIds = []) {
  const videos = s.sets.filter((x) => x.video_path);
  if (videos.length) return videos.some((x) => !x.rating);
  return !s.reviewed_at && !s.messages.some((m) => coachIds.includes(m.author_id));
}

// Conversación de correcciones (burbujas tipo chat).
export function threadHtml(messages, meId, names) {
  if (!messages.length) return '';
  return `<div class="thread">${messages.map((m) => `<div class="bubble ${m.author_id === meId ? 'me' : 'them'}"><span class="who">${esc(names(m.author_id))} · ${when(m.created_at)}</span><span class="text">${esc(m.body)}</span></div>`).join('')}</div>`;
}
