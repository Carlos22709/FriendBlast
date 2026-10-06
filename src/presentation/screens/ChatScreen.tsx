import { randomUUID } from 'expo-crypto';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  listMessages,
  markConversationDelivered,
  markConversationRead,
  setTypingStatus,
  subscribeToConversation,
} from '@/application/messages';
import type { ChatMessage } from '@/domain/models/Conversation';
import { useAuth } from '@/presentation/providers/AuthProvider';
import { useSyncQueue } from '@/presentation/providers/SyncProvider';
import { colors } from '@/presentation/theme/colors';

function mergeMessages(...groups: ChatMessage[][]) {
  const messagesById = new Map<string, ChatMessage>();
  for (const group of groups) {
    for (const message of group) {
      messagesById.set(message.id, message);
    }
  }

  return [...messagesById.values()].sort(
    (first, second) => first.createdAt.localeCompare(second.createdAt),
  );
}

export function ChatScreen() {
  const params = useLocalSearchParams<{ conversationId: string | string[] }>();
  const conversationId = Array.isArray(params.conversationId)
    ? params.conversationId[0]
    : params.conversationId;
  const { session } = useAuth();
  const { pendingMessages, submitMessage } = useSyncQueue();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localTyping = useRef(false);
  const lastMessageId = messages[messages.length - 1]?.id;

  const loadMessages = useCallback(async (preserveHistory = false) => {
    if (!conversationId) {
      return;
    }

    await markConversationDelivered(conversationId);
    const page = await listMessages(conversationId);
    const localMessages = pendingMessages.filter(
      (message) => message.conversationId === conversationId,
    );
    setMessages((current) =>
      mergeMessages(
        preserveHistory
          ? current.filter((message) => message.conversationId === conversationId)
          : [],
        page.items,
        localMessages,
      ),
    );
    if (!preserveHistory) {
      setNextCursor(page.nextCursor);
    }
    setIsLoading(false);
    await markConversationRead(conversationId);
  }, [conversationId, pendingMessages]);

  useFocusEffect(
    useCallback(() => {
      void loadMessages(false);
    }, [loadMessages]),
  );

  useEffect(() => {
    if (!conversationId || !session) {
      return;
    }

    const unsubscribe = subscribeToConversation(
      conversationId,
      session.user.id,
      () => void loadMessages(true),
      setOtherTyping,
    );

    return () => {
      if (typingTimer.current) {
        clearTimeout(typingTimer.current);
      }
      void setTypingStatus(conversationId, session.user.id, false);
      unsubscribe();
    };
  }, [conversationId, loadMessages, session]);

  useEffect(() => {
    if (!lastMessageId) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [lastMessageId]);

  function handleBodyChange(value: string) {
    setBody(value);
    if (!conversationId || !session) {
      return;
    }

    if (!localTyping.current && value.length > 0) {
      localTyping.current = true;
      void setTypingStatus(conversationId, session.user.id, true);
    }

    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
    }
    typingTimer.current = setTimeout(() => {
      localTyping.current = false;
      void setTypingStatus(conversationId, session.user.id, false);
    }, 900);
  }

  async function handleLoadOlder() {
    if (!conversationId || !nextCursor || isLoadingOlder) {
      return;
    }

    setIsLoadingOlder(true);
    try {
      const page = await listMessages(conversationId, nextCursor);
      setMessages((current) => mergeMessages(page.items, current));
      setNextCursor(page.nextCursor);
    } finally {
      setIsLoadingOlder(false);
    }
  }

  async function handleSend() {
    if (!conversationId || !session || !body.trim()) {
      return;
    }

    const text = body.trim();
    const messageId = randomUUID();
    const createdAt = new Date().toISOString();
    const optimistic: ChatMessage = {
      id: messageId,
      conversationId,
      senderId: session.user.id,
      senderName: 'Tú',
      body: text,
      createdAt,
      deliveredAt: null,
      readAt: null,
      pending: true,
    };
    setMessages((current) => mergeMessages(current, [optimistic]));
    setBody('');
    setIsSending(true);

    try {
      const queued = await submitMessage({
        messageId,
        conversationId,
        senderId: session.user.id,
        body: text,
        createdAt,
      });
      if (!queued) {
        await loadMessages(true);
      }
    } catch {
      setMessages((current) => current.filter((message) => message.id !== messageId));
      setBody(text);
    } finally {
      setIsSending(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <FlatList
          ref={listRef}
          contentContainerStyle={styles.list}
          data={messages}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            nextCursor ? (
              <Pressable
                disabled={isLoadingOlder}
                onPress={() => void handleLoadOlder()}
                style={styles.loadOlder}
              >
                {isLoadingOlder ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={styles.loadOlderText}>Cargar mensajes anteriores</Text>
                )}
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => {
            const own = item.senderId === session?.user.id;
            const status = item.pending
              ? 'Pendiente'
              : item.readAt
                ? 'Visto'
                : item.deliveredAt
                  ? 'Entregado'
                  : 'Enviado';
            return (
              <View style={[styles.bubble, own ? styles.ownBubble : styles.otherBubble]}>
                <Text style={own ? styles.ownText : styles.otherText}>{item.body}</Text>
                {own ? <Text style={styles.status}>{status}</Text> : null}
              </View>
            );
          }}
        />
        {otherTyping ? <Text style={styles.typing}>Escribiendo...</Text> : null}
        <View style={styles.composer}>
          <TextInput
            maxLength={1000}
            onChangeText={handleBodyChange}
            placeholder="Mensaje"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={body}
          />
          <Pressable
            disabled={!body.trim() || isSending}
            onPress={handleSend}
            style={styles.send}
          >
            <Text style={styles.sendText}>Enviar</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bubble: { borderRadius: 16, maxWidth: '82%', padding: 11 },
  centered: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  composer: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 10,
  },
  flex: { flex: 1 },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  list: { flexGrow: 1, gap: 8, padding: 14 },
  loadOlder: { alignItems: 'center', paddingVertical: 10 },
  loadOlderText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  otherBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  otherText: { color: colors.text },
  ownBubble: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  ownText: { color: '#FFFFFF' },
  safeArea: { backgroundColor: colors.background, flex: 1 },
  send: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  sendText: { color: '#FFFFFF', fontWeight: '800' },
  status: { color: '#E8E3FF', fontSize: 10, marginTop: 4, textAlign: 'right' },
  typing: { color: colors.muted, fontSize: 12, paddingHorizontal: 14, paddingVertical: 5 },
});
