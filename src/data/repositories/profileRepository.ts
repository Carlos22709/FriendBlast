import type { FollowRequest } from '@/domain/models/FollowRequest';
import type { MyProfile } from '@/domain/models/MyProfile';
import type {
  ConnectionKind,
  ProfileConnection,
  ProfileDetails,
} from '@/domain/models/ProfileDetails';
import type { UserProfile } from '@/domain/models/UserProfile';
import { getSupabaseClient } from '@/data/remote/supabase';

type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  is_private: boolean;
};

type FollowRequestRow = {
  requester_id: string;
  created_at: string;
  requester: Pick<ProfileRow, 'id' | 'username' | 'display_name' | 'avatar_url'> | null;
};

type UpdateProfileInput = {
  displayName: string;
  username: string;
  bio: string;
  isPrivate: boolean;
};

type ProfileDetailsRow = ProfileRow & {
  can_view_content: boolean;
  follower_count: number;
  following_count: number;
  post_count: number;
};

type ProfileConnectionRow = Pick<
  ProfileRow,
  'id' | 'username' | 'display_name' | 'avatar_url' | 'is_private'
>;

export async function getMyProfile(userId: string): Promise<MyProfile> {
  const client = getSupabaseClient();
  const [profileResult, followersResult, followingResult, postsResult] = await Promise.all([
    client
      .from('profiles')
      .select('id, username, display_name, bio, avatar_url, is_private')
      .eq('id', userId)
      .single(),
    client
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId),
    client
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId),
    client.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  const profile = profileResult.data as ProfileRow;
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    bio: profile.bio,
    isPrivate: profile.is_private,
    followerCount: followersResult.count ?? 0,
    followingCount: followingResult.count ?? 0,
    postCount: postsResult.count ?? 0,
  };
}

export async function updateMyProfile(userId: string, input: UpdateProfileInput) {
  const client = getSupabaseClient();
  const { error } = await client
    .from('profiles')
    .update({
      display_name: input.displayName.trim(),
      username: input.username.trim().toLowerCase(),
      bio: input.bio.trim(),
      is_private: input.isPrivate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error?.code === '23505') {
    throw new Error('Ese nombre de usuario ya está en uso.');
  }

  if (error) {
    throw error;
  }
}

export async function getProfileDetails(profileId: string): Promise<ProfileDetails> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .rpc('get_profile_details', { p_profile_id: profileId })
    .single();

  if (error) {
    throw error;
  }

  const profile = data as ProfileDetailsRow;
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    bio: profile.bio,
    avatarUrl: profile.avatar_url,
    isPrivate: profile.is_private,
    canViewContent: profile.can_view_content,
    followerCount: Number(profile.follower_count),
    followingCount: Number(profile.following_count),
    postCount: Number(profile.post_count),
  };
}

export async function listProfileConnections(
  profileId: string,
  kind: ConnectionKind,
): Promise<ProfileConnection[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('list_profile_connections', {
    p_profile_id: profileId,
    p_kind: kind,
  });

  if (error) {
    throw error;
  }

  return ((data ?? []) as ProfileConnectionRow[]).map((profile) => ({
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    isPrivate: profile.is_private,
  }));
}

export async function listDiscoverProfiles(currentUserId: string): Promise<UserProfile[]> {
  const client = getSupabaseClient();
  const [profilesResult, followsResult, requestsResult] = await Promise.all([
    client
      .from('profiles')
      .select('id, username, display_name, bio, avatar_url, is_private')
      .neq('id', currentUserId)
      .order('display_name'),
    client.from('follows').select('following_id').eq('follower_id', currentUserId),
    client
      .from('follow_requests')
      .select('target_id')
      .eq('requester_id', currentUserId)
      .eq('status', 'pending'),
  ]);

  if (profilesResult.error) {
    throw profilesResult.error;
  }

  if (followsResult.error) {
    throw followsResult.error;
  }

  if (requestsResult.error) {
    throw requestsResult.error;
  }

  const followedIds = new Set(
    (followsResult.data ?? []).map((follow) => follow.following_id as string),
  );
  const requestedIds = new Set(
    (requestsResult.data ?? []).map((request) => request.target_id as string),
  );

  return ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => ({
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    bio: profile.bio,
    avatarUrl: profile.avatar_url,
    isPrivate: profile.is_private,
    followState: followedIds.has(profile.id)
      ? 'following'
      : requestedIds.has(profile.id)
        ? 'requested'
        : 'none',
  }));
}

export async function setFollowState(targetId: string, shouldFollow: boolean) {
  const client = getSupabaseClient();
  const { error } = await client.rpc('set_follow_state', {
    p_target_id: targetId,
    p_should_follow: shouldFollow,
  });

  if (error) {
    throw error;
  }
}

export async function listFollowRequests(currentUserId: string): Promise<FollowRequest[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('follow_requests')
    .select(
      'requester_id, created_at, requester:profiles!follow_requests_requester_id_fkey(id, username, display_name, avatar_url)',
    )
    .eq('target_id', currentUserId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as FollowRequestRow[]).map((request) => ({
    requesterId: request.requester_id,
    displayName: request.requester?.display_name ?? 'Usuario',
    username: request.requester?.username ?? 'usuario',
    avatarUrl: request.requester?.avatar_url ?? null,
    createdAt: request.created_at,
  }));
}

export async function respondToFollowRequest(requesterId: string, accept: boolean) {
  const client = getSupabaseClient();
  const { error } = await client.rpc('respond_to_follow_request', {
    p_requester_id: requesterId,
    p_accept: accept,
  });

  if (error) {
    throw error;
  }
}
