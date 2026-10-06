export type Comment = {
  id: string;
  postId: string;
  parentId: string | null;
  userId: string;
  displayName: string;
  body: string;
  createdAt: string;
};
