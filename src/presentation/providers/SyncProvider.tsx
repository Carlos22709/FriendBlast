import NetInfo from '@react-native-community/netinfo';
import type { PropsWithChildren } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import {
  addComment,
  countFailedSyncActions,
  enqueueSyncAction,
  listSyncActions,
  processSyncQueue,
  registerBackgroundSyncAsync,
  retryFailedSyncActions,
  sendMessage,
  setFollowState,
  setPostLiked,
  type CommentPayload,
  type FollowPayload,
  type LikePayload,
  type MessagePayload,
  type SyncActionType,
  type SyncQueueItem,
} from '@/application/sync';
import type { Comment } from '@/domain/models/Comment';
import type { ChatMessage } from '@/domain/models/Conversation';
import { useAuth } from '@/presentation/providers/AuthProvider';

type SyncContextValue = {
  failedCount: number;
  isSyncing: boolean;
  pendingCount: number;
  pendingComments: Comment[];
  pendingMessages: ChatMessage[];
  retryFailedActions: () => Promise<void>;
  submitComment: (payload: CommentPayload) => Promise<boolean>;
  submitFollow: (payload: FollowPayload) => Promise<boolean>;
  submitLike: (payload: LikePayload) => Promise<boolean>;
  submitMessage: (payload: MessagePayload) => Promise<boolean>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

function isNetworkError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('timeout') ||
    message.includes('offline')
  );
}

function queuedComments(actions: SyncQueueItem[]): Comment[] {
  return actions
    .filter((action) => action.actionType === 'add_comment')
    .map((action) => JSON.parse(action.payload) as CommentPayload)
    .map((payload) => ({
      id: payload.commentId,
      postId: payload.postId,
      parentId: payload.parentId ?? null,
      userId: payload.userId,
      displayName: 'Tú · pendiente',
      body: payload.body,
      createdAt: payload.createdAt,
    }));
}

function queuedMessages(actions: SyncQueueItem[]): ChatMessage[] {
  return actions
    .filter((action) => action.actionType === 'send_message')
    .map((action) => JSON.parse(action.payload) as MessagePayload)
    .map((payload) => ({
      id: payload.messageId,
      conversationId: payload.conversationId,
      senderId: payload.senderId,
      senderName: 'Tú',
      body: payload.body,
      createdAt: payload.createdAt,
      deliveredAt: null,
      readAt: null,
      pending: true,
    }));
}

export function SyncProvider({ children }: PropsWithChildren) {
  const database = useSQLiteContext();
  const { session } = useAuth();
  const [actions, setActions] = useState<SyncQueueItem[]>([]);
  const [failedCount, setFailedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const processingRef = useRef(false);

  const refreshQueue = useCallback(async () => {
    if (!session) {
      setActions([]);
      setFailedCount(0);
      return;
    }

    const [nextActions, nextFailedCount] = await Promise.all([
      listSyncActions(database, session.user.id),
      countFailedSyncActions(database, session.user.id),
    ]);
    setActions(nextActions);
    setFailedCount(nextFailedCount);
  }, [database, session]);

  const processQueue = useCallback(async () => {
    if (!session || processingRef.current) {
      return;
    }

    processingRef.current = true;
    let shouldRefresh = false;

    try {
      const network = await NetInfo.fetch();
      if (!network.isConnected || network.isInternetReachable === false) {
        return;
      }

      shouldRefresh = true;
      setIsSyncing(true);
      await processSyncQueue(database, session.user.id);
    } finally {
      processingRef.current = false;
      setIsSyncing(false);
      if (shouldRefresh) {
        await refreshQueue();
      }
    }
  }, [database, refreshQueue, session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    void Promise.all([
      listSyncActions(database, session.user.id),
      countFailedSyncActions(database, session.user.id),
    ]).then(([nextActions, nextFailedCount]) => {
      setActions(nextActions);
      setFailedCount(nextFailedCount);
    });
    void registerBackgroundSyncAsync().catch((error: unknown) => {
      console.warn(
        'No se pudo registrar la sincronización en segundo plano:',
        error instanceof Error ? error.message : error,
      );
    });
  }, [database, session]);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        void processQueue();
      }
    });
  }, [processQueue]);

  useEffect(() => {
    const firstAction = actions[0];
    if (!session || !firstAction) {
      return;
    }

    const delay = Math.max(0, firstAction.nextAttemptAt - Date.now());
    const timer = setTimeout(() => {
      void processQueue();
    }, delay);

    return () => clearTimeout(timer);
  }, [actions, processQueue, session]);

  const submitOrQueue = useCallback(
    async (
      actionType: SyncActionType,
      userId: string,
      payload: unknown,
      onlineAction: () => Promise<void>,
      dedupeKey?: string,
    ) => {
      const network = await NetInfo.fetch();

      if (!network.isConnected || network.isInternetReachable === false) {
        await enqueueSyncAction(database, userId, actionType, payload, { dedupeKey });
        await refreshQueue();
        return true;
      }

      try {
        await onlineAction();
        return false;
      } catch (error: unknown) {
        if (!isNetworkError(error)) {
          throw error;
        }

        await enqueueSyncAction(database, userId, actionType, payload, { dedupeKey });
        await refreshQueue();
        return true;
      }
    },
    [database, refreshQueue],
  );

  const submitLike = useCallback(
    (payload: LikePayload) =>
      submitOrQueue(
        'set_like',
        payload.userId,
        payload,
        () => setPostLiked(payload.postId, payload.userId, payload.shouldLike),
        `like:${payload.postId}`,
      ),
    [submitOrQueue],
  );

  const submitComment = useCallback(
    (payload: CommentPayload) =>
      submitOrQueue(
        'add_comment',
        payload.userId,
        payload,
        () =>
          addComment(
            payload.postId,
            payload.userId,
            payload.body,
            payload.commentId,
            payload.parentId,
          ),
      ),
    [submitOrQueue],
  );

  const submitMessage = useCallback(
    (payload: MessagePayload) =>
      submitOrQueue(
        'send_message',
        payload.senderId,
        payload,
        () =>
          sendMessage(
            payload.messageId,
            payload.conversationId,
            payload.senderId,
            payload.body,
          ),
      ),
    [submitOrQueue],
  );

  const submitFollow = useCallback(
    (payload: FollowPayload) =>
      submitOrQueue(
        'set_follow_state',
        payload.userId,
        payload,
        () => setFollowState(payload.targetId, payload.shouldFollow),
        `follow:${payload.targetId}`,
      ),
    [submitOrQueue],
  );

  const retryFailedActions = useCallback(async () => {
    if (!session) {
      return;
    }

    await retryFailedSyncActions(database, session.user.id);
    await refreshQueue();
    await processQueue();
  }, [database, processQueue, refreshQueue, session]);

  const value = useMemo<SyncContextValue>(
    () => {
      const visibleActions = session ? actions : [];
      return {
        failedCount: session ? failedCount : 0,
        isSyncing,
        pendingCount: visibleActions.length,
        pendingComments: queuedComments(visibleActions),
        pendingMessages: queuedMessages(visibleActions),
        retryFailedActions,
        submitComment,
        submitFollow,
        submitLike,
        submitMessage,
      };
    },
    [
      actions,
      failedCount,
      isSyncing,
      retryFailedActions,
      session,
      submitComment,
      submitFollow,
      submitLike,
      submitMessage,
    ],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSyncQueue() {
  const context = useContext(SyncContext);

  if (!context) {
    throw new Error('useSyncQueue debe utilizarse dentro de SyncProvider.');
  }

  return context;
}
