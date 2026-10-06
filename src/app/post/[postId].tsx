import { Stack } from 'expo-router';

import { PostDetailScreen } from '@/presentation/screens/PostDetailScreen';

export default function PostDetailRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: true, headerTitle: 'Publicación' }} />
      <PostDetailScreen />
    </>
  );
}
