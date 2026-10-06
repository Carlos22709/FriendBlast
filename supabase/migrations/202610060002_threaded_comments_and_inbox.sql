alter table public.comments
  add column if not exists parent_id uuid;

create unique index if not exists comments_id_post_id_idx
  on public.comments (id, post_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'comments_parent_same_post_fkey'
      and conrelid = 'public.comments'::regclass
  ) then
    alter table public.comments
      add constraint comments_parent_same_post_fkey
      foreign key (parent_id, post_id)
      references public.comments (id, post_id)
      on delete cascade;
  end if;
end;
$$;

create index if not exists comments_thread_idx
  on public.comments (post_id, parent_id, created_at, id);

drop policy if exists "Users can create their own likes" on public.post_likes;
create policy "Users can create their own likes"
  on public.post_likes for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.posts
      where posts.id = post_likes.post_id
    )
  );

drop policy if exists "Users can create their own comments" on public.comments;
create policy "Users can create their own comments"
  on public.comments for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.posts
      where posts.id = comments.post_id
    )
  );

create or replace function public.list_my_conversations()
returns table (
  conversation_id uuid,
  other_user_id uuid,
  display_name text,
  username text,
  last_message text,
  updated_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    conversation.id as conversation_id,
    other_member.user_id as other_user_id,
    profile.display_name,
    profile.username,
    coalesce(latest_message.body, 'Inicia la conversación') as last_message,
    coalesce(latest_message.created_at, conversation.updated_at) as updated_at
  from public.conversations as conversation
  join public.conversation_members as own_member
    on own_member.conversation_id = conversation.id
   and own_member.user_id = (select auth.uid())
  join public.conversation_members as other_member
    on other_member.conversation_id = conversation.id
   and other_member.user_id <> (select auth.uid())
  join public.profiles as profile
    on profile.id = other_member.user_id
  left join lateral (
    select message.body, message.created_at
    from public.messages as message
    where message.conversation_id = conversation.id
    order by message.created_at desc, message.id desc
    limit 1
  ) as latest_message on true
  where (select auth.uid()) is not null
  order by coalesce(latest_message.created_at, conversation.updated_at) desc;
$$;

revoke all on function public.list_my_conversations() from public;
grant execute on function public.list_my_conversations() to authenticated;
