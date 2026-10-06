import { useFocusEffect, useRouter } from 'expo-router';
import { memo, useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  type ViewToken,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listPostsPage } from '@/application/posts';
import type { Post } from '@/domain/models/Post';
import { CachedImage } from '@/presentation/components/CachedImage';
import { StoriesStrip } from '@/presentation/components/StoriesStrip';
import { useAuth } from '@/presentation/providers/AuthProvider';
import { useSyncQueue } from '@/presentation/providers/SyncProvider';
import { colors } from '@/presentation/theme/colors';

const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 10 };

export function FeedScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const {
    failedCount,
    isSyncing,
    pendingCount,
    retryFailedActions,
    submitLike,
  } = useSyncQueue();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingLikes, setPendingLikes] = useState<Record<string, boolean>>({});
  const [visiblePostIds, setVisiblePostIds] = useState<Set<string>>(new Set());
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<Post>[] }) => {
      const nextIds = new Set(
        viewableItems
          .map((item) => item.item?.id)
          .filter((id): id is string => typeof id === 'string'),
      );
      setVisiblePostIds((current) => {
        const unchanged =
          current.size === nextIds.size && [...current].every((id) => nextIds.has(id));
        return unchanged ? current : nextIds;
      });
    },
    [],
  );

  const loadPosts = useCallback(async () => {
    setError(null);

    try {
      const page = await listPostsPage();
      setPosts(page.items);
      setNextCursor(page.nextCursor);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el feed.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPosts();
    }, [loadPosts]),
  );

  async function handleRefresh() {
    setIsRefreshing(true);
    await loadPosts();
    setIsRefreshing(false);
  }

  async function handleLoadMore() {
    if (!nextCursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const page = await listPostsPage(nextCursor);
      setPosts((current) => {
        const existingIds = new Set(current.map((post) => post.id));
        return [...current, ...page.items.filter((post) => !existingIds.has(post.id))];
      });
      setNextCursor(page.nextCursor);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar más contenido.');
    } finally {
      setIsLoadingMore(false);
    }
  }

  const handleLike = useCallback(async (post: Post) => {
    if (!session) {
      return;
    }

    setPendingLikes((current) => ({ ...current, [post.id]: true }));
    setPosts((current) =>
      current.map((item) =>
        item.id === post.id
          ? {
              ...item,
              likedByMe: !item.likedByMe,
              likeCount: item.likeCount + (item.likedByMe ? -1 : 1),
            }
          : item,
      ),
    );

    try {
      await submitLike({
        postId: post.id,
        userId: session.user.id,
        shouldLike: !post.likedByMe,
      });
    } catch (likeError: unknown) {
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? { ...item, likedByMe: post.likedByMe, likeCount: post.likeCount }
            : item,
        ),
      );
      Alert.alert(
        'No se pudo actualizar',
        likeError instanceof Error ? likeError.message : 'Intenta nuevamente.',
      );
    } finally {
      setPendingLikes((current) => ({ ...current, [post.id]: false }));
    }
  }, [session, submitLike]);

  const handleShare = useCallback(async (post: Post) => {
    const url = `friendblast://post/${post.id}`;

    try {
      await Share.share({
        message: `Mira esta publicación de ${post.displayName} en FriendBlast: ${url}`,
        url,
      });
    } catch (shareError: unknown) {
      Alert.alert(
        'No se pudo compartir',
        shareError instanceof Error ? shareError.message : 'Intenta nuevamente.',
      );
    }
  }, []);

  const handleComments = useCallback(
    (postId: string) => {
      router.push({ pathname: '/feed/[postId]', params: { postId } });
    },
    [router],
  );

  const renderPost = useCallback(
    ({ item }: { item: Post }) => (
      <PostCard
        isLiking={Boolean(pendingLikes[item.id])}
        onComments={handleComments}
        onLike={handleLike}
        onShare={handleShare}
        post={item}
        visible={visiblePostIds.has(item.id)}
      />
    ),
    [handleComments, handleLike, handleShare, pendingLikes, visiblePostIds],
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <FlatList
        contentContainerStyle={posts.length === 0 ? styles.emptyContent : styles.content}
        data={posts}
        initialNumToRender={3}
        keyExtractor={(post) => post.id}
        maxToRenderPerBatch={4}
        onViewableItemsChanged={onViewableItemsChanged}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={handleRefresh}
            refreshing={isRefreshing}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <StoriesStrip />
            {pendingCount > 0 ? (
              <Text style={styles.syncText}>
                {isSyncing ? 'Sincronizando...' : `${pendingCount} acciones pendientes`}
              </Text>
            ) : null}
            {failedCount > 0 ? (
              <View style={styles.failedSync}>
                <Text style={styles.failedSyncText}>
                  {failedCount} acciones necesitan atención.
                </Text>
                <Pressable onPress={() => void retryFailedActions()}>
                  <Text style={styles.retryText}>Reintentar</Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/feed/create')}
              style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}
            >
              <Text style={styles.createButtonText}>＋ Nueva publicación</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Todavía no hay publicaciones</Text>
            <Text style={styles.emptyText}>Crea la primera foto de FriendBlast.</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListFooterComponent={
          isLoadingMore ? <ActivityIndicator color={colors.primary} style={styles.footerLoader} /> : null
        }
        onEndReached={() => void handleLoadMore()}
        onEndReachedThreshold={0.5}
        renderItem={renderPost}
        viewabilityConfig={VIEWABILITY_CONFIG}
        windowSize={5}
      />
    </SafeAreaView>
  );
}

type PostCardProps = {
  post: Post;
  isLiking: boolean;
  onLike: (post: Post) => void;
  onComments: (postId: string) => void;
  onShare: (post: Post) => void;
  visible: boolean;
};

const PostCard = memo(function PostCard({
  post,
  isLiking,
  onLike,
  onComments,
  onShare,
  visible,
}: PostCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.authorRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{post.displayName.slice(0, 1).toUpperCase()}</Text>
        </View>
        <Text style={styles.author}>{post.displayName}</Text>
      </View>
      <CachedImage
        active={visible}
        cacheKey={post.id}
        remoteUrl={post.imageUrl}
        resizeMode="cover"
        style={styles.image}
      />
      <View style={styles.cardBody}>
        <View style={styles.actions}>
          <Pressable
            disabled={isLiking}
            onPress={() => onLike(post)}
            style={styles.actionButton}
          >
            <Text style={[styles.actionText, post.likedByMe && styles.actionTextActive]}>
              {post.likedByMe ? 'Te gusta' : 'Me gusta'} ({post.likeCount})
            </Text>
          </Pressable>
          <Pressable onPress={() => onComments(post.id)} style={styles.actionButton}>
            <Text style={styles.actionText}>Comentarios ({post.commentCount})</Text>
          </Pressable>
          <Pressable onPress={() => onShare(post)} style={styles.actionButton}>
            <Text style={styles.actionText}>Compartir</Text>
          </Pressable>
        </View>
        {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
        <Text style={styles.date}>{new Date(post.createdAt).toLocaleDateString('es-CO')}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  actionButton: { paddingVertical: 4 },
  actionText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  actionTextActive: { color: colors.primary },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  author: { color: colors.text, fontSize: 15, fontWeight: '700' },
  authorRow: { alignItems: 'center', flexDirection: 'row', gap: 10, padding: 12 },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  avatarText: { color: colors.primary, fontWeight: '800' },
  caption: { color: colors.text, fontSize: 15, lineHeight: 21 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardBody: { gap: 6, padding: 14 },
  centered: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  content: { gap: 16, padding: 16, paddingBottom: 32 },
  createButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: 14,
  },
  createButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  date: { color: colors.muted, fontSize: 12 },
  empty: { alignItems: 'center', gap: 8, padding: 24 },
  emptyContent: { flexGrow: 1, gap: 16, padding: 16 },
  emptyText: { color: colors.muted, textAlign: 'center' },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  footerLoader: { paddingVertical: 20 },
  failedSync: {
    alignItems: 'center',
    backgroundColor: '#FFF4E5',
    borderColor: colors.warning,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
  },
  failedSyncText: { color: colors.text, flex: 1, fontSize: 13 },
  error: { color: '#B42318', marginTop: 8, textAlign: 'center' },
  image: { aspectRatio: 1, backgroundColor: colors.primarySoft, width: '100%' },
  headerContent: { gap: 10 },
  pressed: { opacity: 0.8 },
  retryText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  safeArea: { backgroundColor: colors.background, flex: 1 },
  syncText: {
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    padding: 10,
    textAlign: 'center',
  },
});
