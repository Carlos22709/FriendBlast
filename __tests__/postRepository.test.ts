import { addComment, listPostsPage, setPostLiked } from '@/data/repositories/postRepository';

type RecordedRequest = {
  method: string;
  url: string;
  prefer: string;
};

const mockRequests: RecordedRequest[] = [];

// Datos que devuelve el servidor falso, con la forma real de PostgREST y Storage.
const mockServer = {
  posts: [] as unknown[],
  postStats: [] as unknown[],
};

function mockJson(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockRespond(method: string, url: string, body: string | undefined) {
  const { pathname } = new URL(url);

  if (method === 'GET' && pathname === '/rest/v1/posts') {
    return mockJson(mockServer.posts);
  }
  if (method === 'POST' && pathname === '/rest/v1/rpc/get_post_stats') {
    return mockJson(mockServer.postStats);
  }
  if (method === 'POST' && pathname === '/storage/v1/object/sign/post-images') {
    const { paths } = JSON.parse(body ?? '{}') as { paths: string[] };
    return mockJson(
      paths.map((path) => ({
        error: null,
        path,
        signedURL: `/object/sign/post-images/${path}?token=test`,
      })),
    );
  }
  if (method === 'GET') {
    return mockJson([]);
  }
  return new Response(null, { status: 201 });
}

// Cliente real de supabase-js; solo se reemplaza la red para registrar
// la petición que la app envía a PostgREST.
jest.mock('@/data/remote/supabase', () => {
  const { createClient } = jest.requireActual('@supabase/supabase-js');
  const client = createClient('https://example.supabase.co', 'sb_publishable_test', {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        const method = init?.method ?? 'GET';
        const url = String(input);
        mockRequests.push({ method, url, prefer: headers.get('Prefer') ?? '' });
        return mockRespond(method, url, init?.body as string | undefined);
      },
    },
  });

  return { getSupabaseClient: () => client };
});

beforeEach(() => {
  mockRequests.length = 0;
  mockServer.posts = [];
  mockServer.postStats = [];
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

describe('contadores del feed', () => {
  it('cuenta likes y comentarios en el servidor sin descargar sus filas', async () => {
    mockServer.posts = [
      {
        id: 'post-1',
        user_id: 'author-1',
        caption: 'Atardecer',
        image_path: 'author-1/sunset.jpg',
        created_at: '2026-10-05T10:00:00.000Z',
        profile: { display_name: 'Ana', avatar_url: null },
      },
    ];
    // Más filas de las 1000 que PostgREST devuelve como máximo por consulta.
    mockServer.postStats = [
      { post_id: 'post-1', like_count: 1500, comment_count: 1200, liked_by_me: true },
    ];

    const page = await listPostsPage();

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      id: 'post-1',
      likeCount: 1500,
      commentCount: 1200,
      likedByMe: true,
    });
    const rowDownloads = mockRequests.filter(({ url }) =>
      /\/rest\/v1\/(post_likes|comments)(\?|$)/.test(url),
    );
    expect(rowDownloads).toEqual([]);
  });
});
