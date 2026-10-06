import { Stack } from 'expo-router';

export default function ExploreLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerTitle: 'Explorar' }} />
      <Stack.Screen name="messages/index" options={{ headerTitle: 'Mensajes' }} />
      <Stack.Screen name="messages/[conversationId]" options={{ headerTitle: 'Chat' }} />
    </Stack>
  );
}
