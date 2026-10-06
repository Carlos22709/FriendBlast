export type ConnectionKind = 'followers' | 'following';

export type ProfileDetails = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  isPrivate: boolean;
  canViewContent: boolean;
  followerCount: number;
  followingCount: number;
  postCount: number;
};

export type ProfileConnection = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isPrivate: boolean;
};
