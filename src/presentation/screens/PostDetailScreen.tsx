import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPostById } from '@/application/posts';
import type { Post } from '@/domain/models/Post';
import { CachedImage } from '@/presentation/components/CachedImage';
import { colors } from '@/presentation/theme/colors';

export function PostDetailScreen() {
  const params = useLocalSearchParams<{ postId: string | string[] }>();
  const postId = Array.isArray(params.postId) ? params.postId[0] : params.postId;
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPost = useCallback(async () => {
    if (!postId) {
      return;
    }

    try {
      setPost(await getPostById(postId));
      setError(null);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar.');
    }
  }, [postId]);

  useFocusEffect(
    useCallback(() => {
      void loadPost();
    }, [loadPost]),
  );

  async function handleShare() {
    if (!post) {
      return;
    }

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
  }

  if (!post) {
    return (
      <View style={styles.centered}>
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <ActivityIndicator color={colors.primary} size="large" />
        )}
      </View>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.author}>{post.displayName}</Text>
        <CachedImage cacheKey={post.id} remoteUrl={post.imageUrl} style={styles.image} />
        {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
        <Text style={styles.meta}>
          {post.likeCount} Me gusta · {post.commentCount} comentarios
        </Text>
        <View style={styles.actions}>
          <Pressable
            onPress={() =>
              router.push({ pathname: '/comments/[postId]', params: { postId: post.id } })
            }
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>Ver comentarios</Text>
          </Pressable>
          <Pressable
            onPress={handleShare}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>Compartir</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 10, marginTop: 18 },
  author: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 12 },
  caption: { color: colors.text, fontSize: 16, lineHeight: 22, marginTop: 14 },
  centered: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  content: { padding: 16, paddingBottom: 40 },
  error: { color: '#B42318', textAlign: 'center' },
  image: { aspectRatio: 1, backgroundColor: colors.primarySoft, borderRadius: 16, width: '100%' },
  meta: { color: colors.muted, marginTop: 10 },
  pressed: { opacity: 0.8 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 14,
  },
  primaryText: { color: '#FFFFFF', fontWeight: '800' },
  safeArea: { backgroundColor: colors.background, flex: 1 },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: 12,
    borderWidth: 1,
    padding: 13,
  },
  secondaryText: { color: colors.primary, fontWeight: '800' },
});
