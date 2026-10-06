import type { SQLiteDatabase } from 'expo-sqlite';

export type SyncActionType =
  | 'set_like'
  | 'add_comment'
  | 'send_message'
  | 'set_follow_state';

export type SyncQueueItem = {
  id: number;
  userId: string;
  actionType: SyncActionType;
  payload: string;
  createdAt: number;
  retryCount: number;
  lastError: string | null;
  dedupeKey: string | null;
  nextAttemptAt: number;
};

type SyncQueueRow = {
  id: number;
  user_id: string;
  action_type: SyncActionType;
  payload: string;
  created_at: number;
  retry_count: number;
  last_error: string | null;
  dedupe_key: string | null;
  next_attempt_at: number;
};

type EnqueueOptions = {
  dedupeKey?: string;
};

export async function enqueueSyncAction(
  database: SQLiteDatabase,
  userId: string,
  actionType: SyncActionType,
  payload: unknown,
  options: EnqueueOptions = {},
) {
  await database.withTransactionAsync(async () => {
    if (options.dedupeKey) {
      await database.runAsync(
        `DELETE FROM sync_queue
         WHERE user_id = ? AND action_type = ? AND dedupe_key = ?`,
        userId,
        actionType,
        options.dedupeKey,
      );
      await database.runAsync(
        `DELETE FROM failed_sync_actions
         WHERE user_id = ? AND action_type = ? AND dedupe_key = ?`,
        userId,
        actionType,
        options.dedupeKey,
      );
    }

    await database.runAsync(
      `INSERT INTO sync_queue
       (user_id, action_type, payload, created_at, dedupe_key, next_attempt_at)
       VALUES (?, ?, ?, ?, ?, 0)`,
      userId,
      actionType,
      JSON.stringify(payload),
      Date.now(),
      options.dedupeKey ?? null,
    );
  });
}

export async function listSyncActions(database: SQLiteDatabase, userId: string) {
  const rows = await database.getAllAsync<SyncQueueRow>(
    `SELECT id, user_id, action_type, payload, created_at, retry_count, last_error,
            dedupe_key, next_attempt_at
     FROM sync_queue
     WHERE user_id = ?
     ORDER BY created_at ASC, id ASC`,
    userId,
  );

  return rows.map<SyncQueueItem>((row) => ({
    id: row.id,
    userId: row.user_id,
    actionType: row.action_type,
    payload: row.payload,
    createdAt: row.created_at,
    retryCount: row.retry_count,
    lastError: row.last_error,
    dedupeKey: row.dedupe_key,
    nextAttemptAt: row.next_attempt_at,
  }));
}

export async function hasPendingSyncActions(database: SQLiteDatabase, userId: string) {
  const row = await database.getFirstAsync<{ id: number }>(
    'SELECT id FROM sync_queue WHERE user_id = ? LIMIT 1',
    userId,
  );
  return row !== null;
}

export async function removeSyncAction(database: SQLiteDatabase, id: number) {
  await database.runAsync('DELETE FROM sync_queue WHERE id = ?', id);
}

export async function markSyncActionFailed(
  database: SQLiteDatabase,
  id: number,
  errorMessage: string,
  nextAttemptAt: number,
) {
  await database.runAsync(
    `UPDATE sync_queue
     SET retry_count = retry_count + 1, last_error = ?, next_attempt_at = ?
     WHERE id = ?`,
    errorMessage,
    nextAttemptAt,
    id,
  );
}

export async function moveSyncActionToFailures(
  database: SQLiteDatabase,
  action: SyncQueueItem,
  errorMessage: string,
) {
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `INSERT INTO failed_sync_actions
       (original_action_id, user_id, action_type, payload, created_at, retry_count,
        last_error, failed_at, dedupe_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      action.id,
      action.userId,
      action.actionType,
      action.payload,
      action.createdAt,
      action.retryCount + 1,
      errorMessage,
      Date.now(),
      action.dedupeKey,
    );
    await removeSyncAction(database, action.id);
  });
}

export async function countFailedSyncActions(database: SQLiteDatabase, userId: string) {
  const row = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM failed_sync_actions WHERE user_id = ?',
    userId,
  );
  return row?.count ?? 0;
}

export async function retryFailedSyncActions(database: SQLiteDatabase, userId: string) {
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `INSERT INTO sync_queue
       (user_id, action_type, payload, created_at, retry_count, last_error, dedupe_key,
        next_attempt_at)
       SELECT failed.user_id, failed.action_type, failed.payload, ?, 0, NULL,
              failed.dedupe_key, 0
       FROM failed_sync_actions AS failed
       WHERE failed.user_id = ?
         AND (
           failed.dedupe_key IS NULL
           OR NOT EXISTS (
             SELECT 1
             FROM sync_queue AS queued
             WHERE queued.user_id = failed.user_id
               AND queued.action_type = failed.action_type
               AND queued.dedupe_key = failed.dedupe_key
           )
         )
       ORDER BY failed.failed_at ASC, failed.id ASC`,
      Date.now(),
      userId,
    );
    await database.runAsync('DELETE FROM failed_sync_actions WHERE user_id = ?', userId);
  });
}
