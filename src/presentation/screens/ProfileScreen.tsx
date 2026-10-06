import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMyProfile, updateMyProfile } from '@/application/profiles';
import type { MyProfile } from '@/domain/models/MyProfile';
import { useAuth } from '@/presentation/providers/AuthProvider';
import { colors } from '@/presentation/theme/colors';

export function ProfileScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!session) {
      return;
    }

    try {
      const nextProfile = await getMyProfile(session.user.id);
      setProfile(nextProfile);
      setDisplayName(nextProfile.displayName);
      setUsername(nextProfile.username);
      setBio(nextProfile.bio);
      setIsPrivate(nextProfile.isPrivate);
      setError(null);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el perfil.');
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  async function handleSave() {
    if (!session) {
      return;
    }

    if (displayName.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.');
      return;
    }

    if (!/^[a-z0-9_]{3,24}$/.test(username.trim().toLowerCase())) {
      setError('El usuario debe tener entre 3 y 24 letras, números o guiones bajos.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await updateMyProfile(session.user.id, { displayName, username, bio, isPrivate });
      await loadProfile();
      Alert.alert('Perfil guardado', 'Tus cambios se actualizaron correctamente.');
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el perfil.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
    } catch (signOutError: unknown) {
      Alert.alert(
        'No se pudo cerrar la sesión',
        signOutError instanceof Error ? signOutError.message : 'Intenta nuevamente.',
      );
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(displayName || 'U').slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.email}>{session?.user.email}</Text>

          <View style={styles.stats}>
            <Stat label="Publicaciones" value={profile?.postCount ?? 0} />
            <Stat
              label="Seguidores"
              onPress={() =>
                session &&
                router.push({
                  pathname: '/connections/[userId]/[kind]',
                  params: { userId: session.user.id, kind: 'followers' },
                })
              }
              value={profile?.followerCount ?? 0}
            />
            <Stat
              label="Siguiendo"
              onPress={() =>
                session &&
                router.push({
                  pathname: '/connections/[userId]/[kind]',
                  params: { userId: session.user.id, kind: 'following' },
                })
              }
              value={profile?.followingCount ?? 0}
            />
          </View>

          <Text style={styles.label}>Nombre</Text>
          <TextInput
            maxLength={50}
            onChangeText={setDisplayName}
            placeholder="Tu nombre"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={displayName}
          />

          <Text style={styles.label}>Usuario</Text>
          <TextInput
            autoCapitalize="none"
            maxLength={24}
            onChangeText={setUsername}
            placeholder="usuario"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={username}
          />

          <Text style={styles.label}>Biografía</Text>
          <TextInput
            maxLength={160}
            multiline
            onChangeText={setBio}
            placeholder="Cuéntanos algo sobre ti"
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.bioInput]}
            value={bio}
          />

          <View style={styles.privacyRow}>
            <View style={styles.privacyText}>
              <Text style={styles.privacyTitle}>Perfil privado</Text>
              <Text style={styles.privacyDescription}>
                Las personas deberán enviarte una solicitud.
              </Text>
            </View>
            <Switch
              onValueChange={setIsPrivate}
              thumbColor="#FFFFFF"
              trackColor={{ false: colors.border, true: colors.primary }}
              value={isPrivate}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            disabled={isSaving}
            onPress={handleSave}
            style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveText}>Guardar cambios</Text>
            )}
          </Pressable>

          <Pressable
            onPress={handleSignOut}
            style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}
          >
            <Text style={styles.signOutText}>Cerrar sesión</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Stat({ label, value, onPress }: { label: string; value: number; onPress?: () => void }) {
  const content = (
    <>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </>
  );

  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.stat, pressed && styles.pressed]}>
      {content}
    </Pressable>
  ) : (
    <View style={styles.stat}>{content}</View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 42,
    height: 84,
    justifyContent: 'center',
    width: 84,
  },
  avatarText: { color: colors.primary, fontSize: 34, fontWeight: '900' },
  bioInput: { minHeight: 90, textAlignVertical: 'top' },
  centered: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  container: { padding: 20, paddingBottom: 40 },
  email: { color: colors.muted, marginTop: 10, textAlign: 'center' },
  error: { color: '#B42318', marginTop: 14, textAlign: 'center' },
  flex: { flex: 1 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    padding: 13,
  },
  label: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 7, marginTop: 16 },
  pressed: { opacity: 0.8 },
  privacyDescription: { color: colors.muted, fontSize: 12, marginTop: 3 },
  privacyRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 18,
    padding: 14,
  },
  privacyText: { flex: 1, paddingRight: 12 },
  privacyTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  safeArea: { backgroundColor: colors.background, flex: 1 },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 13,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 50,
  },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  signOutButton: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 48,
  },
  signOutText: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  stat: { alignItems: 'center', flex: 1 },
  statLabel: { color: colors.muted, fontSize: 11, marginTop: 2 },
  stats: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 20,
    paddingVertical: 14,
  },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '900' },
});
