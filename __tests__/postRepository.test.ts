import { addComment, setPostLiked } from '@/data/repositories/postRepository';

type RecordedRequest = {
  method: string;
  url: string;
  prefer: string;
};

const mockRequests: RecordedRequest[] = [];

// Cliente real de supabase-js; solo se reemplaza la red para registrar
// la petición que la app envía a PostgREST.
jest.mock('@/data/remote/supabase', () => {
  const { createClient } = jest.requireActual('@supabase/supabase-js');
  const client = createClient('https://example.supabase.co', 'sb_publishable_test', {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        mockRequests.push({
          method: init?.method ?? 'GET',
          url: String(input),
          prefer: headers.get('Prefer') ?? '',
        });
        return new Response(null, { status: 201 });
      },
    },
  });

  return { getSupabaseClient: () => client };
});

beforeEach(() => {
  mockRequests.length = 0;
});

describe('reintentos idempotentes de la cola', () => {
  it('reintentar un comentario ya guardado no intenta actualizarlo', async () => {
    await addComment('post-1', 'user-1', 'Hola', 'comment-1', null);

    expect(mockRequests).toHaveLength(1);
    expect(mockRequests[0]?.method).toBe('POST');
    expect(mockRequests[0]?.url).toContain('/rest/v1/comments');
    expect(mockRequests[0]?.prefer).toContain('resolution=ignore-duplicates');
  });

  it('reintentar un like ya guardado no intenta actualizarlo', async () => {
    await setPostLiked('post-1', 'user-1', true);

    expect(mockRequests).toHaveLength(1);
    expect(mockRequests[0]?.method).toBe('POST');
    expect(mockRequests[0]?.url).toContain('/rest/v1/post_likes');
    expect(mockRequests[0]?.prefer).toContain('resolution=ignore-duplicates');
  });
});
