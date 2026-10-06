export type FollowState = 'none' | 'following' | 'requested';

export type UserProfile = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  isPrivate: boolean;
  followState: FollowState;
};
