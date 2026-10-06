import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  listConversations,
  markInboxDelivered,
  subscribeToInbox,
} from '@/application/messages';
import type { Conversation } from '@/domain/models/Conversation';
import { useAuth } from '@/presentation/providers/AuthProvider';
import { colors } from '@/presentation/theme/colors';

export function MessagesScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    if (!session) {
      return;
    }

    try {
      await markInboxDelivered();
      setConversations(await listConversations());
      setError(null);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar.');
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void loadConversations();
    }, [loadConversations]),
  );

  useEffect(() => subscribeToInbox(() => void loadConversations()), [loadConversations]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.list}
        data={conversations}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.empty}>{error ?? 'Aún no tienes conversaciones.'}</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/messages/[conversationId]',
                params: { conversationId: item.id },
              })
            }
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.displayName[0]?.toUpperCase()}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.displayName}</Text>
              <Text numberOfLines={1} style={styles.preview}>
                {item.lastMessage}
              </Text>
            </View>
            <Text style={styles.date}>
              {new Date(item.updatedAt).toLocaleDateString('es-CO')}
            </Text>
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
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    padding: 12,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  date: { color: colors.muted, fontSize: 11 },
  empty: { color: colors.muted, paddingTop: 48, textAlign: 'center' },
  info: { flex: 1 },
  list: { flexGrow: 1, gap: 10, padding: 16 },
  name: { color: colors.text, fontWeight: '800' },
  pressed: { opacity: 0.8 },
  preview: { color: colors.muted, marginTop: 3 },
  safeArea: { backgroundColor: colors.background, flex: 1 },
});
