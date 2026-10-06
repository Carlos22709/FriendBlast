export type Post = {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  imageUrl: string;
  caption: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
};
