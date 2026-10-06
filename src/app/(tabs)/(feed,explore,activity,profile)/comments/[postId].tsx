import { Stack } from 'expo-router';

import { CommentsScreen } from '@/presentation/screens/CommentsScreen';

export default function CommentsRoute() {
  return (
    <>
      <Stack.Screen options={{ headerTitle: 'Comentarios' }} />
      <CommentsScreen />
    </>
  );
}
