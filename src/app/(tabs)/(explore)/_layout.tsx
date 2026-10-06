import { Stack } from 'expo-router';

// Pantalla base de la pestaña: queda debajo de cualquier ruta abierta
// por enlace profundo para que el botón atrás vuelva a ella.
export const unstable_settings = { anchor: 'explore' };

export default function ExploreLayout() {
  return (
    <Stack>
      <Stack.Screen name="explore" options={{ headerTitle: 'Explorar' }} />
      <Stack.Screen name="messages/index" options={{ headerTitle: 'Mensajes' }} />
      <Stack.Screen name="messages/[conversationId]" options={{ headerTitle: 'Chat' }} />
    </Stack>
  );
}
