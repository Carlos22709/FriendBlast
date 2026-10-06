import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { listActiveStories, listViewedStoryIds } from '@/application/stories';
import type { Story } from '@/domain/models/Story';
import { CachedImage } from '@/presentation/components/CachedImage';
import { useAuth } from '@/presentation/providers/AuthProvider';
import { colors } from '@/presentation/theme/colors';

export function StoriesStrip() {
  const router = useRouter();
  const database = useSQLiteContext();
  const { session } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        try {
          const items = await listActiveStories();
          const viewed = session
            ? await listViewedStoryIds(database, session.user.id)
            : [];

          if (active) {
            setStories(items);
            setViewedIds(new Set(viewed));
          }
        } catch (error: unknown) {
          console.warn(
            'No se pudieron cargar las historias:',
            error instanceof Error ? error.message : error,
          );
        }
      })();

      return () => {
        active = false;
      };
    }, [database, session]),
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Historias</Text>
      <ScrollView
        contentContainerStyle={styles.list}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/feed/stories/create')}
          style={({ pressed }) => [styles.item, pressed && styles.pressed]}
        >
          <View style={[styles.circle, styles.createCircle]}>
            <Text style={styles.plus}>+</Text>
          </View>
          <Text numberOfLines={1} style={styles.name}>
            Tu historia
          </Text>
        </Pressable>

        {stories.map((story) => {
          const wasViewed = viewedIds.has(story.id);

          return (
            <Pressable
              accessibilityRole="button"
              key={story.id}
              onPress={() =>
                router.push({
                  pathname: '/feed/stories/[storyId]',
                  params: { storyId: story.id },
                })
              }
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              <View style={[styles.circle, wasViewed && styles.circleViewed]}>
                <CachedImage
                  cacheKey={`story-thumb-${story.id}`}
                  remoteUrl={story.imageUrl}
                  style={styles.image}
                />
              </View>
              <Text numberOfLines={1} style={[styles.name, wasViewed && styles.nameViewed]}>
                {story.displayName}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderRadius: 34,
    borderWidth: 3,
    height: 68,
    overflow: 'hidden',
    padding: 2,
    width: 68,
  },
  circleViewed: { borderColor: colors.border },
  container: { gap: 8 },
  createCircle: { alignItems: 'center', justifyContent: 'center' },
  image: { borderRadius: 29, height: '100%', width: '100%' },
  item: { alignItems: 'center', gap: 5, width: 76 },
  list: { gap: 8 },
  name: { color: colors.text, fontSize: 12, textAlign: 'center', width: 76 },
  nameViewed: { color: colors.muted },
  plus: { color: colors.primary, fontSize: 32, fontWeight: '500' },
  pressed: { opacity: 0.75 },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
});
