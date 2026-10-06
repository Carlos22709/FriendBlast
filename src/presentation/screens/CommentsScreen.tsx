import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { listComments, subscribeToComments } from '@/application/posts';
import type { Comment } from '@/domain/models/Comment';
import { useAuth } from '@/presentation/providers/AuthProvider';
import { useSyncQueue } from '@/presentation/providers/SyncProvider';
import { colors } from '@/presentation/theme/colors';

type ThreadedComment = Comment & {
  depth: number;
};

function buildCommentThread(comments: Comment[]): ThreadedComment[] {
  const commentIds = new Set(comments.map((comment) => comment.id));
  const children = new Map<string | null, Comment[]>();

  for (const comment of comments) {
    const parentId =
      comment.parentId && commentIds.has(comment.parentId) ? comment.parentId : null;
    const siblings = children.get(parentId) ?? [];
    siblings.push(comment);
    children.set(parentId, siblings);
  }

  for (const siblings of children.values()) {
    siblings.sort((first, second) => first.createdAt.localeCompare(second.createdAt));
  }

  const result: ThreadedComment[] = [];
  const visited = new Set<string>();

  function visit(comment: Comment, depth: number) {
    if (visited.has(comment.id)) {
      return;
    }

    visited.add(comment.id);
    result.push({ ...comment, depth });
    for (const reply of children.get(comment.id) ?? []) {
      visit(reply, depth + 1);
    }
  }

  for (const root of children.get(null) ?? []) {
    visit(root, 0);
  }

  for (const comment of comments) {
    visit(comment, 0);
  }

  return result;
}

export function CommentsScreen() {
  const params = useLocalSearchParams<{ postId: string | string[] }>();
  const postId = Array.isArray(params.postId) ? params.postId[0] : params.postId;
  const { session } = useAuth();
  const { pendingComments, submitComment } = useSyncQueue();
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState('');
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadedComments = useMemo(() => buildCommentThread(comments), [comments]);
  // La cola cambia en cada sincronización. Se lee desde una referencia para que
  // loadComments no cambie de identidad: si cambiara, se volverían a pedir los
  // comentarios y se recrearía la suscripción Realtime.
  const pendingCommentsRef = useRef(pendingComments);

  useEffect(() => {
    pendingCommentsRef.current = pendingComments;
  }, [pendingComments]);

  const loadComments = useCallback(async () => {
    if (!postId) {
      return;
    }

    try {
      const nextComments = await listComments(postId);
      setError(null);
      const localComments = pendingCommentsRef.current.filter(
        (comment) => comment.postId === postId,
      );
      const remoteIds = new Set(nextComments.map((comment) => comment.id));
      setComments([
        ...nextComments,
        ...localComments.filter((comment) => !remoteIds.has(comment.id)),
      ]);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar.');
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useFocusEffect(
    useCallback(() => {
      void loadComments();
    }, [loadComments]),
  );

  useEffect(() => {
    if (!postId) {
      return;
    }

    return subscribeToComments(postId, () => void loadComments());
  }, [loadComments, postId]);

  async function handleSend() {
    if (!postId || !session || !body.trim()) {
      return;
    }

    setIsSaving(true);
    setError(null);
    const nextBody = body.trim();
    const commentId = randomUUID();
    const replyTarget = replyingTo;
    const optimisticComment: Comment = {
      id: commentId,
      postId,
      parentId: replyTarget?.id ?? null,
      userId: session.user.id,
      displayName: 'Tú',
      body: nextBody,
      createdAt: new Date().toISOString(),
    };
    setComments((current) => [...current, optimisticComment]);
    setBody('');
    setReplyingTo(null);

    try {
      await submitComment({
        commentId,
        postId,
        parentId: optimisticComment.parentId,
        userId: session.user.id,
        body: nextBody,
        createdAt: optimisticComment.createdAt,
      });
    } catch (saveError: unknown) {
      setComments((current) => current.filter((comment) => comment.id !== commentId));
      setBody(nextBody);
      setReplyingTo(replyTarget);
      setError(saveError instanceof Error ? saveError.message : 'No se pudo comentar.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            contentContainerStyle={styles.list}
            data={threadedComments}
            keyExtractor={(comment) => comment.id}
            ListEmptyComponent={
              <Text style={styles.empty}>Todavía no hay comentarios. Escribe el primero.</Text>
            }
            renderItem={({ item }) => (
              <View
                style={[
                  styles.comment,
                  item.depth > 0 && styles.reply,
                  { marginLeft: Math.min(item.depth, 4) * 18 },
                ]}
              >
                <Text style={styles.author}>{item.displayName}</Text>
                <Text style={styles.body}>{item.body}</Text>
                <View style={styles.commentFooter}>
                  <Text style={styles.date}>
                    {new Date(item.createdAt).toLocaleDateString('es-CO')}
                  </Text>
                  <Pressable onPress={() => setReplyingTo(item)}>
                    <Text style={styles.replyAction}>Responder</Text>
                  </Pressable>
                </View>
              </View>
            )}
          />
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {replyingTo ? (
          <View style={styles.replyingBanner}>
            <Text numberOfLines={1} style={styles.replyingText}>
              Respondiendo a {replyingTo.displayName}
            </Text>
            <Pressable onPress={() => setReplyingTo(null)}>
              <Text style={styles.cancelReply}>Cancelar</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.composer}>
          <TextInput
            maxLength={300}
            onChangeText={setBody}
            placeholder={replyingTo ? 'Escribe una respuesta...' : 'Escribe un comentario...'}
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={body}
          />
          <Pressable
            disabled={!body.trim() || isSaving}
            onPress={handleSend}
            style={({ pressed }) => [
              styles.sendButton,
              (!body.trim() || isSaving) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.sendText}>Enviar</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  author: { color: colors.text, fontWeight: '800' },
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  centered: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  comment: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 5,
    padding: 12,
  },
  commentFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  composer: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  date: { color: colors.muted, fontSize: 11 },
  disabled: { opacity: 0.45 },
  empty: { color: colors.muted, paddingTop: 48, textAlign: 'center' },
  error: { color: '#B42318', paddingHorizontal: 12, paddingVertical: 6, textAlign: 'center' },
  flex: { flex: 1 },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  list: { flexGrow: 1, gap: 10, padding: 16 },
  pressed: { opacity: 0.8 },
  cancelReply: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  reply: { borderLeftColor: colors.primary, borderLeftWidth: 3 },
  replyAction: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  replyingBanner: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  replyingText: { color: colors.text, flex: 1, fontSize: 12, marginRight: 12 },
  safeArea: { backgroundColor: colors.background, flex: 1 },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 78,
    paddingHorizontal: 12,
  },
  sendText: { color: '#FFFFFF', fontWeight: '800' },
});
