import { submitOrQueueAction } from '@/data/sync/submitOrQueue';

type OutboxOptions = {
  online: boolean;
  queued?: string[];
};

// Cola y servidor en memoria: registran qué acciones quedaron encoladas y
// cuáles llegaron al servidor, en el orden en que ocurrió.
function createOutbox({ online, queued = [] }: OutboxOptions) {
  const outbox = {
    queued: [...queued],
    sent: [] as string[],
    dependenciesFor(action: string, send?: () => Promise<void>) {
      return {
        isOnline: async () => online,
        hasPendingActions: async () => outbox.queued.length > 0,
        enqueue: async () => {
          outbox.queued.push(action);
        },
        send:
          send ??
          (async () => {
            outbox.sent.push(action);
          }),
      };
    },
  };

  return outbox;
}

describe('submitOrQueueAction', () => {
  it('encola la acción cuando no hay conexión', async () => {
    const outbox = createOutbox({ online: false });

    const queued = await submitOrQueueAction(outbox.dependenciesFor('like:a'));

    expect(queued).toBe(true);
    expect(outbox.queued).toEqual(['like:a']);
    expect(outbox.sent).toEqual([]);
  });

  it('envía directo cuando hay conexión y la cola está vacía', async () => {
    const outbox = createOutbox({ online: true });

    const queued = await submitOrQueueAction(outbox.dependenciesFor('like:a'));

    expect(queued).toBe(false);
    expect(outbox.sent).toEqual(['like:a']);
    expect(outbox.queued).toEqual([]);
  });

  it('encola la acción detrás de las pendientes aunque haya conexión', async () => {
    // Like hecho sin conexión que todavía no se ha sincronizado.
    const outbox = createOutbox({ online: true, queued: ['like:a'] });

    const queued = await submitOrQueueAction(outbox.dependenciesFor('unlike:a'));

    expect(queued).toBe(true);
    expect(outbox.sent).toEqual([]);
    expect(outbox.queued).toEqual(['like:a', 'unlike:a']);
  });

  it('encola la acción si el envío falla por un error de red', async () => {
    const outbox = createOutbox({ online: true });

    const queued = await submitOrQueueAction(
      outbox.dependenciesFor('comment:a', async () => {
        throw new TypeError('Network request failed');
      }),
    );

    expect(queued).toBe(true);
    expect(outbox.queued).toEqual(['comment:a']);
  });

  it('propaga los errores que no son de red para revertir la UI optimista', async () => {
    const outbox = createOutbox({ online: true });

    await expect(
      submitOrQueueAction(
        outbox.dependenciesFor('comment:a', async () => {
          throw new Error('new row violates row-level security policy');
        }),
      ),
    ).rejects.toThrow('row-level security');
    expect(outbox.queued).toEqual([]);
  });
});
