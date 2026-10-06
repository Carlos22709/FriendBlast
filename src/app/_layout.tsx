import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { migrateDatabase } from '@/application/database';
import { AuthProvider, useAuth } from '@/presentation/providers/AuthProvider';
import { SyncProvider } from '@/presentation/providers/SyncProvider';
import { colors } from '@/presentation/theme/colors';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="friendblast.db" onInit={migrateDatabase}>
      <AuthProvider>
        <SyncProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </SyncProvider>
      </AuthProvider>
    </SQLiteProvider>
  );
}

function RootNavigator() {
  const { isLoading, session } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={Boolean(session)}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="post/[postId]" />
        <Stack.Screen name="profile/[userId]" />
        <Stack.Screen name="connections/[userId]/[kind]" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
