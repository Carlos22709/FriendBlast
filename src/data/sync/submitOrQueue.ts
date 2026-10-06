export type SubmitOrQueueDependencies = {
  isOnline: () => Promise<boolean>;
  hasPendingActions: () => Promise<boolean>;
  enqueue: () => Promise<void>;
  send: () => Promise<void>;
};

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

/**
 * Envía la acción al servidor o la guarda en la cola local.
 * Si quedan acciones anteriores en la cola, la nueva se encola detrás de ellas
 * para respetar el orden cronológico aunque haya conexión.
 * Devuelve true cuando la acción quedó encolada.
 */
export async function submitOrQueueAction({
  isOnline,
  hasPendingActions,
  enqueue,
  send,
}: SubmitOrQueueDependencies) {
  if (!(await isOnline()) || (await hasPendingActions())) {
    await enqueue();
    return true;
  }

  try {
    await send();
    return false;
  } catch (error: unknown) {
    if (!isNetworkError(error)) {
      throw error;
    }

    await enqueue();
    return true;
  }
}
