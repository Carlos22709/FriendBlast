create or replace function public.respond_to_follow_request(
  p_requester_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.follow_requests
  where requester_id = p_requester_id
    and target_id = auth.uid()
    and status = 'pending';

  if not found then
    raise exception 'Solicitud no encontrada';
  end if;

  if p_accept then
    insert into public.follows (follower_id, following_id)
    values (p_requester_id, auth.uid())
    on conflict do nothing;
  end if;
end;
$$;

revoke all on function public.respond_to_follow_request(uuid, boolean) from public;
grant execute on function public.respond_to_follow_request(uuid, boolean) to authenticated;
