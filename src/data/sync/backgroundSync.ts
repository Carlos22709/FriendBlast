import * as BackgroundTask from 'expo-background-task';
import { openDatabaseAsync } from 'expo-sqlite';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { migrateDatabase } from '@/data/local/migrateDatabase';
import { getSupabaseClient } from '@/data/remote/supabase';
import { processSyncQueue } from '@/data/sync/syncQueueProcessor';

const BACKGROUND_SYNC_TASK = 'friendblast-background-sync';
const DATABASE_NAME = 'friendblast.db';

if (!TaskManager.isTaskDefined(BACKGROUND_SYNC_TASK)) {
  TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
    let database: Awaited<ReturnType<typeof openDatabaseAsync>> | null = null;

    try {
      const { data } = await getSupabaseClient().auth.getSession();
      if (!data.session) {
        return BackgroundTask.BackgroundTaskResult.Success;
      }

      database = await openDatabaseAsync(DATABASE_NAME);
      await migrateDatabase(database);
      const result = await processSyncQueue(database, data.session.user.id);
      return result.deferredUntil
        ? BackgroundTask.BackgroundTaskResult.Failed
        : BackgroundTask.BackgroundTaskResult.Success;
    } catch (error: unknown) {
      console.warn(
        'Falló la sincronización en segundo plano:',
        error instanceof Error ? error.message : error,
      );
      return BackgroundTask.BackgroundTaskResult.Failed;
    } finally {
      await database?.closeAsync();
    }
  });
}

export async function registerBackgroundSyncAsync() {
  if (Platform.OS === 'web') {
    return false;
  }

  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) {
    return false;
  }

  if (!(await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK))) {
    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 15,
    });
  }

  return true;
}
