import type { ImagePickerAsset } from 'expo-image-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createStory } from '@/application/stories';
import { useAuth } from '@/presentation/providers/AuthProvider';
import { colors } from '@/presentation/theme/colors';

export function CreateStoryScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [image, setImage] = useState<ImagePickerAsset | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChooseImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permiso necesario', 'Permite el acceso a tus fotos para crear una historia.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [9, 16],
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0]);
      setError(null);
    }
  }

  async function handlePublish() {
    if (!session || !image) {
      setError('Selecciona una imagen.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await createStory({
        userId: session.user.id,
        imageUri: image.uri,
        fileName: image.fileName,
        mimeType: image.mimeType,
      });
      router.back();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo publicar la historia.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <View style={styles.content}>
        <Pressable
          accessibilityRole="button"
          onPress={handleChooseImage}
          style={({ pressed }) => [styles.picker, pressed && styles.pressed]}
        >
          {image ? (
            <Image resizeMode="cover" source={{ uri: image.uri }} style={styles.preview} />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.plus}>+</Text>
              <Text style={styles.placeholderTitle}>Seleccionar una foto</Text>
              <Text style={styles.help}>La historia estará disponible durante 24 horas.</Text>
            </View>
          )}
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={!image || isSaving}
          onPress={handlePublish}
          style={({ pressed }) => [
            styles.button,
            (!image || isSaving) && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Publicar historia</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: 14,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  content: { flex: 1, gap: 16, padding: 16 },
  disabled: { opacity: 0.5 },
  error: { color: '#B42318', textAlign: 'center' },
  help: { color: colors.muted, textAlign: 'center' },
  picker: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    overflow: 'hidden',
  },
  placeholder: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
    justifyContent: 'center',
    padding: 24,
  },
  placeholderTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  plus: { color: colors.primary, fontSize: 44 },
  pressed: { opacity: 0.8 },
  preview: { height: '100%', width: '100%' },
  safeArea: { backgroundColor: colors.background, flex: 1 },
});
