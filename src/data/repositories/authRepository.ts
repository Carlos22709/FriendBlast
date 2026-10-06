import type { Session } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/data/remote/supabase';

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await getSupabaseClient().auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await getSupabaseClient().auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }
}

export async function signUpWithEmail(
  displayName: string,
  email: string,
  password: string,
) {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      },
    },
  });

  if (error) {
    throw error;
  }

  return {
    requiresEmailConfirmation: data.session === null,
  };
}

export async function signOut() {
  const { error } = await getSupabaseClient().auth.signOut();

  if (error) {
    throw error;
  }
}
