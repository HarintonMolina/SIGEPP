import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/errors';
import { deferred } from '../../test/deferred';
import { makeSesionResponse } from '../../test/fixtures';
import type { AuthApi } from './auth-api';
import type { SesionResponse } from './contracts';
import { createLogoutStore } from './logout-store';
import { createSessionService } from './session';
import type { LogoutStore, SessionAccess } from './session.types';

const credentials = { correo: 'ana@std.uni.edu.ni', contrasena: ' contraseña ' };
const failure = (status?: number) => new ApiError({
  kind: status ? 'http' : 'network', status, codigo: 'ERROR_PRUEBA', mensaje: 'Cuenta inactiva o fallo de prueba',
});

function createSessionHarness(store?: LogoutStore) {
  const api = {
    registro: vi.fn<AuthApi['registro']>(),
    login: vi.fn<AuthApi['login']>().mockResolvedValue(makeSesionResponse()),
    refresh: vi.fn<AuthApi['refresh']>().mockResolvedValue(makeSesionResponse()),
    logout: vi.fn<AuthApi['logout']>().mockResolvedValue(undefined),
  } satisfies AuthApi;
  let marker = false;
  const logoutStore = store ?? createLogoutStore({
    getItem: () => marker ? 'true' : null,
    setItem: () => { marker = true; }, removeItem: () => { marker = false; },
  });
  const onInvalidate = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  return { session: createSessionService({ api, logoutStore, onInvalidate }), api, logoutStore, onInvalidate };
}

describe('servicio de sesión', () => {
  it('memoriza bootstrap anónimo durante y después de resolver', async () => {
    const { session, api } = createSessionHarness();
    const pending = deferred<SesionResponse>();
    api.refresh.mockReturnValue(pending.promise);
    const first = session.initialize();
    const second = session.initialize();
    pending.reject(failure(401));
    await Promise.all([first, second]);
    await session.initialize();
    expect(api.refresh).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot().status).toBe('anonima');
    expect(session.getAccess()).toBeNull();
  });

  it.each([
    [200, 'autenticada'], [401, 'anonima'], [403, 'anonima'],
    [429, 'errorRecuperable'], [500, 'errorRecuperable'], [undefined, 'errorRecuperable'],
  ] as const)('bootstrap %s publica %s sin rechazar', async (status, expected) => {
    const { session, api } = createSessionHarness();
    const error = failure(status);
    if (status !== 200) api.refresh.mockRejectedValue(error);
    await expect(session.initialize()).resolves.toBeUndefined();
    expect(session.getSnapshot().status).toBe(expected);
    expect(session.getSnapshot()).not.toHaveProperty('accessToken');
    if (status === 200) {
      expect(session.getSnapshot().usuario).toEqual(makeSesionResponse().usuario);
      expect(session.getAccess()?.accessToken).toBe(makeSesionResponse().accessToken);
    } else {
      expect(session.getAccess()).toBeNull();
      if (status === 403) expect(session.getSnapshot().error).toBe(error);
    }
  });

  it('comparte refresh concurrente y bootstrap de la misma identidad', async () => {
    const { session, api } = createSessionHarness();
    const expected = session.getSnapshot();
    const pending = deferred<SesionResponse>();
    api.refresh.mockReturnValue(pending.promise);
    const initialize = session.initialize();
    const first = session.refresh(expected);
    const second = session.refresh(expected);
    pending.resolve(makeSesionResponse());
    const [a, b] = await Promise.all([first, second]);
    await initialize;
    expect(api.refresh).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(a.tokenVersion).toBe(expected.tokenVersion + 1);
  });

  it('avanza versión aun con JWT idéntico y reutiliza acceso para 401 tardío', async () => {
    const { session, api } = createSessionHarness();
    await session.initialize();
    const before = session.getAccess()!;
    const after = await session.refresh(before);
    expect(after.accessToken).toBe(before.accessToken);
    expect(after.generation).toBe(before.generation);
    expect(after.tokenVersion).toBe(before.tokenVersion + 1);
    expect(await session.refresh(before)).toEqual(after);
    expect(api.refresh).toHaveBeenCalledTimes(2);
  });

  it.each([401, 403, 429, 500, undefined])('memoriza fallo %s para concurrentes/tardíos hasta retryRestore', async (status) => {
    const { session, api } = createSessionHarness();
    await session.initialize();
    const identity = session.getAccess()!;
    const error = failure(status);
    api.refresh.mockRejectedValueOnce(error);
    const results = await Promise.allSettled([session.refresh(identity), session.refresh(identity)]);
    expect(results).toEqual([{ status: 'rejected', reason: error }, { status: 'rejected', reason: error }]);
    await expect(session.refresh(identity)).rejects.toBe(error);
    expect(api.refresh).toHaveBeenCalledTimes(2);
    expect(session.getAccess()).toBeNull();
    await session.retryRestore();
    expect(api.refresh).toHaveBeenCalledTimes(3);
    expect(session.getSnapshot().status).toBe('autenticada');
  });

  it.each(['refresh', 'login'] as const)('logout limpia síncronamente y espera %s activo antes de revocar cookie', async (operation) => {
    const { session, api, onInvalidate, logoutStore } = createSessionHarness();
    await session.initialize();
    const pending = deferred<SesionResponse>();
    const started = deferred<void>();
    api[operation].mockImplementation(() => { started.resolve(); return pending.promise; });
    const order: string[] = [];
    api.logout.mockImplementation(async () => { order.push('logout'); });
    const before = session.getAccess()!;
    const work = operation === 'refresh' ? session.refresh(before) : session.login(credentials);
    const result = Promise.allSettled([work]);
    await started.promise;
    const logout = session.logout();
    expect(session.getSnapshot().status).toBe('anonima');
    expect(session.getSnapshot().usuario).toBeNull();
    expect(session.getAccess()).toBeNull();
    expect(session.getSnapshot().generation).toBeGreaterThan(before.generation);
    expect(onInvalidate).toHaveBeenCalled();
    expect(logoutStore.read()).toBe(true);
    await expect(session.refresh(session.getSnapshot())).rejects.toBeInstanceOf(ApiError);
    expect(order).toEqual([]);
    order.push(operation);
    pending.resolve(makeSesionResponse());
    await logout;
    expect((await result)[0].status).toBe('rejected');
    expect(order).toEqual([operation, 'logout']);
    expect(session.getAccess()).toBeNull();
    expect(session.getSnapshot().status).toBe('anonima');
    expect(logoutStore.read()).toBe(false);
  });

  it.each([
    ['refresh', 'login'], ['refresh', 'logout'], ['login', 'login'], ['login', 'logout'],
  ] as const)('fallo tardío de %s tras %s rechaza stale-session y no publica el error anterior', async (operation, replacement) => {
    const { session, api } = createSessionHarness();
    await session.initialize();
    const pending = deferred<SesionResponse>();
    const started = deferred<void>();
    api[operation].mockImplementationOnce(() => { started.resolve(); return pending.promise; });
    const previous = operation === 'refresh' ? session.refresh(session.getAccess()!) : session.login(credentials);
    const previousResult = Promise.allSettled([previous]);
    await started.promise;
    const next = replacement === 'login' ? session.login(credentials) : session.logout();
    const nextSnapshot = session.getSnapshot();
    const observedErrors: Array<ApiError | null> = [];
    const unsubscribe = session.subscribe(() => { observedErrors.push(session.getSnapshot().error); });
    pending.reject(failure(500));
    const [result] = await previousResult;
    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') expect(result.reason).toMatchObject({ kind: 'stale-session' });
    await next;
    unsubscribe();
    expect(observedErrors.every((error) => error === null)).toBe(true);
    expect(session.getSnapshot().generation).toBe(nextSnapshot.generation);
    expect(session.getSnapshot().status).toBe(replacement === 'login' ? 'autenticada' : 'anonima');
    expect(api.refresh).toHaveBeenCalledTimes(operation === 'refresh' ? 2 : 1);
  });

  it.each([
    [401, 'login'], [401, 'logout'], [403, 'login'], [403, 'logout'], [500, 'login'], [500, 'logout'],
  ] as const)('refresh %s sustituido por %s durante limpieza de fallo rechaza stale-session', async (status, replacement) => {
    const { session, api, onInvalidate } = createSessionHarness();
    await session.initialize();
    const identity = session.getAccess()!;
    const pending = deferred<SesionResponse>();
    const cleaning = deferred<void>();
    const cleanStarted = deferred<void>();
    api.refresh.mockReturnValueOnce(pending.promise);
    onInvalidate.mockImplementationOnce(() => { cleanStarted.resolve(); return cleaning.promise; });
    const first = session.refresh(identity);
    const second = session.refresh(identity);
    const results = Promise.allSettled([first, second]);
    pending.reject(failure(status));
    await cleanStarted.promise;
    const next = replacement === 'login' ? session.login(credentials) : session.logout();
    cleaning.resolve();
    for (const result of await results) {
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') expect(result.reason).toMatchObject({ kind: 'stale-session' });
    }
    await next;
    expect(session.getSnapshot().error).toBeNull();
    expect(session.getSnapshot().status).toBe(replacement === 'login' ? 'autenticada' : 'anonima');
    expect(api.refresh).toHaveBeenCalledTimes(2);
  });

  it.each([401, 403])('refresh vigente %s conserva error compartido durante y después de su propia limpieza', async (status) => {
    const { session, api, onInvalidate } = createSessionHarness();
    await session.initialize();
    const identity = session.getAccess()!;
    const error = failure(status);
    const pending = deferred<SesionResponse>();
    const cleaning = deferred<void>();
    const cleanStarted = deferred<void>();
    api.refresh.mockReturnValueOnce(pending.promise);
    onInvalidate.mockImplementationOnce(() => { cleanStarted.resolve(); return cleaning.promise; });
    const first = session.refresh(identity);
    const second = session.refresh(identity);
    const results = Promise.allSettled([first, second]);
    pending.reject(error);
    await cleanStarted.promise;
    expect(session.getSnapshot().generation).toBe(identity.generation + 1);
    const duringCleanup = session.refresh(identity);
    const duringResult = Promise.allSettled([duringCleanup]);
    cleaning.resolve();
    for (const result of [...await results, ...await duringResult]) {
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') expect(result.reason).toBe(error);
    }
    await expect(session.refresh(identity)).rejects.toBe(error);
    expect(session.getSnapshot()).toMatchObject({ status: 'anonima', error, usuario: null });
    expect(api.refresh).toHaveBeenCalledTimes(2);
    expect(onInvalidate).toHaveBeenCalledTimes(1);
  });

  it('login con cierre pendiente espera 204 antes de enviarse', async () => {
    const { session, api, logoutStore } = createSessionHarness();
    logoutStore.write(true);
    const order: string[] = [];
    const pending = deferred<void>();
    const started = deferred<void>();
    api.logout.mockImplementation(() => { order.push('logout'); started.resolve(); return pending.promise; });
    api.login.mockImplementation(async () => { order.push('login'); return makeSesionResponse(); });
    const login = session.login(credentials);
    await started.promise;
    expect(order).toEqual(['logout']);
    expect(logoutStore.read()).toBe(true);
    pending.resolve();
    await login;
    expect(order).toEqual(['logout', 'login']);
    expect(logoutStore.read()).toBe(false);
    expect(api.login).toHaveBeenCalledWith(credentials);
    expect(session.getSnapshot().status).toBe('autenticada');
  });

  it('no envía login si falla cierre pendiente', async () => {
    const { session, api, logoutStore } = createSessionHarness();
    logoutStore.write(true);
    const error = failure(500);
    api.logout.mockRejectedValue(error);
    await expect(session.login(credentials)).rejects.toBe(error);
    expect(api.login).not.toHaveBeenCalled();
    expect(session.getAccess()).toBeNull();
    expect(logoutStore.read()).toBe(true);
  });

  it('cierre fallido sobrevive a nueva instancia sin refresh hasta logout exitoso', async () => {
    const { session, api, logoutStore } = createSessionHarness();
    await session.initialize();
    const error = failure();
    api.logout.mockRejectedValue(error);
    await expect(session.logout()).rejects.toBe(error);
    expect(session.getSnapshot()).toMatchObject({ logoutPending: true, error, status: 'anonima' });
    const next = createSessionHarness(logoutStore);
    await next.session.initialize();
    await next.session.retryRestore();
    expect(next.api.refresh).not.toHaveBeenCalled();
    expect(logoutStore.read()).toBe(true);
    await next.session.logout();
    expect(logoutStore.read()).toBe(false);
  });

  it('expone fallo de persistencia y mantiene cierre local en memoria', async () => {
    const store = createLogoutStore({
      getItem: () => null, setItem: () => { throw new DOMException('Bloqueado', 'SecurityError'); }, removeItem: () => {},
    });
    const { session, api } = createSessionHarness(store);
    await session.initialize();
    api.logout.mockRejectedValue(failure());
    await expect(session.logout()).rejects.toBeInstanceOf(ApiError);
    expect(session.getSnapshot()).toMatchObject({ logoutPersistenceAvailable: false, logoutPending: true, usuario: null });
    expect(store.read()).toBe(true);
  });

  it.each([false, true])('un cierre anterior exitoso no elimina el marcador de un cierre nuevo fallido (activo: %s)', async (active) => {
    const { session, api, logoutStore } = createSessionHarness();
    await session.initialize();
    const firstRemote = deferred<void>();
    const firstStarted = deferred<void>();
    api.logout.mockImplementationOnce(() => { firstStarted.resolve(); return firstRemote.promise; });
    api.logout.mockRejectedValueOnce(failure(500));
    const first = session.logout();
    if (active) await firstStarted.promise;
    const second = session.logout();
    const results = Promise.allSettled([first, second]);
    firstRemote.resolve();
    await results;
    expect(logoutStore.read()).toBe(true);
    expect(session.getSnapshot().logoutPending).toBe(true);
    await expect(session.refresh(session.getSnapshot())).rejects.toMatchObject({ kind: 'stale-session' });
    expect(api.refresh).toHaveBeenCalledTimes(1);
  });

  it('retryRestore fallido publica error recuperable y resuelve también ante respuesta inválida', async () => {
    const { session, api } = createSessionHarness();
    api.refresh.mockRejectedValue(failure(500));
    await session.initialize();
    const invalid = new ApiError({ kind: 'invalid-response', codigo: 'RESPUESTA_INVALIDA', mensaje: 'Respuesta inválida' });
    api.refresh.mockRejectedValue(invalid);
    await expect(session.retryRestore()).resolves.toBeUndefined();
    expect(session.getSnapshot()).toMatchObject({ status: 'errorRecuperable', error: invalid, usuario: null });
    expect(session.getAccess()).toBeNull();
  });

  it('descarta invalidación de generación anterior y refresh obsoleto', async () => {
    const { session, api, onInvalidate } = createSessionHarness();
    await session.initialize();
    const before = session.getAccess()!;
    await session.login(credentials);
    const current = session.getSnapshot();
    onInvalidate.mockClear();
    await session.invalidate(before);
    await expect(session.refresh(before)).rejects.toMatchObject({ kind: 'stale-session' });
    expect(session.getSnapshot()).toBe(current);
    expect(onInvalidate).not.toHaveBeenCalled();
    expect(api.refresh).toHaveBeenCalledTimes(1);
  });

  it('invalidación de versión anterior en misma generación conserva identidad vigente', async () => {
    const { session, onInvalidate } = createSessionHarness();
    await session.initialize();
    const before = session.getAccess()!;
    await session.refresh(before);
    const current = session.getSnapshot();
    onInvalidate.mockClear();
    await session.invalidate(before);
    expect(session.getSnapshot()).toBe(current);
    expect(onInvalidate).not.toHaveBeenCalled();
  });

  it('invalidación vigente limpia acceso inmediatamente y espera limpieza privada', async () => {
    const { session, onInvalidate } = createSessionHarness();
    await session.initialize();
    const before = session.getAccess()!;
    const clean = deferred<void>();
    onInvalidate.mockReturnValue(clean.promise);
    const invalidation = session.invalidate(before);
    expect(session.getAccess()).toBeNull();
    expect(session.getSnapshot().generation).toBe(before.generation + 1);
    expect(session.getSnapshot().status).toBe('anonima');
    clean.resolve();
    await invalidation;
  });

  it.each(['logout', 'invalidate'] as const)('%s descarta el resultado de refresh memorizado de la generación cerrada', async (operation) => {
    const { session } = createSessionHarness();
    await session.initialize();
    const previous = session.getAccess()!;
    const renewed = await session.refresh(previous);
    if (operation === 'logout') await session.logout();
    else await session.invalidate(renewed);
    await expect(session.refresh(previous)).rejects.toMatchObject({ kind: 'stale-session' });
    expect(session.getAccess()).toBeNull();
  });

  it('refresh normaliza un fallo de limpieza privada como ApiError', async () => {
    const { session, api, onInvalidate } = createSessionHarness();
    await session.initialize();
    api.refresh.mockRejectedValue(failure(401));
    onInvalidate.mockRejectedValue(new Error('Fallo de limpieza'));
    await expect(session.refresh(session.getAccess()!)).rejects.toBeInstanceOf(ApiError);
    expect(session.getAccess()).toBeNull();
  });

  it('login limpia síncronamente y no publica nueva identidad antes de onInvalidate', async () => {
    const { session, onInvalidate } = createSessionHarness();
    await session.initialize();
    const before = session.getAccess()!;
    const clean = deferred<void>();
    onInvalidate.mockReturnValue(clean.promise);
    const login = session.login(credentials);
    expect(session.getAccess()).toBeNull();
    expect(session.getSnapshot().generation).toBe(before.generation + 1);
    clean.resolve();
    await login;
    expect(session.getAccess()?.generation).toBe(before.generation + 1);
  });

  it('login espera bootstrap activo y su respuesta no sobrescribe login', async () => {
    const { session, api } = createSessionHarness();
    const pending = deferred<SesionResponse>();
    const started = deferred<void>();
    api.refresh.mockImplementation(() => { started.resolve(); return pending.promise; });
    const boot = session.initialize();
    await started.promise;
    const login = session.login(credentials);
    expect(api.login).not.toHaveBeenCalled();
    pending.resolve(makeSesionResponse('ADMIN', 'anterior'));
    await Promise.all([boot, login]);
    expect(session.getSnapshot().usuario?.rol).toBe('ESTUDIANTE');
    expect(session.getAccess()?.accessToken).toBe(makeSesionResponse().accessToken);
  });

  it('snapshots estables y suscriptores removibles sin filtrar token', async () => {
    const { session } = createSessionHarness();
    const initial = session.getSnapshot();
    expect(session.getSnapshot()).toBe(initial);
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);
    await session.initialize();
    expect(listener).toHaveBeenCalled();
    const authenticated = session.getSnapshot();
    expect(session.getSnapshot()).toBe(authenticated);
    expect(authenticated).not.toHaveProperty('accessToken');
    listener.mockClear();
    unsubscribe();
    await session.refresh(session.getAccess() as SessionAccess);
    expect(listener).not.toHaveBeenCalled();
  });
});
