import { Redirect } from 'expo-router';

import { useAuth } from '@/presentation/providers/AuthProvider';

export default function IndexScreen() {
  const { session } = useAuth();

  return <Redirect href={session ? '/feed' : '/sign-in'} />;
}
