import { Stack } from 'expo-router';

// Pantalla base de la pestaña: queda debajo de cualquier ruta abierta
// por enlace profundo para que el botón atrás vuelva a ella.
export const unstable_settings = { anchor: 'profile' };

export default function ProfileLayout() {
  return (
    <Stack>
      <Stack.Screen name="profile" options={{ headerTitle: 'Perfil' }} />
    </Stack>
  );
}
