import { ApiError } from '../../api/errors';
import type { SesionResponse } from './contracts';
import type { SessionAccess, SessionDependencies, SessionIdentity, SessionService, SessionSnapshot } from './session.types';

const sameIdentity = (a: SessionIdentity, b: SessionIdentity) =>
  a.generation === b.generation && a.tokenVersion === b.tokenVersion;
const stale = () => new ApiError({
  kind: 'stale-session', codigo: 'SESION_OBSOLETA', mensaje: 'La sesión cambió. Vuelve a iniciar la operación.',
});
const asApiError = (error: unknown) => error instanceof ApiError ? error : new ApiError({
  kind: 'network', codigo: 'ERROR_SESION', mensaje: 'No pudimos completar la operación de sesión.',
});

export function createSessionService({ api, logoutStore, onInvalidate }: SessionDependencies): SessionService {
  let generation = 0;
  let tokenVersion = 0;
  let access: SessionAccess | null = null;
  let logoutPending = logoutStore.read();
  let logoutRevision = 0;
  let snapshot: SessionSnapshot = {
    status: logoutPending ? 'anonima' : 'restaurando', usuario: null, error: null,
    generation, tokenVersion, logoutPending, logoutPersistenceAvailable: logoutStore.isPersistent(),
  };
  const listeners = new Set<() => void>();
  let queue = Promise.resolve();
  let cleanup = Promise.resolve();
  let bootstrap: Promise<void> | undefined;
  let loginGeneration: number | null = null;
  let attempt: { identity: SessionIdentity; promise: Promise<SessionAccess>; settled: boolean } | undefined;

  function publish(state: Pick<SessionSnapshot, 'error'> & (
    | { status: 'autenticada'; usuario: SesionResponse['usuario'] }
    | { status: 'restaurando' | 'anonima' | 'errorRecuperable'; usuario: null }
  )) {
    snapshot = {
      ...state, generation, tokenVersion, logoutPending,
      logoutPersistenceAvailable: logoutStore.isPersistent(),
    };
    listeners.forEach((listener) => listener());
  }

  // The queue orders cookie writes even when an operation can no longer publish its result.
  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation);
    queue = result.then(() => undefined, () => undefined);
    return result;
  }

  function clear(status: 'anonima' | 'errorRecuperable', error: ApiError | null, advance = true) {
    access = null;
    if (advance) generation += 1;
    publish({ status, usuario: null, error });
    let current: Promise<void>;
    try { current = onInvalidate(); }
    catch (cause) { current = Promise.reject(asApiError(cause)); }
    cleanup = Promise.all([cleanup, current]).then(() => undefined, (cause: unknown) => { throw asApiError(cause); });
    // A consumer may still be waiting on the auth queue before awaiting this barrier.
    void cleanup.catch(() => undefined);
    return cleanup;
  }

  async function accept(response: SesionResponse, expectedGeneration: number): Promise<SessionAccess> {
    await cleanup;
    if (generation !== expectedGeneration || logoutPending) throw stale();
    tokenVersion += 1;
    access = { generation, tokenVersion, accessToken: response.accessToken };
    publish({ status: 'autenticada', usuario: response.usuario, error: null });
    return { ...access };
  }

  function refresh(expected: SessionIdentity): Promise<SessionAccess> {
    if (logoutPending || loginGeneration !== null) return Promise.reject(stale());
    if (attempt && sameIdentity(attempt.identity, expected)) return attempt.promise;
    if (expected.generation !== generation) return Promise.reject(stale());
    if (expected.tokenVersion !== tokenVersion) {
      return access && expected.tokenVersion < tokenVersion ? Promise.resolve({ ...access }) : Promise.reject(stale());
    }
    const identity = { generation, tokenVersion };
    const promise = enqueue(async () => {
      if (!sameIdentity(identity, snapshot) || logoutPending || loginGeneration !== null) throw stale();
      try {
        return await accept(await api.refresh(), identity.generation);
      } catch (cause) {
        if (!sameIdentity(identity, snapshot) || logoutPending || loginGeneration !== null) throw stale();
        let error = asApiError(cause);
        const definitive = error.status === 401 || error.status === 403;
        // A definitive failure advances its own generation; any further change supersedes this result.
        const failureIdentity = { generation: identity.generation + (definitive ? 1 : 0), tokenVersion: identity.tokenVersion };
        try {
          await clear(definitive ? 'anonima' : 'errorRecuperable', error, definitive);
        } catch (cleanupCause) {
          error = asApiError(cleanupCause);
        }
        if (!sameIdentity(failureIdentity, snapshot) || logoutPending || loginGeneration !== null) throw stale();
        throw error;
      }
    });
    const record = { identity, promise, settled: false };
    attempt = record;
    void promise.then(() => { record.settled = true; }, () => { record.settled = true; });
    return promise;
  }

  function restore(retry: boolean): Promise<void> {
    if (logoutPending || loginGeneration !== null) return Promise.resolve();
    if (retry && attempt?.settled) attempt = undefined;
    if (snapshot.status !== 'autenticada') publish({ status: 'restaurando', usuario: null, error: null });
    // Refresh owns publication of both success and failure; effects never receive rejections.
    return refresh({ generation, tokenVersion }).then(() => undefined, () => undefined);
  }

  async function closeRemote(expectedRevision = logoutRevision) {
    await api.logout(); // AuthApi resolves only after a valid 204 response.
    if (logoutRevision === expectedRevision) {
      logoutStore.write(false);
      logoutPending = false;
    }
  }

  return {
    getSnapshot: () => snapshot,
    getAccess: () => access ? { ...access } : null,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    initialize() {
      bootstrap ??= restore(false);
      return bootstrap;
    },
    retryRestore: () => restore(true),
    refresh,
    invalidate(expected) {
      if (!sameIdentity(expected, snapshot)) return Promise.resolve();
      attempt = undefined;
      return clear('anonima', null);
    },
    login(input) {
      logoutPending = logoutPending || logoutStore.read();
      const cleared = clear('anonima', null);
      const expectedGeneration = generation;
      loginGeneration = expectedGeneration;
      attempt = undefined;
      return enqueue(async () => {
        try {
          await cleared;
          if (generation !== expectedGeneration) throw stale();
          if (logoutPending) await closeRemote();
          if (generation !== expectedGeneration) throw stale();
          await accept(await api.login(input), expectedGeneration);
        } catch (cause) {
          if (generation !== expectedGeneration) throw stale();
          const error = asApiError(cause);
          publish({ status: 'anonima', usuario: null, error });
          throw error;
        } finally {
          if (loginGeneration === expectedGeneration) loginGeneration = null;
        }
      });
    },
    logout() {
      logoutRevision += 1;
      const expectedRevision = logoutRevision;
      logoutStore.write(true);
      logoutPending = true;
      const cleared = clear('anonima', null);
      const expectedGeneration = generation;
      loginGeneration = null;
      attempt = undefined;
      return enqueue(async () => {
        try {
          await closeRemote(expectedRevision);
          await cleared;
          if (generation === expectedGeneration) publish({ status: 'anonima', usuario: null, error: null });
        } catch (cause) {
          const error = asApiError(cause);
          if (generation === expectedGeneration) publish({ status: 'anonima', usuario: null, error });
          throw error;
        }
      });
    },
  };
}
