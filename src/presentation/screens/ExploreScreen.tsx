import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listDiscoverProfiles } from '@/application/profiles';
import { getOrCreateConversation } from '@/application/messages';
import type { UserProfile } from '@/domain/models/UserProfile';
import { useAuth } from '@/presentation/providers/AuthProvider';
import { useSyncQueue } from '@/presentation/providers/SyncProvider';
import { colors } from '@/presentation/theme/colors';

export function ExploreScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { submitFollow } = useSyncQueue();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null);
  const [busyMessageId, setBusyMessageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    if (!session) {
      return;
    }

    try {
      setProfiles(await listDiscoverProfiles(session.user.id));
      setError(null);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los perfiles.');
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void loadProfiles();
    }, [loadProfiles]),
  );

  const visibleProfiles = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return profiles;
    }

    return profiles.filter(
      (profile) =>
        profile.displayName.toLowerCase().includes(term) ||
        profile.username.toLowerCase().includes(term),
    );
  }, [profiles, search]);

  async function handleRefresh() {
    setIsRefreshing(true);
    await loadProfiles();
    setIsRefreshing(false);
  }

  async function handleFollow(profile: UserProfile) {
    if (!session || busyProfileId) {
      return;
    }

    const shouldFollow = profile.followState === 'none';
    const nextFollowState = shouldFollow
      ? profile.isPrivate
        ? 'requested'
        : 'following'
      : 'none';
    setProfiles((current) =>
      current.map((item) =>
        item.id === profile.id ? { ...item, followState: nextFollowState } : item,
      ),
    );
    setBusyProfileId(profile.id);
    try {
      const queued = await submitFollow({
        targetId: profile.id,
        userId: session.user.id,
        shouldFollow,
      });
      if (!queued) {
        await loadProfiles();
      }
    } catch (followError: unknown) {
      setProfiles((current) =>
        current.map((item) =>
          item.id === profile.id ? { ...item, followState: profile.followState } : item,
        ),
      );
      Alert.alert(
        'No se pudo actualizar',
        followError instanceof Error ? followError.message : 'Intenta nuevamente.',
      );
    } finally {
      setBusyProfileId(null);
    }
  }

  async function handleMessage(profile: UserProfile) {
    if (busyMessageId) return;
    setBusyMessageId(profile.id);
    try {
      const conversationId = await getOrCreateConversation(profile.id);
      router.push({ pathname: '/messages/[conversationId]', params: { conversationId } });
    } catch (messageError: unknown) {
      Alert.alert('No se pudo abrir el chat', messageError instanceof Error ? messageError.message : 'Intenta nuevamente.');
    } finally {
      setBusyMessageId(null);
    }
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <Pressable onPress={() => router.push('/messages')} style={styles.inboxButton}>
        <Text style={styles.inboxText}>Abrir mensajes</Text>
      </Pressable>
      <TextInput
        autoCapitalize="none"
        onChangeText={setSearch}
        placeholder="Buscar personas"
        placeholderTextColor={colors.muted}
        style={styles.search}
        value={search}
      />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={visibleProfiles}
          keyExtractor={(profile) => profile.id}
          refreshControl={
            <RefreshControl
              colors={[colors.primary]}
              onRefresh={handleRefresh}
              refreshing={isRefreshing}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              {error ?? (search ? 'No se encontraron personas.' : 'No hay otros usuarios todavía.')}
            </Text>
          }
          renderItem={({ item }) => (
            <ProfileRow
              isBusy={busyProfileId === item.id}
              isMessageBusy={busyMessageId === item.id}
              onMessage={() => handleMessage(item)}
              onOpenProfile={() =>
                router.push({ pathname: '/profile/[userId]', params: { userId: item.id } })
              }
              onPress={() => handleFollow(item)}
              profile={item}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function ProfileRow({
  profile,
  isBusy,
  isMessageBusy,
  onMessage,
  onOpenProfile,
  onPress,
}: {
  profile: UserProfile;
  isBusy: boolean;
  isMessageBusy: boolean;
  onMessage: () => void;
  onOpenProfile: () => void;
  onPress: () => void;
}) {
  const buttonLabel =
    profile.followState === 'following'
      ? 'Siguiendo'
      : profile.followState === 'requested'
        ? 'Solicitado'
        : profile.isPrivate
          ? 'Solicitar'
          : 'Seguir';

  return (
    <View style={styles.profileCard}>
      <Pressable onPress={onOpenProfile} style={styles.profileIdentity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile.displayName.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.profileText}>
          <Text style={styles.name}>{profile.displayName}</Text>
          <Text numberOfLines={1} style={styles.username}>
            @{profile.username}{profile.isPrivate ? ' · Privado' : ''}
          </Text>
          {profile.bio ? (
            <Text numberOfLines={2} style={styles.bio}>
              {profile.bio}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <View style={styles.rowActions}>
        <Pressable disabled={isMessageBusy} onPress={onMessage} style={styles.messageButton}>
          {isMessageBusy ? <ActivityIndicator color={colors.primary} size="small" /> : <Text style={styles.messageText}>Mensaje</Text>}
        </Pressable>
        <Pressable
          disabled={isBusy}
          onPress={onPress}
          style={({ pressed }) => [styles.followButton, profile.followState !== 'none' && styles.followButtonSecondary, pressed && styles.pressed]}
        >
          {isBusy ? <ActivityIndicator color={colors.primary} size="small" /> : <Text style={[styles.followText, profile.followState !== 'none' && styles.followTextSecondary]}>{buttonLabel}</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarText: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  bio: { color: colors.text, fontSize: 13, marginTop: 3 },
  centered: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  empty: { color: colors.muted, paddingTop: 48, textAlign: 'center' },
  followButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 92,
    paddingHorizontal: 12,
  },
  followButtonSecondary: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.border,
    borderWidth: 1,
  },
  followText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  followTextSecondary: { color: colors.primary },
  inboxButton: { alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: 12, marginHorizontal: 16, marginTop: 16, padding: 12 },
  inboxText: { color: colors.primary, fontWeight: '800' },
  list: { flexGrow: 1, gap: 10, padding: 16, paddingTop: 4 },
  name: { color: colors.text, fontSize: 15, fontWeight: '800' },
  messageButton: { alignItems: 'center', borderColor: colors.primary, borderRadius: 9, borderWidth: 1, minWidth: 92, padding: 7 },
  messageText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.8 },
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  profileIdentity: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 12 },
  profileText: { flex: 1 },
  rowActions: { gap: 6 },
  safeArea: { backgroundColor: colors.background, flex: 1 },
  search: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    margin: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  username: { color: colors.muted, fontSize: 13 },
});
