create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;

create policy "Anyone can read comments" on public.comments
  for select using (true);

create policy "Authenticated users can insert comments" on public.comments
  for insert with check (auth.uid() = user_id);

create policy "Users can delete own comments" on public.comments
  for delete using (auth.uid() = user_id);
