import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listActiveStories, markStoryViewed } from '@/application/stories';
import type { Story } from '@/domain/models/Story';
import { CachedImage } from '@/presentation/components/CachedImage';
import { useAuth } from '@/presentation/providers/AuthProvider';

const STORY_DURATION_MS = 5000;

export function StoryScreen() {
  const router = useRouter();
  const database = useSQLiteContext();
  const { session } = useAuth();
  const { storyId } = useLocalSearchParams<{ storyId?: string | string[] }>();
  const validStoryId = Array.isArray(storyId) ? storyId[0] : storyId;
  const [stories, setStories] = useState<Story[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(Boolean(validStoryId));
  const [error, setError] = useState<string | null>(
    validStoryId ? null : 'Historia no encontrada.',
  );
  const [progress] = useState(() => new Animated.Value(0));
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const remainingMsRef = useRef(STORY_DURATION_MS);
  const startedAtRef = useRef(0);
  const currentStory = stories[currentIndex] ?? null;

  useEffect(() => {
    if (!validStoryId) {
      return;
    }

    void listActiveStories()
      .then((items) => {
        const startingIndex = items.findIndex((item) => item.id === validStoryId);
        if (startingIndex < 0) {
          setError('Esta historia ya no está disponible.');
          return;
        }

        setStories(items);
        setCurrentIndex(startingIndex);
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error ? loadError.message : 'No se pudo abrir la historia.',
        );
      })
      .finally(() => setIsLoading(false));
  }, [validStoryId]);

  useEffect(() => {
    if (!currentStory || !session) {
      return;
    }

    void markStoryViewed(database, session.user.id, currentStory.id).catch(
      (viewError: unknown) => {
        console.warn(
          'No se pudo guardar la historia como vista:',
          viewError instanceof Error ? viewError.message : viewError,
        );
      },
    );
  }, [currentStory, database, session]);

  const showNextStory = useCallback(() => {
    setCurrentIndex((index) => {
      if (index + 1 < stories.length) {
        return index + 1;
      }

      router.back();
      return index;
    });
  }, [router, stories.length]);

  const resumePlayback = useCallback(() => {
    if (!currentStory || animationRef.current || remainingMsRef.current <= 0) {
      return;
    }

    startedAtRef.current = Date.now();
    const animation = Animated.timing(progress, {
      duration: remainingMsRef.current,
      toValue: 1,
      useNativeDriver: false,
    });
    animationRef.current = animation;

    animation.start(({ finished }) => {
      animationRef.current = null;
      if (finished) {
        showNextStory();
      }
    });
  }, [currentStory, progress, showNextStory]);

  const pausePlayback = useCallback(() => {
    if (!animationRef.current) {
      return;
    }

    animationRef.current.stop();
    animationRef.current = null;
    remainingMsRef.current = Math.max(
      0,
      remainingMsRef.current - (Date.now() - startedAtRef.current),
    );
  }, []);

  useEffect(() => {
    if (!currentStory) {
      return;
    }

    progress.setValue(0);
    remainingMsRef.current = STORY_DURATION_MS;
    resumePlayback();

    return () => {
      animationRef.current?.stop();
      animationRef.current = null;
    };
  }, [currentStory, progress, resumePlayback]);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <Pressable onPressIn={pausePlayback} onPressOut={resumePlayback} style={styles.viewer}>
        {isLoading ? <ActivityIndicator color="#FFFFFF" size="large" /> : null}

        {currentStory ? (
          <>
            <View style={styles.progressRow}>
              {stories.map((item, index) => (
                <View key={item.id} style={styles.progressTrack}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        width:
                          index < currentIndex
                            ? '100%'
                            : index > currentIndex
                              ? '0%'
                              : progressWidth,
                      },
                    ]}
                  />
                </View>
              ))}
            </View>
            <View style={styles.header}>
              <Text style={styles.author}>{currentStory.displayName}</Text>
              <Pressable accessibilityRole="button" onPress={() => router.back()}>
                <Text style={styles.close}>×</Text>
              </Pressable>
            </View>
            <CachedImage
              cacheKey={`story-${currentStory.id}`}
              remoteUrl={currentStory.imageUrl}
              resizeMode="contain"
              style={styles.image}
            />
            <Text style={styles.help}>Mantén presionado para pausar.</Text>
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  author: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  close: { color: '#FFFFFF', fontSize: 34, lineHeight: 34 },
  error: { color: '#FFFFFF', padding: 24, textAlign: 'center' },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: '100%',
  },
  help: { color: '#D6D6DC', padding: 16, textAlign: 'center' },
  image: { flex: 1, width: '100%' },
  progressFill: { backgroundColor: '#FFFFFF', borderRadius: 2, height: '100%' },
  progressRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingTop: 8 },
  progressTrack: {
    backgroundColor: '#55555C',
    borderRadius: 2,
    flex: 1,
    height: 3,
    overflow: 'hidden',
  },
  safeArea: { backgroundColor: '#000000', flex: 1 },
  viewer: { flex: 1 },
});
