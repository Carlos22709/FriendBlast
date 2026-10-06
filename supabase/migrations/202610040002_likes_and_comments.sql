create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 300),
  created_at timestamptz not null default now()
);

create index if not exists comments_post_created_at_idx
  on public.comments (post_id, created_at);

alter table public.post_likes enable row level security;
alter table public.comments enable row level security;

drop policy if exists "Authenticated users can view likes" on public.post_likes;
create policy "Authenticated users can view likes"
  on public.post_likes for select
  to authenticated
  using (true);

drop policy if exists "Users can create their own likes" on public.post_likes;
create policy "Users can create their own likes"
  on public.post_likes for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own likes" on public.post_likes;
create policy "Users can delete their own likes"
  on public.post_likes for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Authenticated users can view comments" on public.comments;
create policy "Authenticated users can view comments"
  on public.comments for select
  to authenticated
  using (true);

drop policy if exists "Users can create their own comments" on public.comments;
create policy "Users can create their own comments"
  on public.comments for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own comments" on public.comments;
create policy "Users can delete their own comments"
  on public.comments for delete
  to authenticated
  using (auth.uid() = user_id);
