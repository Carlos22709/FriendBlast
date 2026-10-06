import type { SQLiteDatabase } from 'expo-sqlite';

type ViewedStoryRow = {
  story_id: string;
};

export async function listViewedStoryIds(database: SQLiteDatabase, userId: string) {
  const rows = await database.getAllAsync<ViewedStoryRow>(
    'SELECT story_id FROM viewed_stories WHERE user_id = ?',
    userId,
  );

  return rows.map((row) => row.story_id);
}

export async function markStoryViewed(
  database: SQLiteDatabase,
  userId: string,
  storyId: string,
) {
  await database.runAsync(
    `INSERT INTO viewed_stories (user_id, story_id, viewed_at)
     VALUES (?, ?, ?)
     ON CONFLICT (user_id, story_id)
     DO UPDATE SET viewed_at = excluded.viewed_at`,
    userId,
    storyId,
    Date.now(),
  );
}
