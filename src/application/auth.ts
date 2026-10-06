import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/data/remote/supabase';

export {
  getCurrentSession,
  signInWithEmail,
  signOut,
  signUpWithEmail,
} from '@/data/repositories/authRepository';

export { isSupabaseConfigured };

export function subscribeToAuthState(listener: (session: Session | null) => void) {
  if (!supabase) {
    return () => {};
  }

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    listener(session);
  });
  return () => data.subscription.unsubscribe();
}

export function setAuthAutoRefresh(enabled: boolean) {
  if (!supabase) {
    return;
  }

  if (enabled) {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
}
