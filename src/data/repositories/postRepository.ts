import { File } from 'expo-file-system';

import type { Comment } from '@/domain/models/Comment';
import type { Post } from '@/domain/models/Post';
import { getSupabaseClient } from '@/data/remote/supabase';

const POST_IMAGES_BUCKET = 'post-images';
export const POST_PAGE_SIZE = 12;

type ProfileRow = {
  display_name: string;
  avatar_url: string | null;
};

type PostRow = {
  id: string;
  user_id: string;
  caption: string;
  image_path: string;
  created_at: string;
  profile: ProfileRow | ProfileRow[] | null;
};

type CreatePostInput = {
  userId: string;
  caption: string;
  imageUri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

type PostStatsRow = {
  post_id: string;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
};

type CommentRow = {
  id: string;
  post_id: string;
  parent_id: string | null;
  user_id: string;
  body: string;
  created_at: string;
  profile: ProfileRow | ProfileRow[] | null;
};

type FetchPostsOptions = {
  before?: string;
  limit?: number;
  postId?: string;
  userId?: string;
};

export type PostPage = {
  items: Post[];
  nextCursor: string | null;
};

function getProfile(profile: PostRow['profile']) {
  return Array.isArray(profile) ? profile[0] : profile;
}

async function fetchPosts({
  before,
  limit = POST_PAGE_SIZE,
  postId,
  userId,
}: FetchPostsOptions = {}): Promise<PostPage> {
  const client = getSupabaseClient();
  let query = client
    .from('posts')
    .select(
      'id, user_id, caption, image_path, created_at, profile:profiles!posts_user_id_fkey(display_name, avatar_url)',
    );

  if (postId) {
    query = query.eq('id', postId);
  }

  if (userId) {
    query = query.eq('user_id', userId);
  }

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as unknown as PostRow[];
  if (rows.length === 0) {
    return { items: [], nextCursor: null };
  }

  // Los contadores se calculan en la base de datos (get_post_stats) en lugar de
  // descargar cada like y comentario, que además PostgREST corta en 1000 filas.
  const [statsResult, signedImagesResult] = await Promise.all([
    client.rpc('get_post_stats', { p_post_ids: rows.map((row) => row.id) }),
    client.storage.from(POST_IMAGES_BUCKET).createSignedUrls(
      rows.map((row) => row.image_path),
      60 * 60,
    ),
  ]);

  if (statsResult.error) {
    throw statsResult.error;
  }

  if (signedImagesResult.error) {
    throw signedImagesResult.error;
  }

  const statsByPost = new Map(
    ((statsResult.data ?? []) as PostStatsRow[]).map((stats) => [stats.post_id, stats]),
  );
  const signedImages = signedImagesResult.data;

  const items = rows.map((row, index) => {
    const profile = getProfile(row.profile);
    const stats = statsByPost.get(row.id);

    return {
      id: row.id,
      userId: row.user_id,
      displayName: profile?.display_name ?? 'Usuario',
      avatarUrl: profile?.avatar_url ?? null,
      imageUrl: signedImages[index]?.signedUrl ?? '',
      caption: row.caption,
      createdAt: row.created_at,
      likeCount: Number(stats?.like_count ?? 0),
      commentCount: Number(stats?.comment_count ?? 0),
      likedByMe: stats?.liked_by_me ?? false,
    };
  });

  return {
    items,
    nextCursor: rows.length === limit ? rows[rows.length - 1]?.created_at ?? null : null,
  };
}

export function listPostsPage(before?: string) {
  return fetchPosts({ before });
}

export function listProfilePostsPage(userId: string, before?: string) {
  return fetchPosts({ before, userId });
}

export async function getPostById(postId: string) {
  const { items } = await fetchPosts({ limit: 1, postId });
  const [post] = items;

  if (!post) {
    throw new Error('La publicación no existe o es privada.');
  }

  return post;
}

export function subscribeToComments(postId: string, onChange: () => void) {
  const client = getSupabaseClient();
  const channel = client
    .channel(`comments:${postId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'comments',
        filter: `post_id=eq.${postId}`,
      },
      onChange,
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

export async function createPost(input: CreatePostInput) {
  const client = getSupabaseClient();
  const extension = input.fileName?.split('.').pop()?.toLowerCase() || 'jpg';
  const imagePath = `${input.userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const image = new File(input.imageUri);
  const imageBytes = await image.arrayBuffer();

  const { error: uploadError } = await client.storage
    .from(POST_IMAGES_BUCKET)
    .upload(imagePath, imageBytes, {
      contentType: input.mimeType ?? 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { error: postError } = await client.from('posts').insert({
    user_id: input.userId,
    caption: input.caption.trim(),
    image_path: imagePath,
  });

  if (postError) {
    await client.storage.from(POST_IMAGES_BUCKET).remove([imagePath]);
    throw postError;
  }
}

export async function setPostLiked(postId: string, userId: string, shouldLike: boolean) {
  const client = getSupabaseClient();

  const result = shouldLike
    ? await client
        .from('post_likes')
        .upsert(
          { post_id: postId, user_id: userId },
          { onConflict: 'post_id,user_id', ignoreDuplicates: true },
        )
    : await client.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId);

  if (result.error) {
    throw result.error;
  }
}

export async function listComments(postId: string): Promise<Comment[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('comments')
    .select(
      'id, post_id, parent_id, user_id, body, created_at, profile:profiles!comments_user_id_fkey(display_name, avatar_url)',
    )
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as CommentRow[]).map((row) => ({
    id: row.id,
    postId: row.post_id,
    parentId: row.parent_id,
    userId: row.user_id,
    displayName: getProfile(row.profile)?.display_name ?? 'Usuario',
    body: row.body,
    createdAt: row.created_at,
  }));
}

export async function addComment(
  postId: string,
  userId: string,
  body: string,
  commentId?: string,
  parentId?: string | null,
) {
  const client = getSupabaseClient();
  const { error } = commentId
    ? await client.from('comments').upsert(
        {
          id: commentId,
          post_id: postId,
          parent_id: parentId ?? null,
          user_id: userId,
          body: body.trim(),
        },
        { onConflict: 'id', ignoreDuplicates: true },
      )
    : await client.from('comments').insert({
        post_id: postId,
        parent_id: parentId ?? null,
        user_id: userId,
        body: body.trim(),
      });

  if (error) {
    throw error;
  }
}
