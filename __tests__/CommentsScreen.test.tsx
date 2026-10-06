import { act, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import type { Comment } from '@/domain/models/Comment';
import { CommentsScreen } from '@/presentation/screens/CommentsScreen';

// Servidor de comentarios en memoria que cuenta las peticiones y las
// suscripciones Realtime abiertas por la pantalla.
const mockServer = {
  comments: [] as Comment[],
  listRequests: 0,
  subscriptions: 0,
};

jest.mock('@/application/posts', () => ({
  listComments: async () => {
    mockServer.listRequests += 1;
    return mockServer.comments;
  },
  subscribeToComments: () => {
    mockServer.subscriptions += 1;
    return () => {};
  },
}));

jest.mock('@/presentation/providers/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'me' } } }),
}));

// Estado de la cola controlado por el test, entregado igual que el contexto
// real: cada cambio crea un objeto y arreglos nuevos y vuelve a renderizar.
type MockSyncState = { pendingComments: Comment[]; submitComment: () => Promise<boolean> };
const mockSyncStore = {
  state: { pendingComments: [], submitComment: async () => false } as MockSyncState,
  listeners: new Set<() => void>(),
  set(next: Partial<MockSyncState>) {
    mockSyncStore.state = { ...mockSyncStore.state, ...next };
    mockSyncStore.listeners.forEach((listener) => listener());
  },
};

jest.mock('@/presentation/providers/SyncProvider', () => ({
  useSyncQueue: () =>
    jest.requireActual<typeof import('react')>('react').useSyncExternalStore(
      (listener) => {
        mockSyncStore.listeners.add(listener);
        return () => mockSyncStore.listeners.delete(listener);
      },
      () => mockSyncStore.state,
    ),
}));

describe('CommentsScreen', () => {
  it('no vuelve a pedir comentarios ni a suscribirse cuando cambia el estado de sincronización', async () => {
    mockServer.comments = [
      {
        id: 'comment-1',
        postId: 'post-1',
        parentId: null,
        userId: 'other-user',
        displayName: 'Ana',
        body: 'Qué buena foto',
        createdAt: '2026-10-05T10:00:00.000Z',
      },
    ];

    await renderRouter(
      { 'comments/[postId]': CommentsScreen },
      { initialUrl: '/comments/post-1' },
    );
    await screen.findByText('Qué buena foto');
    expect(mockServer.listRequests).toBe(1);
    expect(mockServer.subscriptions).toBe(1);

    // La cola termina de sincronizar sin acciones pendientes.
    await act(async () => {
      mockSyncStore.set({ pendingComments: [] });
    });

    expect(mockServer.listRequests).toBe(1);
    expect(mockServer.subscriptions).toBe(1);
  });
});
