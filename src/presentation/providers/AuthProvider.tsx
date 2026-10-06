import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';

import {
  getCurrentSession,
  isSupabaseConfigured,
  setAuthAutoRefresh,
  signInWithEmail,
  signOut as signOutFromSupabase,
  signUpWithEmail,
  subscribeToAuthState,
} from '@/application/auth';

type SignUpResult = {
  requiresEmailConfirmation: boolean;
};

type AuthContextValue = {
  isConfigured: boolean;
  isLoading: boolean;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (displayName: string, email: string, password: string) => Promise<SignUpResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    let isMounted = true;

    void getCurrentSession()
      .then((currentSession) => {
        if (isMounted) {
          setSession(currentSession);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setSession(null);
          setIsLoading(false);
        }
      });

    const unsubscribeAuth = subscribeToAuthState((nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    const appStateListener =
      Platform.OS === 'web'
        ? null
        : AppState.addEventListener('change', (state) => {
            if (state === 'active') {
              setAuthAutoRefresh(true);
            } else {
              setAuthAutoRefresh(false);
            }
          });

    return () => {
      isMounted = false;
      unsubscribeAuth();
      appStateListener?.remove();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmail(email.trim(), password);
  }, []);

  const signUp = useCallback(
    async (displayName: string, email: string, password: string) =>
      signUpWithEmail(displayName.trim(), email.trim(), password),
    [],
  );

  const signOut = useCallback(async () => {
    await signOutFromSupabase();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isConfigured: isSupabaseConfigured,
      isLoading,
      session,
      signIn,
      signOut,
      signUp,
    }),
    [isLoading, session, signIn, signOut, signUp],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de AuthProvider.');
  }

  return context;
}
