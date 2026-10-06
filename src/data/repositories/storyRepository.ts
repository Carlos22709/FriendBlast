import { File } from 'expo-file-system';

import { getSupabaseClient } from '@/data/remote/supabase';
import type { Story } from '@/domain/models/Story';

const STORY_IMAGES_BUCKET = 'story-images';

type ProfileRow = {
  display_name: string;
  avatar_url: string | null;
};

type StoryRow = {
  id: string;
  user_id: string;
  image_path: string;
  created_at: string;
  expires_at: string;
  profile: ProfileRow | ProfileRow[] | null;
};

export type CreateStoryInput = {
  userId: string;
  imageUri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

function getProfile(profile: StoryRow['profile']) {
  return Array.isArray(profile) ? profile[0] : profile;
}

async function mapStories(rows: StoryRow[]): Promise<Story[]> {
  if (rows.length === 0) {
    return [];
  }

  const client = getSupabaseClient();
  const { data: signedImages, error } = await client.storage
    .from(STORY_IMAGES_BUCKET)
    .createSignedUrls(
      rows.map((row) => row.image_path),
      60 * 60,
    );

  if (error) {
    throw error;
  }

  return rows.map((row, index) => {
    const profile = getProfile(row.profile);

    return {
      id: row.id,
      userId: row.user_id,
      displayName: profile?.display_name ?? 'Usuario',
      avatarUrl: profile?.avatar_url ?? null,
      imageUrl: signedImages[index]?.signedUrl ?? '',
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  });
}

export async function listActiveStories() {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('stories')
    .select(
      'id, user_id, image_path, created_at, expires_at, profile:profiles!stories_user_id_fkey(display_name, avatar_url)',
    )
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return mapStories((data ?? []) as StoryRow[]);
}

export async function createStory(input: CreateStoryInput) {
  const client = getSupabaseClient();
  const extension = input.fileName?.split('.').pop()?.toLowerCase() || 'jpg';
  const imagePath = `${input.userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const image = new File(input.imageUri);
  const imageBytes = await image.arrayBuffer();

  const { error: uploadError } = await client.storage
    .from(STORY_IMAGES_BUCKET)
    .upload(imagePath, imageBytes, {
      contentType: input.mimeType ?? 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { error: storyError } = await client.from('stories').insert({
    user_id: input.userId,
    image_path: imagePath,
  });

  if (storyError) {
    await client.storage.from(STORY_IMAGES_BUCKET).remove([imagePath]);
    throw storyError;
  }
}
