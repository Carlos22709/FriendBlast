import { Stack } from 'expo-router';

// Pantalla base de la pestaña: queda debajo de cualquier ruta abierta
// por enlace profundo para que el botón atrás vuelva a ella.
export const unstable_settings = { anchor: 'activity' };

export default function ActivityLayout() {
  return (
    <Stack>
      <Stack.Screen name="activity" options={{ headerTitle: 'Actividad' }} />
    </Stack>
  );
}
