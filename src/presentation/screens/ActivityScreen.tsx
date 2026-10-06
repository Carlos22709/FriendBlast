import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  listFollowRequests,
  respondToFollowRequest,
} from '@/application/profiles';
import type { FollowRequest } from '@/domain/models/FollowRequest';
import { useAuth } from '@/presentation/providers/AuthProvider';
import { colors } from '@/presentation/theme/colors';

export function ActivityScreen() {
  const { session } = useAuth();
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    if (!session) {
      return;
    }

    try {
      setRequests(await listFollowRequests(session.user.id));
      setError(null);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la actividad.');
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void loadRequests();
    }, [loadRequests]),
  );

  async function handleRefresh() {
    setIsRefreshing(true);
    await loadRequests();
    setIsRefreshing(false);
  }

  async function handleResponse(requesterId: string, accept: boolean) {
    if (busyId) {
      return;
    }

    setBusyId(requesterId);
    try {
      await respondToFollowRequest(requesterId, accept);
      setRequests((current) =>
        current.filter((request) => request.requesterId !== requesterId),
      );
    } catch (responseError: unknown) {
      Alert.alert(
        'No se pudo responder',
        responseError instanceof Error ? responseError.message : 'Intenta nuevamente.',
      );
    } finally {
      setBusyId(null);
    }
  }

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
        contentContainerStyle={styles.list}
        data={requests}
        keyExtractor={(request) => request.requesterId}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={handleRefresh}
            refreshing={isRefreshing}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={<Text style={styles.title}>Solicitudes de seguimiento</Text>}
        ListEmptyComponent={
          <Text style={styles.empty}>{error ?? 'No tienes solicitudes pendientes.'}</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.displayName.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.displayName}</Text>
              <Text style={styles.username}>@{item.username} quiere seguirte</Text>
            </View>
            {busyId === item.requesterId ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <View style={styles.actions}>
                <Pressable
                  onPress={() => handleResponse(item.requesterId, true)}
                  style={({ pressed }) => [styles.acceptButton, pressed && styles.pressed]}
                >
                  <Text style={styles.acceptText}>Aceptar</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleResponse(item.requesterId, false)}
                  style={({ pressed }) => [styles.rejectButton, pressed && styles.pressed]}
                >
                  <Text style={styles.rejectText}>Rechazar</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  acceptButton: { backgroundColor: colors.primary, borderRadius: 9, padding: 8 },
  acceptText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  actions: { gap: 6 },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  avatarText: { color: colors.primary, fontWeight: '800' },
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
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
  pressed: { opacity: 0.8 },
  rejectButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 9,
    borderWidth: 1,
    padding: 7,
  },
  rejectText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  safeArea: { backgroundColor: colors.background, flex: 1 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 4 },
  username: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
