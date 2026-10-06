create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  image_path text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint stories_expire_after_creation check (expires_at > created_at)
);

create index if not exists stories_expires_at_idx
  on public.stories (expires_at desc);

alter table public.stories enable row level security;

drop policy if exists "Users can view active allowed stories" on public.stories;
create policy "Users can view active allowed stories"
  on public.stories for select
  to authenticated
  using (
    expires_at > now()
    and (
      user_id = (select auth.uid())
      or exists (
        select 1
        from public.profiles
        where profiles.id = stories.user_id
          and profiles.is_private = false
      )
      or exists (
        select 1
        from public.follows
        where follows.follower_id = (select auth.uid())
          and follows.following_id = stories.user_id
      )
    )
  );

drop policy if exists "Users can create their own stories" on public.stories;
create policy "Users can create their own stories"
  on public.stories for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and expires_at <= now() + interval '24 hours 1 minute'
  );

drop policy if exists "Users can delete their own stories" on public.stories;
create policy "Users can delete their own stories"
  on public.stories for delete
  to authenticated
  using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public)
values ('story-images', 'story-images', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Users can view allowed story images" on storage.objects;
create policy "Users can view allowed story images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'story-images'
    and exists (
      select 1
      from public.stories
      where stories.image_path = storage.objects.name
    )
  );

drop policy if exists "Users can upload their own story images" on storage.objects;
create policy "Users can upload their own story images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'story-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete their own story images" on storage.objects;
create policy "Users can delete their own story images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'story-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
