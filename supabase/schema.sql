-- Brújula: almacenamiento de una copia privada de la información financiera por usuario.
-- Ejecutar una sola vez en Supabase > SQL Editor > New query.
-- NO pegar claves privadas ni contraseñas en GitHub.

create table if not exists public.brujula_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.brujula_data enable row level security;

-- Supabase Auth distingue a los usuarios. La clave pública nunca omite RLS.
revoke all on public.brujula_data from anon;
grant select, insert, update, delete on public.brujula_data to authenticated;

drop policy if exists "brujula_select_own" on public.brujula_data;
drop policy if exists "brujula_insert_own" on public.brujula_data;
drop policy if exists "brujula_update_own" on public.brujula_data;
drop policy if exists "brujula_delete_own" on public.brujula_data;

create policy "brujula_select_own" on public.brujula_data
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "brujula_insert_own" on public.brujula_data
  for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "brujula_update_own" on public.brujula_data
  for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "brujula_delete_own" on public.brujula_data
  for delete to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

comment on table public.brujula_data is
  'Documento financiero privado por cuenta Supabase Auth; protegido por RLS.';
