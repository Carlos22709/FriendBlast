-- Contadores del feed calculados en la base de datos. Antes el cliente
-- descargaba todas las filas de likes y comentarios para contarlas, y PostgREST
-- devuelve como máximo 1000 filas por consulta.
-- security invoker: las políticas RLS de posts, likes y comentarios siguen
-- aplicándose, así que solo se cuentan publicaciones que el usuario puede ver.
create or replace function public.get_post_stats(p_post_ids uuid[])
returns table (
  post_id uuid,
  like_count bigint,
  comment_count bigint,
  liked_by_me boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    post.id as post_id,
    (
      select count(*)
      from public.post_likes as post_like
      where post_like.post_id = post.id
    ) as like_count,
    (
      select count(*)
      from public.comments as comment
      where comment.post_id = post.id
    ) as comment_count,
    exists (
      select 1
      from public.post_likes as post_like
      where post_like.post_id = post.id
        and post_like.user_id = (select auth.uid())
    ) as liked_by_me
  from public.posts as post
  where post.id = any(p_post_ids);
$$;

revoke all on function public.get_post_stats(uuid[]) from public, anon;
grant execute on function public.get_post_stats(uuid[]) to authenticated;
