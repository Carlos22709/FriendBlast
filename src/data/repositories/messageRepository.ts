import type { ChatMessage, Conversation } from '@/domain/models/Conversation';
import { getSupabaseClient } from '@/data/remote/supabase';

type ConversationRow = {
  conversation_id: string;
  other_user_id: string;
  display_name: string;
  username: string;
  last_message: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
  sender?: { display_name: string } | null;
};

export const MESSAGE_PAGE_SIZE = 50;

export type MessagePage = {
  items: ChatMessage[];
  nextCursor: string | null;
};

export async function getOrCreateConversation(otherUserId: string) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('get_or_create_direct_conversation', {
    p_other_user_id: otherUserId,
  });

  if (error) {
    throw error;
  }

  return data as string;
}

export async function listConversations(): Promise<Conversation[]> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('list_my_conversations');

  if (error) {
    throw error;
  }

  return ((data ?? []) as ConversationRow[]).map((conversation) => ({
    id: conversation.conversation_id,
    otherUserId: conversation.other_user_id,
    displayName: conversation.display_name,
    username: conversation.username,
    lastMessage: conversation.last_message,
    updatedAt: conversation.updated_at,
  }));

}

export async function listMessages(
  conversationId: string,
  before?: string,
  limit = MESSAGE_PAGE_SIZE,
): Promise<MessagePage> {
  const client = getSupabaseClient();
  let query = client
    .from('messages')
    .select(
      'id, conversation_id, sender_id, body, created_at, delivered_at, read_at, sender:profiles!messages_sender_id_fkey(display_name)',
    )
    .eq('conversation_id', conversationId);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as unknown as MessageRow[];
  const items = rows.map((message) => ({
    id: message.id,
    conversationId: message.conversation_id,
    senderId: message.sender_id,
    senderName: message.sender?.display_name ?? 'Usuario',
    body: message.body,
    createdAt: message.created_at,
    deliveredAt: message.delivered_at,
    readAt: message.read_at,
  })).reverse();

  return {
    items,
    nextCursor: rows.length === limit ? rows[rows.length - 1]?.created_at ?? null : null,
  };
}

export async function sendMessage(
  messageId: string,
  conversationId: string,
  senderId: string,
  body: string,
) {
  const client = getSupabaseClient();
  const { error } = await client.from('messages').insert({
    id: messageId,
    conversation_id: conversationId,
    sender_id: senderId,
    body: body.trim(),
  });

  if (error && error.code !== '23505') {
    throw error;
  }
}

export async function markConversationDelivered(conversationId: string) {
  const client = getSupabaseClient();
  const { error } = await client.rpc('mark_conversation_delivered', {
    p_conversation_id: conversationId,
  });

  if (error) {
    throw error;
  }
}

export async function markInboxDelivered() {
  const client = getSupabaseClient();
  const { error } = await client.rpc('mark_inbox_delivered');

  if (error) {
    throw error;
  }
}

export async function markConversationRead(conversationId: string) {
  const client = getSupabaseClient();
  const { error } = await client.rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
  });

  if (error) {
    throw error;
  }
}

export async function setTypingStatus(
  conversationId: string,
  userId: string,
  isTyping: boolean,
) {
  const client = getSupabaseClient();
  const { error } = await client.from('typing_status').upsert(
    {
      conversation_id: conversationId,
      user_id: userId,
      is_typing: isTyping,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'conversation_id,user_id' },
  );

  if (error) {
    throw error;
  }
}

export function subscribeToConversation(
  conversationId: string,
  currentUserId: string,
  onMessagesChanged: () => void,
  onTypingChanged: (isTyping: boolean) => void,
) {
  const client = getSupabaseClient();
  const channel = client
    .channel(`chat:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      onMessagesChanged,
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'typing_status',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const row = payload.new as { user_id?: string; is_typing?: boolean };
        if (row.user_id && row.user_id !== currentUserId) {
          onTypingChanged(Boolean(row.is_typing));
        }
      },
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeToInbox(onMessagesChanged: () => void) {
  const client = getSupabaseClient();
  const channel = client
    .channel('inbox-messages')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messages' },
      onMessagesChanged,
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
