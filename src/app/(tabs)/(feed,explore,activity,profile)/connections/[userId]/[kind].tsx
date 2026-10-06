import { Stack, useLocalSearchParams } from 'expo-router';

import { ConnectionsScreen } from '@/presentation/screens/ConnectionsScreen';

export default function ConnectionsRoute() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const title = kind === 'following' ? 'Siguiendo' : 'Seguidores';

  return (
    <>
      <Stack.Screen options={{ headerTitle: title }} />
      <ConnectionsScreen />
    </>
  );
}
