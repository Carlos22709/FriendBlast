update storage.buckets
set public = false
where id = 'post-images';

drop policy if exists "Authenticated users can view posts" on public.posts;
drop policy if exists "Users can view allowed posts" on public.posts;
create policy "Users can view allowed posts"
  on public.posts for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.profiles
      where profiles.id = posts.user_id
        and profiles.is_private = false
    )
    or exists (
      select 1
      from public.follows
      where follows.follower_id = (select auth.uid())
        and follows.following_id = posts.user_id
    )
  );

drop policy if exists "Authenticated users can view post images" on storage.objects;
drop policy if exists "Users can view allowed post images" on storage.objects;
create policy "Users can view allowed post images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'post-images'
    and exists (
      select 1
      from public.posts
      where posts.image_path = storage.objects.name
    )
  );

drop policy if exists "Authenticated users can view likes" on public.post_likes;
drop policy if exists "Users can view likes from allowed posts" on public.post_likes;
create policy "Users can view likes from allowed posts"
  on public.post_likes for select
  to authenticated
  using (
    exists (
      select 1
      from public.posts
      where posts.id = post_likes.post_id
    )
  );

drop policy if exists "Authenticated users can view comments" on public.comments;
drop policy if exists "Users can view comments from allowed posts" on public.comments;
create policy "Users can view comments from allowed posts"
  on public.comments for select
  to authenticated
  using (
    exists (
      select 1
      from public.posts
      where posts.id = comments.post_id
    )
  );

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'comments'
  ) then
    alter publication supabase_realtime add table public.comments;
  end if;
end;
$$;
