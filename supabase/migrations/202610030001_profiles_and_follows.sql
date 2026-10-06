create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text not null,
  bio text not null default '',
  avatar_url text,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),  
  updated_at timestamptz not null default now()
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_different_users check (follower_id <> following_id)
);

create table if not exists public.follow_requests (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (requester_id, target_id),
  constraint follow_requests_different_users check (requester_id <> target_id),
  constraint follow_requests_valid_status check (status in ('pending', 'accepted', 'rejected'))
);

alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.follow_requests enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    'user_' || replace(new.id::text, '-', ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists follows_select_related on public.follows;
create policy follows_select_related
  on public.follows for select
  to authenticated
  using (
    (select auth.uid()) = follower_id
    or (select auth.uid()) = following_id
  );

drop policy if exists follows_insert_own on public.follows;
create policy follows_insert_own
  on public.follows for insert
  to authenticated
  with check ((select auth.uid()) = follower_id);

drop policy if exists follows_delete_own on public.follows;
create policy follows_delete_own
  on public.follows for delete
  to authenticated
  using ((select auth.uid()) = follower_id);

drop policy if exists follow_requests_select_related on public.follow_requests;
create policy follow_requests_select_related
  on public.follow_requests for select
  to authenticated
  using (
    (select auth.uid()) = requester_id
    or (select auth.uid()) = target_id
  );

drop policy if exists follow_requests_insert_own on public.follow_requests;
create policy follow_requests_insert_own
  on public.follow_requests for insert
  to authenticated
  with check (
    (select auth.uid()) = requester_id
    and status = 'pending'
  );

drop policy if exists follow_requests_update_received on public.follow_requests;
create policy follow_requests_update_received
  on public.follow_requests for update
  to authenticated
  using ((select auth.uid()) = target_id)
  with check (
    (select auth.uid()) = target_id
    and status in ('accepted', 'rejected')
  );

drop policy if exists follow_requests_delete_related on public.follow_requests;
create policy follow_requests_delete_related
  on public.follow_requests for delete
  to authenticated
  using (
    (select auth.uid()) = requester_id
    or (select auth.uid()) = target_id
  );
