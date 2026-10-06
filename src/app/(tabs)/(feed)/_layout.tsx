import { Stack } from 'expo-router';

// Pantalla base de la pestaña: queda debajo de cualquier ruta abierta
// por enlace profundo para que el botón atrás vuelva a ella.
export const unstable_settings = { anchor: 'feed' };

export default function FeedLayout() {
  return (
    <Stack>
      <Stack.Screen name="feed" options={{ headerTitle: 'FriendBlast' }} />
      <Stack.Screen
        name="create"
        options={{ headerTitle: 'Nueva publicación', presentation: 'modal' }}
      />
      <Stack.Screen
        name="stories/create"
        options={{ headerTitle: 'Nueva historia', presentation: 'modal' }}
      />
      <Stack.Screen name="stories/[storyId]" options={{ headerShown: false }} />
    </Stack>
  );
}

