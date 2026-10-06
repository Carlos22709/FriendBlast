import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listProfilePostsPage } from '@/application/posts';
import { getProfileDetails } from '@/application/profiles';
import type { Post } from '@/domain/models/Post';
import type { ConnectionKind, ProfileDetails } from '@/domain/models/ProfileDetails';
import { CachedImage } from '@/presentation/components/CachedImage';
import { colors } from '@/presentation/theme/colors';

export function ProfileDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string | string[] }>();
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const [profile, setProfile] = useState<ProfileDetails | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setError('Perfil no válido.');
      setIsLoading(false);
      return;
    }

    try {
      const nextProfile = await getProfileDetails(userId);
      setProfile(nextProfile);
      if (nextProfile.canViewContent) {
        const page = await listProfilePostsPage(userId);
        setPosts(page.items);
        setNextCursor(page.nextCursor);
      } else {
        setPosts([]);
        setNextCursor(null);
      }
      setError(null);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el perfil.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useFocusEffect(useCallback(() => void loadProfile(), [loadProfile]));

  function openConnections(kind: ConnectionKind) {
    if (!profile?.canViewContent) return;
    router.push({
      pathname: '/connections/[userId]/[kind]',
      params: { userId: profile.id, kind },
    });
  }

  async function loadMorePosts() {
    if (!userId || !nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const page = await listProfilePostsPage(userId, nextCursor);
      setPosts((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } finally {
      setIsLoadingMore(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? 'Perfil no encontrado.'}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <FlatList
        columnWrapperStyle={styles.postRow}
        contentContainerStyle={styles.content}
        data={posts}
        keyExtractor={(post) => post.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{profile.displayName.slice(0, 1).toUpperCase()}</Text>
            </View>
            <Text style={styles.name}>{profile.displayName}</Text>
            <Text style={styles.username}>@{profile.username}</Text>
            {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

            <View style={styles.stats}>
              <Stat label="Publicaciones" value={profile.postCount} />
              <Stat label="Seguidores" onPress={() => openConnections('followers')} value={profile.followerCount} />
              <Stat label="Siguiendo" onPress={() => openConnections('following')} value={profile.followingCount} />
            </View>

            {!profile.canViewContent ? (
              <View style={styles.locked}>
                <Text style={styles.lockedTitle}>Cuenta privada</Text>
                <Text style={styles.lockedText}>
                  Debes tener una solicitud aprobada para ver sus publicaciones y conexiones.
                </Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          profile.canViewContent ? <Text style={styles.empty}>No hay publicaciones.</Text> : null
        }
        ListFooterComponent={isLoadingMore ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
        numColumns={3}
        onEndReached={() => void loadMorePosts()}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/post/[postId]', params: { postId: item.id } })}
            style={({ pressed }) => [styles.postCell, pressed && styles.pressed]}
          >
            <CachedImage cacheKey={item.id} remoteUrl={item.imageUrl} style={styles.postImage} />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

function Stat({ label, value, onPress }: { label: string; value: number; onPress?: () => void }) {
  const content = (
    <>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </>
  );

  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.stat, pressed && styles.pressed]}>
      {content}
    </Pressable>
  ) : (
    <View style={styles.stat}>{content}</View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 46,
    height: 92,
    justifyContent: 'center',
    width: 92,
  },
  avatarText: { color: colors.primary, fontSize: 36, fontWeight: '900' },
  bio: { color: colors.text, marginTop: 18, textAlign: 'center' },
  centered: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  content: { paddingBottom: 48 },
  empty: { color: colors.muted, paddingTop: 24, textAlign: 'center' },
  error: { color: '#B42318', textAlign: 'center' },
  header: { padding: 24 },
  locked: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 24,
    padding: 22,
  },
  lockedText: { color: colors.muted, marginTop: 7, textAlign: 'center' },
  lockedTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  loader: { paddingVertical: 20 },
  name: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 14, textAlign: 'center' },
  pressed: { opacity: 0.7 },
  postCell: { aspectRatio: 1, flex: 1, margin: 1 },
  postImage: { height: '100%', width: '100%' },
  postRow: { paddingHorizontal: 1 },
  safeArea: { backgroundColor: colors.background, flex: 1 },
  stat: { alignItems: 'center', flex: 1 },
  statLabel: { color: colors.muted, fontSize: 11, marginTop: 2 },
  stats: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 24,
    paddingVertical: 14,
  },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '900' },
  username: { color: colors.muted, marginTop: 4, textAlign: 'center' },
});
