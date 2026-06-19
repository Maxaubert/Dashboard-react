-- Per-user JSONB documents for bulk-replace resources.
create table if not exists public.documents (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('todos','plan','links','home')),
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);
alter table public.documents enable row level security;
create policy documents_owner on public.documents
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Notes: per-row CRUD.
create table if not exists public.notes (
  id         text primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title      text not null default '',
  body       text not null default '',
  updated_at bigint not null
);
alter table public.notes enable row level security;
create policy notes_owner on public.notes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create index if not exists notes_user_updated on public.notes (user_id, updated_at desc);

-- Function cache. No policies → anon/authenticated cannot touch it; the
-- service-role key used by the Vercel functions bypasses RLS.
create table if not exists public.cache (
  key        text primary key,
  data       jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.cache enable row level security;
