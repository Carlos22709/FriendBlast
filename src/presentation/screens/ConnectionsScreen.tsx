import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listProfileConnections } from '@/application/profiles';
import type {
  ConnectionKind,
  ProfileConnection,
} from '@/domain/models/ProfileDetails';
import { colors } from '@/presentation/theme/colors';

export function ConnectionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    userId?: string | string[];
    kind?: string | string[];
  }>();
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const rawKind = Array.isArray(params.kind) ? params.kind[0] : params.kind;
  const kind: ConnectionKind | null =
    rawKind === 'followers' || rawKind === 'following' ? rawKind : null;
  const [connections, setConnections] = useState<ProfileConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    if (!userId || !kind) {
      setError('Lista no válida.');
      setIsLoading(false);
      return;
    }

    try {
      setConnections(await listProfileConnections(userId, kind));
      setError(null);
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No tienes permiso para ver esta lista.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [kind, userId]);

  useFocusEffect(
    useCallback(() => {
      void loadConnections();
    }, [loadConnections]),
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.list}
        data={connections}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {error ?? (kind === 'followers' ? 'Aún no tiene seguidores.' : 'Aún no sigue a nadie.')}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({ pathname: '/profile/[userId]', params: { userId: item.id } })
            }
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.displayName.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.displayName}</Text>
              <Text style={styles.username}>
                @{item.username}{item.isPrivate ? ' · Privado' : ''}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  avatarText: { color: colors.primary, fontWeight: '900' },
  centered: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  empty: { color: colors.muted, paddingTop: 48, textAlign: 'center' },
  info: { flex: 1 },
  list: { flexGrow: 1, gap: 10, padding: 16 },
  name: { color: colors.text, fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.75 },
  row: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  safeArea: { backgroundColor: colors.background, flex: 1 },
  username: { color: colors.muted, fontSize: 13, marginTop: 2 },
});
