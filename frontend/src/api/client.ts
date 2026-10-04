import type { SessionAccess, SessionService } from '../features/auth/session.types';
import { ApiError } from './errors';
import type { RequestOptions, Transport } from './transport';

export type HttpClient = {
  request<T>(path: string, options?: Omit<RequestOptions, 'credentials'>): Promise<T>;
};

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('La petición fue cancelada.', 'AbortError');
}

// A consumer may leave the shared refresh without cancelling it for other requests.
function waitForRefresh<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  throwIfAborted(signal);
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new DOMException('La petición fue cancelada.', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    void promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export function createHttpClient(transport: Transport, session: SessionService): HttpClient {
  function ensureCurrent(access: SessionAccess, signal?: AbortSignal) {
    throwIfAborted(signal);
    if (session.getSnapshot().generation !== access.generation) {
      throw new ApiError({ kind: 'stale-session', codigo: 'SESION_OBSOLETA',
        mensaje: 'La sesión cambió. Vuelve a iniciar la operación.' });
    }
  }

  return {
    async request<T>(path: string, options: Omit<RequestOptions, 'credentials'> = {}): Promise<T> {
      throwIfAborted(options.signal);
      const original = session.getAccess();
      if (!original) throw new ApiError({ kind: 'http', status: 401, codigo: 'SESION_REQUERIDA',
        mensaje: 'Inicia sesión para realizar esta operación.' });

      async function send(access: SessionAccess): Promise<T> {
        ensureCurrent(access, options.signal);
        const headers = new Headers(options.headers);
        headers.set('Authorization', `Bearer ${access.accessToken}`);
        try {
          const result = await transport.request<T>(path, {
            ...options, headers: Object.fromEntries(headers.entries()), credentials: 'include',
          });
          ensureCurrent(access, options.signal);
          return result;
        } catch (error) {
          ensureCurrent(access, options.signal);
          throw error;
        }
      }

      try { return await send(original); }
      catch (error) {
        if (!(error instanceof ApiError) || error.kind !== 'http' || error.status !== 401) throw error;
      }

      ensureCurrent(original, options.signal);
      // SessionService reuses a newer version or a recorded failure, and owns single-flight.
      await waitForRefresh(session.refresh(original), options.signal);
      ensureCurrent(original, options.signal);
      const renewed = session.getAccess();
      if (!renewed) throw new ApiError({ kind: 'stale-session', codigo: 'SESION_OBSOLETA',
        mensaje: 'La sesión cambió. Vuelve a iniciar la operación.' });
      try { return await send(renewed); }
      catch (error) {
        if (error instanceof ApiError && error.kind === 'http' && error.status === 401) {
          ensureCurrent(renewed, options.signal);
          // Invalidating the current version advances generation once; an older version is a no-op.
          const generation = renewed.generation
            + (session.getSnapshot().tokenVersion === renewed.tokenVersion ? 1 : 0);
          try { await session.invalidate(renewed); }
          finally { ensureCurrent({ ...renewed, generation }, options.signal); }
        }
        throw error;
      }
    },
  };
}
