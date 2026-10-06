export type Conversation = {
  id: string;
  otherUserId: string;
  displayName: string;
  username: string;
  lastMessage: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
  deliveredAt: string | null;
  readAt: string | null;
  pending?: boolean;
};
