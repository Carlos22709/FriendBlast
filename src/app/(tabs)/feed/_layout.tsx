import { Stack } from 'expo-router';

export default function FeedLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerTitle: 'FriendBlast' }} />
      <Stack.Screen
        name="create"
        options={{ headerTitle: 'Nueva publicación', presentation: 'modal' }}
      />
      <Stack.Screen name="[postId]" options={{ headerTitle: 'Comentarios' }} />
      <Stack.Screen
        name="stories/create"
        options={{ headerTitle: 'Nueva historia', presentation: 'modal' }}
      />
      <Stack.Screen name="stories/[storyId]" options={{ headerShown: false }} />
    </Stack>
  );
}

