create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  direct_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  read_at timestamptz
);

create table if not exists public.typing_status (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  is_typing boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.typing_status enable row level security;

create or replace function public.is_conversation_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members
    where conversation_id = p_conversation_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_conversation_member(uuid) from public;
grant execute on function public.is_conversation_member(uuid) to authenticated;

drop policy if exists "Members can view conversations" on public.conversations;
create policy "Members can view conversations"
  on public.conversations for select
  to authenticated
  using (public.is_conversation_member(id));

drop policy if exists "Members can view conversation members" on public.conversation_members;
create policy "Members can view conversation members"
  on public.conversation_members for select
  to authenticated
  using (public.is_conversation_member(conversation_id));

drop policy if exists "Members can view messages" on public.messages;
create policy "Members can view messages"
  on public.messages for select
  to authenticated
  using (public.is_conversation_member(conversation_id));

drop policy if exists "Members can send messages" on public.messages;
create policy "Members can send messages"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_member(conversation_id)
  );

drop policy if exists "Members can view typing status" on public.typing_status;
create policy "Members can view typing status"
  on public.typing_status for select
  to authenticated
  using (public.is_conversation_member(conversation_id));

drop policy if exists "Users can create their typing status" on public.typing_status;
create policy "Users can create their typing status"
  on public.typing_status for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_conversation_member(conversation_id)
  );

drop policy if exists "Users can update their typing status" on public.typing_status;
create policy "Users can update their typing status"
  on public.typing_status for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.is_conversation_member(conversation_id)
  );

create or replace function public.get_or_create_direct_conversation(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation_id uuid;
  v_direct_key text;
begin
  if auth.uid() is null or p_other_user_id = auth.uid() then
    raise exception 'Participante inválido';
  end if;

  v_direct_key := least(auth.uid()::text, p_other_user_id::text)
    || ':' || greatest(auth.uid()::text, p_other_user_id::text);

  insert into public.conversations (direct_key)
  values (v_direct_key)
  on conflict (direct_key) do update set direct_key = excluded.direct_key
  returning id into v_conversation_id;

  insert into public.conversation_members (conversation_id, user_id)
  values
    (v_conversation_id, auth.uid()),
    (v_conversation_id, p_other_user_id)
  on conflict do nothing;

  return v_conversation_id;
end;
$$;

revoke all on function public.get_or_create_direct_conversation(uuid) from public;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;

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
  set delivered_at = coalesce(delivered_at, now()),
      read_at = coalesce(read_at, now())
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

create or replace function public.touch_conversation_after_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set updated_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists on_message_created on public.messages;
create trigger on_message_created
  after insert on public.messages
  for each row execute procedure public.touch_conversation_after_message();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'typing_status'
  ) then
    alter publication supabase_realtime add table public.typing_status;
  end if;
end;
$$;
