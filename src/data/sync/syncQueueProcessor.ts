import type { SQLiteDatabase } from 'expo-sqlite';

import {
  listSyncActions,
  markSyncActionFailed,
  moveSyncActionToFailures,
  removeSyncAction,
  type SyncQueueItem,
} from '@/data/local/syncQueueRepository';
import { sendMessage } from '@/data/repositories/messageRepository';
import { addComment, setPostLiked } from '@/data/repositories/postRepository';
import { setFollowState } from '@/data/repositories/profileRepository';

const MAX_RETRY_COUNT = 5;
const BASE_RETRY_DELAY_MS = 5_000;
const MAX_RETRY_DELAY_MS = 15 * 60 * 1_000;

export type LikePayload = {
  postId: string;
  userId: string;
  shouldLike: boolean;
};

export type CommentPayload = {
  commentId: string;
  postId: string;
  parentId: string | null;
  userId: string;
  body: string;
  createdAt: string;
};

export type MessagePayload = {
  messageId: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
};

export type FollowPayload = {
  targetId: string;
  userId: string;
  shouldFollow: boolean;
};

export type SyncQueueProcessResult = {
  processedCount: number;
  permanentlyFailedCount: number;
  deferredUntil: number | null;
};

async function executeAction(action: SyncQueueItem) {
  switch (action.actionType) {
    case 'set_like': {
      const payload = JSON.parse(action.payload) as LikePayload;
      await setPostLiked(payload.postId, payload.userId, payload.shouldLike);
      return;
    }
    case 'add_comment': {
      const payload = JSON.parse(action.payload) as CommentPayload;
      await addComment(
        payload.postId,
        payload.userId,
        payload.body,
        payload.commentId,
        payload.parentId,
      );
      return;
    }
    case 'send_message': {
      const payload = JSON.parse(action.payload) as MessagePayload;
      await sendMessage(
        payload.messageId,
        payload.conversationId,
        payload.senderId,
        payload.body,
      );
      return;
    }
    case 'set_follow_state': {
      const payload = JSON.parse(action.payload) as FollowPayload;
      await setFollowState(payload.targetId, payload.shouldFollow);
    }
  }
}

export async function processSyncQueue(database: SQLiteDatabase, userId: string) {
  const actions = await listSyncActions(database, userId);
  let processedCount = 0;
  let permanentlyFailedCount = 0;

  for (const action of actions) {
    if (action.nextAttemptAt > Date.now()) {
      return {
        processedCount,
        permanentlyFailedCount,
        deferredUntil: action.nextAttemptAt,
      } satisfies SyncQueueProcessResult;
    }

    try {
      await executeAction(action);
      await removeSyncAction(database, action.id);
      processedCount += 1;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const nextRetryCount = action.retryCount + 1;

      if (nextRetryCount >= MAX_RETRY_COUNT) {
        await moveSyncActionToFailures(database, action, errorMessage);
        permanentlyFailedCount += 1;
        continue;
      }

      const retryDelay = Math.min(
        BASE_RETRY_DELAY_MS * 2 ** action.retryCount,
        MAX_RETRY_DELAY_MS,
      );
      const nextAttemptAt = Date.now() + retryDelay;
      await markSyncActionFailed(
        database,
        action.id,
        errorMessage,
        nextAttemptAt,
      );
      return {
        processedCount,
        permanentlyFailedCount,
        deferredUntil: nextAttemptAt,
      } satisfies SyncQueueProcessResult;
    }
  }

  return {
    processedCount,
    permanentlyFailedCount,
    deferredUntil: null,
  } satisfies SyncQueueProcessResult;
}
