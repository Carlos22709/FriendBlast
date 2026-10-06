drop policy if exists follows_insert_own on public.follows;
drop policy if exists follows_insert_public_profiles_only on public.follows;

create policy follows_insert_public_profiles_only
  on public.follows for insert
  to authenticated
  with check (
    follower_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles target_profile
      where target_profile.id = following_id
        and target_profile.is_private = false
    )
  );

create or replace function public.can_view_profile_content(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = p_profile_id
      and (
        profile.id = auth.uid()
        or profile.is_private = false
        or exists (
          select 1
          from public.follows follow
          where follow.follower_id = auth.uid()
            and follow.following_id = profile.id
        )
      )
  );
$$;

revoke all on function public.can_view_profile_content(uuid) from public;
grant execute on function public.can_view_profile_content(uuid) to authenticated;

create or replace function public.set_follow_state(
  p_target_id uuid,
  p_should_follow boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_private boolean;
begin
  if auth.uid() is null or p_target_id = auth.uid() then
    raise exception 'Usuario no válido';
  end if;

  select profile.is_private
  into v_is_private
  from public.profiles profile
  where profile.id = p_target_id;

  if not found then
    raise exception 'Perfil no encontrado';
  end if;

  if not p_should_follow then
    delete from public.follows
    where follower_id = auth.uid()
      and following_id = p_target_id;

    delete from public.follow_requests
    where requester_id = auth.uid()
      and target_id = p_target_id;

    return 'none';
  end if;

  if v_is_private then
    insert into public.follow_requests (requester_id, target_id, status)
    values (auth.uid(), p_target_id, 'pending')
    on conflict (requester_id, target_id)
    do update set status = 'pending', updated_at = now();

    return 'requested';
  end if;

  insert into public.follows (follower_id, following_id)
  values (auth.uid(), p_target_id)
  on conflict do nothing;

  delete from public.follow_requests
  where requester_id = auth.uid()
    and target_id = p_target_id;

  return 'following';
end;
$$;

revoke all on function public.set_follow_state(uuid, boolean) from public;
grant execute on function public.set_follow_state(uuid, boolean) to authenticated;

create or replace function public.get_profile_details(p_profile_id uuid)
returns table (
  id uuid,
  username text,
  display_name text,
  bio text,
  avatar_url text,
  is_private boolean,
  can_view_content boolean,
  follower_count bigint,
  following_count bigint,
  post_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profile.id,
    profile.username,
    profile.display_name,
    profile.bio,
    profile.avatar_url,
    profile.is_private,
    public.can_view_profile_content(profile.id) as can_view_content,
    case when public.can_view_profile_content(profile.id) then
      (select count(*) from public.follows follow where follow.following_id = profile.id)
    else 0 end as follower_count,
    case when public.can_view_profile_content(profile.id) then
      (select count(*) from public.follows follow where follow.follower_id = profile.id)
    else 0 end as following_count,
    case when public.can_view_profile_content(profile.id) then
      (select count(*) from public.posts post where post.user_id = profile.id)
    else 0 end as post_count
  from public.profiles profile
  where profile.id = p_profile_id;
$$;

revoke all on function public.get_profile_details(uuid) from public;
grant execute on function public.get_profile_details(uuid) to authenticated;

create or replace function public.list_profile_connections(
  p_profile_id uuid,
  p_kind text
)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_private boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_kind not in ('followers', 'following') then
    raise exception 'Tipo de conexión no válido';
  end if;

  if not public.can_view_profile_content(p_profile_id) then
    raise exception 'Acceso denegado' using errcode = '42501';
  end if;

  if p_kind = 'followers' then
    return query
      select profile.id, profile.username, profile.display_name, profile.avatar_url, profile.is_private
      from public.follows follow
      join public.profiles profile on profile.id = follow.follower_id
      where follow.following_id = p_profile_id
      order by profile.display_name;
  else
    return query
      select profile.id, profile.username, profile.display_name, profile.avatar_url, profile.is_private
      from public.follows follow
      join public.profiles profile on profile.id = follow.following_id
      where follow.follower_id = p_profile_id
      order by profile.display_name;
  end if;
end;
$$;

revoke all on function public.list_profile_connections(uuid, text) from public;
grant execute on function public.list_profile_connections(uuid, text) to authenticated;

create or replace function public.mark_conversation_delivered(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_conversation_member(p_conversation_id) then
    raise exception 'Acceso denegado';
  end if;

  update public.messages
  set delivered_at = coalesce(delivered_at, now())
  where conversation_id = p_conversation_id
    and sender_id <> auth.uid()
    and delivered_at is null;
end;
$$;

revoke all on function public.mark_conversation_delivered(uuid) from public;
grant execute on function public.mark_conversation_delivered(uuid) to authenticated;

create or replace function public.mark_inbox_delivered()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.messages message
  set delivered_at = coalesce(message.delivered_at, now())
  where message.sender_id <> auth.uid()
    and message.delivered_at is null
    and exists (
      select 1
      from public.conversation_members member
      where member.conversation_id = message.conversation_id
        and member.user_id = auth.uid()
    );
end;
$$;

revoke all on function public.mark_inbox_delivered() from public;
grant execute on function public.mark_inbox_delivered() to authenticated;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_conversation_member(p_conversation_id) then
    raise exception 'Acceso denegado';
  end if;

  update public.messages
  set read_at = coalesce(read_at, now())
  where conversation_id = p_conversation_id
    and sender_id <> auth.uid()
    and read_at is null;

  update public.conversation_members
  set last_read_at = now()
  where conversation_id = p_conversation_id
    and user_id = auth.uid();
end;
$$;

revoke all on function public.mark_conversation_read(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
