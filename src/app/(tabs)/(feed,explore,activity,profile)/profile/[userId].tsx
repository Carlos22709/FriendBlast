import { Stack } from 'expo-router';

import { ProfileDetailsScreen } from '@/presentation/screens/ProfileDetailsScreen';

export default function ProfileDetailsRoute() {
  return (
    <>
      <Stack.Screen options={{ headerTitle: 'Perfil' }} />
      <ProfileDetailsScreen />
    </>
  );
}
