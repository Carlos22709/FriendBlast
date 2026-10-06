import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/presentation/providers/AuthProvider';
import { colors } from '@/presentation/theme/colors';

type AuthScreenProps = {
  mode: 'sign-in' | 'sign-up';
};

export function AuthScreen({ mode }: AuthScreenProps) {
  const { isConfigured, signIn, signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSignUp = mode === 'sign-up';

  async function handleSubmit() {
    setErrorMessage(null);

    if (!isConfigured) {
      setErrorMessage('Guarda las variables de Supabase en el archivo .env y reinicia Expo.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Escribe un correo válido.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (isSignUp && !displayName.trim()) {
      setErrorMessage('Escribe tu nombre.');
      return;
    }

    if (isSignUp && password !== passwordConfirmation) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isSignUp) {
        const result = await signUp(displayName, email, password);

        if (result.requiresEmailConfirmation) {
          setErrorMessage('Revisa tu correo para confirmar la cuenta y después inicia sesión.');
          return;
        }
      } else {
        await signIn(email, password);
      }

      router.replace('/');
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible completar la acción.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function changeMode() {
    router.push(isSignUp ? '/sign-in' : '/sign-up');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.brand}>FriendBlast</Text>
          <Text style={styles.title}>{isSignUp ? 'Crear cuenta' : 'Bienvenido'}</Text>
          <Text style={styles.subtitle}>
            {isSignUp
              ? 'Crea tu perfil para compartir fotografías.'
              : 'Entra para continuar viendo a tus amigos.'}
          </Text>

          <View style={styles.form}>
            {isSignUp ? (
              <AuthField
                autoCapitalize="words"
                label="Nombre"
                onChangeText={setDisplayName}
                placeholder="Carlos"
                value={displayName}
              />
            ) : null}

            <AuthField
              autoCapitalize="none"
              keyboardType="email-address"
              label="Correo"
              onChangeText={setEmail}
              placeholder="correo@ejemplo.com"
              value={email}
            />

            <AuthField
              autoCapitalize="none"
              label="Contraseña"
              onChangeText={setPassword}
              placeholder="Mínimo 6 caracteres"
              secureTextEntry
              value={password}
            />

            {isSignUp ? (
              <AuthField
                autoCapitalize="none"
                label="Repetir contraseña"
                onChangeText={setPasswordConfirmation}
                placeholder="Repite tu contraseña"
                secureTextEntry
                value={passwordConfirmation}
              />
            ) : null}

            {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={handleSubmit}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
                isSubmitting && styles.buttonDisabled,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
                </Text>
              )}
            </Pressable>

            <Pressable accessibilityRole="button" onPress={changeMode} style={styles.linkButton}>
              <Text style={styles.linkText}>
                {isSignUp ? 'Ya tengo una cuenta' : 'Crear una cuenta'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type AuthFieldProps = {
  autoCapitalize: 'none' | 'words';
  keyboardType?: 'default' | 'email-address';
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  value: string;
};

function AuthField({ label, ...inputProps }: AuthFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={styles.input}
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  brand: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  title: {
    marginTop: 10,
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 16,
    lineHeight: 23,
  },
  form: {
    marginTop: 30,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 7,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 15,
  },
  error: {
    marginBottom: 14,
    color: '#B3261E',
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '800',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  linkButton: {
    alignItems: 'center',
    padding: 18,
  },
  linkText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
});
