import type { ImagePickerAsset } from 'expo-image-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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

import { createPost } from '@/application/posts';
import { useAuth } from '@/presentation/providers/AuthProvider';
import { colors } from '@/presentation/theme/colors';

export function CreatePostScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [image, setImage] = useState<ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChooseImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permiso necesario', 'Permite el acceso a tus fotos para publicar una imagen.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
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
      await createPost({
        userId: session.user.id,
        caption,
        imageUri: image.uri,
        fileName: image.fileName,
        mimeType: image.mimeType,
      });
      router.back();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo publicar la foto.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable
            accessibilityRole="button"
            onPress={handleChooseImage}
            style={({ pressed }) => [styles.imagePicker, pressed && styles.pressed]}
          >
            {image ? (
              <Image source={{ uri: image.uri }} style={styles.preview} />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderIcon}>＋</Text>
                <Text style={styles.placeholderTitle}>Seleccionar una foto</Text>
                <Text style={styles.placeholderText}>Se recortará en formato cuadrado.</Text>
              </View>
            )}
          </Pressable>

          <TextInput
            maxLength={500}
            multiline
            onChangeText={setCaption}
            placeholder="Escribe una descripción..."
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={caption}
          />
          <Text style={styles.counter}>{caption.length}/500</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={!image || isSaving}
            onPress={handlePublish}
            style={({ pressed }) => [
              styles.publishButton,
              (!image || isSaving) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.publishText}>Publicar</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  counter: { color: colors.muted, fontSize: 12, marginTop: 6, textAlign: 'right' },
  disabled: { opacity: 0.45 },
  error: { color: '#B42318', marginTop: 14, textAlign: 'center' },
  flex: { flex: 1 },
  imagePicker: {
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    marginTop: 16,
    minHeight: 110,
    padding: 14,
    textAlignVertical: 'top',
  },
  placeholder: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
  placeholderIcon: { color: colors.primary, fontSize: 48, fontWeight: '300' },
  placeholderText: { color: colors.muted, marginTop: 6, textAlign: 'center' },
  placeholderTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  pressed: { opacity: 0.8 },
  preview: { height: '100%', width: '100%' },
  publishButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    marginTop: 18,
    minHeight: 52,
    justifyContent: 'center',
  },
  publishText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  safeArea: { backgroundColor: colors.background, flex: 1 },
});
