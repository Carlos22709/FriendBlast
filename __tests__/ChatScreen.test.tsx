import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import type { ChatMessage } from '@/domain/models/Conversation';
import { ChatScreen } from '@/presentation/screens/ChatScreen';

function message(
  id: string,
  body: string,
  createdAt: string,
  senderId = 'other-user',
): ChatMessage {
  return {
    id,
    conversationId: 'conversation-1',
    senderId,
    senderName: senderId === 'me' ? 'Tú' : 'Ana',
    body,
    createdAt,
    deliveredAt: createdAt,
    readAt: null,
  };
}

// Servidor de mensajes en memoria: la primera página trae los mensajes
// recientes y un cursor; la página anterior trae el mensaje antiguo.
const mockServer = {
  recent: [] as ChatMessage[],
  older: [] as ChatMessage[],
};

jest.mock('@/application/messages', () => ({
  listMessages: async (_conversationId: string, before?: string) =>
    before
      ? { items: mockServer.older, nextCursor: null }
      : {
          items: mockServer.recent,
          nextCursor: mockServer.older.length > 0 ? mockServer.recent[0]?.createdAt : null,
        },
  markConversationDelivered: async () => {},
  markConversationRead: async () => {},
  setTypingStatus: async () => {},
  subscribeToConversation: () => () => {},
}));

jest.mock('@/presentation/providers/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'me' } } }),
}));

// Estado de la cola controlado por el test, entregado igual que el contexto
// real: cada cambio crea un objeto y arreglos nuevos y vuelve a renderizar.
type MockSyncState = { pendingMessages: ChatMessage[]; submitMessage: () => Promise<boolean> };
const mockSyncStore = {
  state: { pendingMessages: [], submitMessage: async () => false } as MockSyncState,
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

async function renderChat() {
  await renderRouter(
    { 'chat/[conversationId]': ChatScreen },
    { initialUrl: '/chat/conversation-1' },
  );
}

beforeEach(() => {
  mockServer.recent = [];
  mockServer.older = [];
  mockSyncStore.state = { pendingMessages: [], submitMessage: async () => false };
});

describe('ChatScreen', () => {
  it('conserva los mensajes anteriores cargados cuando cambia el estado de sincronización', async () => {
    mockServer.recent = [message('recent', 'Mensaje reciente', '2026-10-05T10:00:00.000Z')];
    mockServer.older = [message('old', 'Mensaje antiguo', '2026-10-01T10:00:00.000Z')];
    await renderChat();
    await screen.findByText('Mensaje reciente');

    await fireEvent.press(screen.getByText('Cargar mensajes anteriores'));
    await screen.findByText('Mensaje antiguo');

    // La cola termina de sincronizar sin acciones pendientes.
    await act(async () => {
      mockSyncStore.set({ pendingMessages: [] });
    });

    expect(screen.queryByText('Mensaje antiguo')).not.toBeNull();
    expect(screen.queryByText('Mensaje reciente')).not.toBeNull();
  });

  it('muestra como enviado un mensaje de la cola que ya llegó al servidor', async () => {
    const createdAt = '2026-10-05T10:00:00.000Z';
    // El servidor ya tiene el mensaje, pero la cola local aún no se refrescó.
    mockServer.recent = [message('queued', 'Hola', createdAt, 'me')];
    mockSyncStore.state = {
      ...mockSyncStore.state,
      pendingMessages: [{ ...message('queued', 'Hola', createdAt, 'me'), pending: true }],
    };

    await renderChat();
    await screen.findByText('Hola');

    expect(screen.queryByText('Pendiente')).toBeNull();
    expect(screen.queryByText('Entregado')).not.toBeNull();
  });
});
