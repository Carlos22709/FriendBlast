import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 5;

type UserVersionRow = {
  user_version: number;
};

export async function migrateDatabase(database: SQLiteDatabase) {
  await database.execAsync('PRAGMA journal_mode = WAL;');
  await database.execAsync('PRAGMA foreign_keys = ON;');

  const result = await database.getFirstAsync<UserVersionRow>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  await database.withTransactionAsync(async () => {
    if (currentVersion < 1) {
      await database.execAsync(
        [
          'CREATE TABLE IF NOT EXISTS app_meta (',
          'key TEXT PRIMARY KEY NOT NULL,',
          'value TEXT NOT NULL',
          ');',
        ].join(' '),
      );
    }

    if (currentVersion < 2) {
      await database.execAsync(
        [
          'CREATE TABLE IF NOT EXISTS sync_queue (',
          'id INTEGER PRIMARY KEY AUTOINCREMENT,',
          'user_id TEXT NOT NULL,',
          'action_type TEXT NOT NULL,',
          'payload TEXT NOT NULL,',
          'created_at INTEGER NOT NULL,',
          'retry_count INTEGER NOT NULL DEFAULT 0,',
          'last_error TEXT',
          ');',
          'CREATE INDEX IF NOT EXISTS sync_queue_user_created_idx',
          'ON sync_queue (user_id, created_at, id);',
        ].join(' '),
      );
    }

    if (currentVersion < 3) {
      await database.execAsync(
        [
          'CREATE TABLE IF NOT EXISTS viewed_stories (',
          'user_id TEXT NOT NULL,',
          'story_id TEXT NOT NULL,',
          'viewed_at INTEGER NOT NULL,',
          'PRIMARY KEY (user_id, story_id)',
          ');',
          'CREATE INDEX IF NOT EXISTS viewed_stories_user_idx',
          'ON viewed_stories (user_id, viewed_at DESC);',
        ].join(' '),
      );
    }

    if (currentVersion < 4) {
      await database.execAsync(
        [
          'ALTER TABLE sync_queue ADD COLUMN dedupe_key TEXT;',
          'CREATE INDEX IF NOT EXISTS sync_queue_dedupe_idx',
          'ON sync_queue (user_id, action_type, dedupe_key);',
        ].join(' '),
      );
    }

    if (currentVersion < 5) {
      await database.execAsync(
        [
          'ALTER TABLE sync_queue ADD COLUMN next_attempt_at INTEGER NOT NULL DEFAULT 0;',
          'CREATE TABLE IF NOT EXISTS failed_sync_actions (',
          'id INTEGER PRIMARY KEY AUTOINCREMENT,',
          'original_action_id INTEGER NOT NULL,',
          'user_id TEXT NOT NULL,',
          'action_type TEXT NOT NULL,',
          'payload TEXT NOT NULL,',
          'created_at INTEGER NOT NULL,',
          'retry_count INTEGER NOT NULL,',
          'last_error TEXT NOT NULL,',
          'failed_at INTEGER NOT NULL,',
          'dedupe_key TEXT',
          ');',
          'CREATE INDEX IF NOT EXISTS failed_sync_actions_user_failed_idx',
          'ON failed_sync_actions (user_id, failed_at DESC);',
        ].join(' '),
      );
    }

    await database.execAsync('PRAGMA user_version = ' + DATABASE_VERSION + ';');
  });
}
