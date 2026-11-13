-- Portal de alumnos BREAKDOWN — base de datos en Supabase.
-- Se corre una sola vez en Supabase → SQL Editor → New query → pegar todo → Run.
-- Es seguro volver a correrlo: no borra datos.

-- ⚠️ Mail del coach: la cuenta que se registre con este mail entra al panel /coach.
create or replace function public.coach_email() returns text
language sql immutable as $$ select 'emanuelnoguera750@gmail.com' $$;

-- ---------------------------------------------------------------- Tablas

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  nombre text not null default '',
  role text not null default 'alumno' check (role in ('alumno', 'coach')),
  created_at timestamptz not null default now()
);

-- Rutina de cada alumno. `data` = { days: [ { name, focus, blocks: [ { title, exercises: [
--   { name, sets, target, rest, tags } ] } ] } ] }
create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles on delete cascade,
  title text not null default 'Mi rutina',
  data jsonb not null default '{"days": []}',
  updated_at timestamptz not null default now()
);
create unique index if not exists routines_one_per_student on public.routines (student_id);

-- Cada entrenamiento que el alumno inicia.
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles on delete cascade,
  day_name text not null,
  day_focus text not null default '',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  sensaciones text not null default '',
  rating int check (rating between 1 and 5),
  reviewed_at timestamptz,
  student_seen_at timestamptz
);
create index if not exists sessions_student on public.sessions (student_id, started_at desc);

-- Cada serie hecha dentro de un entrenamiento.
create table if not exists public.set_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions on delete cascade,
  student_id uuid not null references public.profiles on delete cascade,
  block_title text not null default '',
  exercise text not null,
  set_number int not null,
  reps text not null default '',
  video_path text,
  created_at timestamptz not null default now()
);
create index if not exists set_logs_session on public.set_logs (session_id, created_at);

-- Chat de correcciones de cada entrenamiento (coach ↔ alumno).
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions on delete cascade,
  author_id uuid not null references public.profiles on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists messages_session on public.messages (session_id, created_at);

-- ------------------------------------------------- Perfil al registrarse

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nombre, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    case when lower(new.email) = lower(public.coach_email()) then 'coach' else 'alumno' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'coach')
$$;

-- --------------------------------------------- Permisos (Row Level Security)
-- Cada alumno ve solo lo suyo; el coach ve todo.

alter table public.profiles enable row level security;
alter table public.routines enable row level security;
alter table public.sessions enable row level security;
alter table public.set_logs enable row level security;
alter table public.messages enable row level security;

drop policy if exists "perfil propio o coach" on public.profiles;
create policy "perfil propio o coach" on public.profiles for select
  using (id = auth.uid() or public.is_coach());
drop policy if exists "editar nombre propio" on public.profiles;
create policy "editar nombre propio" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

drop policy if exists "rutina propia o coach" on public.routines;
create policy "rutina propia o coach" on public.routines for select
  using (student_id = auth.uid() or public.is_coach());
drop policy if exists "coach escribe rutinas" on public.routines;
create policy "coach escribe rutinas" on public.routines for all
  using (public.is_coach()) with check (public.is_coach());

drop policy if exists "sesiones propias o coach" on public.sessions;
create policy "sesiones propias o coach" on public.sessions for select
  using (student_id = auth.uid() or public.is_coach());
drop policy if exists "alumno crea sesiones" on public.sessions;
create policy "alumno crea sesiones" on public.sessions for insert
  with check (student_id = auth.uid());
drop policy if exists "alumno o coach actualiza sesiones" on public.sessions;
create policy "alumno o coach actualiza sesiones" on public.sessions for update
  using (student_id = auth.uid() or public.is_coach());
drop policy if exists "alumno borra sesiones sin terminar" on public.sessions;
create policy "alumno borra sesiones sin terminar" on public.sessions for delete
  using (student_id = auth.uid() and finished_at is null);

-- El alumno no puede ponerse estrellas a sí mismo.
create or replace function public.protect_review() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_coach() then
    new.rating := old.rating;
    new.reviewed_at := old.reviewed_at;
  end if;
  return new;
end $$;
drop trigger if exists sessions_protect_review on public.sessions;
create trigger sessions_protect_review before update on public.sessions
  for each row execute function public.protect_review();

drop policy if exists "series propias o coach" on public.set_logs;
create policy "series propias o coach" on public.set_logs for select
  using (student_id = auth.uid() or public.is_coach());
drop policy if exists "alumno carga series" on public.set_logs;
create policy "alumno carga series" on public.set_logs for insert
  with check (student_id = auth.uid() and exists (
    select 1 from public.sessions s where s.id = session_id and s.student_id = auth.uid()));
drop policy if exists "alumno edita series" on public.set_logs;
create policy "alumno edita series" on public.set_logs for update
  using (student_id = auth.uid());
drop policy if exists "alumno borra series" on public.set_logs;
create policy "alumno borra series" on public.set_logs for delete
  using (student_id = auth.uid());

drop policy if exists "mensajes de sesiones visibles" on public.messages;
create policy "mensajes de sesiones visibles" on public.messages for select
  using (exists (select 1 from public.sessions s where s.id = session_id and (s.student_id = auth.uid() or public.is_coach())));
drop policy if exists "escribir mensajes" on public.messages;
create policy "escribir mensajes" on public.messages for insert
  with check (author_id = auth.uid() and exists (
    select 1 from public.sessions s where s.id = session_id and (s.student_id = auth.uid() or public.is_coach())));

-- ------------------------------------------------------------- Videos
-- Bucket privado: cada alumno sube a su carpeta (<su id>/...), el coach ve todo.
-- Límite de 50 MB por video (el máximo del plan gratis).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', false, 52428800, array['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'])
on conflict (id) do nothing;

drop policy if exists "alumno sube sus videos" on storage.objects;
create policy "alumno sube sus videos" on storage.objects for insert
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "ver videos propios o coach" on storage.objects;
create policy "ver videos propios o coach" on storage.objects for select
  using (bucket_id = 'videos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_coach()));
drop policy if exists "alumno borra sus videos" on storage.objects;
create policy "alumno borra sus videos" on storage.objects for delete
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
