-- iPad Ajanda (Defterim) - Supabase Çoklu Cihaz Senkronizasyon Şeması
-- Bu SQL komutunu Supabase Dashboard -> SQL Editor içinde bir kez çalıştırın.

create table if not exists public.user_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_states enable row level security;

drop policy if exists "Users can read their own planner data" on public.user_states;
create policy "Users can read their own planner data"
  on public.user_states
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own planner data" on public.user_states;
create policy "Users can insert their own planner data"
  on public.user_states
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own planner data" on public.user_states;
create policy "Users can update their own planner data"
  on public.user_states
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Realtime anlık senkronizasyon için tabloyu yayına ekle
do $$
begin
  alter publication supabase_realtime add table public.user_states;
exception
  when duplicate_object then null;
end $$;

-- Veri kaybına karşı bulut geçmişi: her birkaç dakikada bir anlık görüntü saklanır (uygulama kendisi seyreltir).
create table if not exists public.user_state_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  state jsonb not null,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists user_state_history_user_idx on public.user_state_history (user_id, created_at desc);
alter table public.user_state_history enable row level security;

drop policy if exists "history read own" on public.user_state_history;
create policy "history read own" on public.user_state_history for select using (auth.uid() = user_id);
drop policy if exists "history insert own" on public.user_state_history;
create policy "history insert own" on public.user_state_history for insert with check (auth.uid() = user_id);
drop policy if exists "history delete own" on public.user_state_history;
create policy "history delete own" on public.user_state_history for delete using (auth.uid() = user_id);

-- Sticker paketleri ve yüklenen fontlar için bulut yedeği (cihaz değiştirince / uygulama silinince kaybolmasın)
create table if not exists public.user_assets (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.user_assets enable row level security;
drop policy if exists "assets own" on public.user_assets;
create policy "assets own" on public.user_assets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
