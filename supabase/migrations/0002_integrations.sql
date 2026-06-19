-- Per-user external integration links. Currently: Steam (SteamID64).
create table if not exists public.integrations (
  user_id      uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  steam_id     text not null,
  connected_at timestamptz not null default now()
);
alter table public.integrations enable row level security;
create policy integrations_owner on public.integrations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
