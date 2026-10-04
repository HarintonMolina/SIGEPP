import { describe, expect, it } from 'vitest';
import { createAuthApi } from '../features/auth/auth-api';
import { createLogoutStore } from '../features/auth/logout-store';
import { createSessionService } from '../features/auth/session';
import type { LoginInput } from '../features/auth/contracts';
import { deferred } from '../test/deferred';
import { makeSesionResponse, makeUsuario } from '../test/fixtures';
import { createHttpClient } from './client';
import { createTransport } from './transport';

const env = { apiUrl: 'http://localhost:4000/api/v1', institutionalDomains: ['uni.edu.ni'] };
const login: LoginInput = { correo: 'ana@std.uni.edu.ni', contrasena: 'secreto' };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const failure = (status: number) => response({ error: { codigo: 'ERROR', mensaje: 'Falló', detalles: [] } }, status);
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function setup(handle: (path: string, init: RequestInit) => Promise<Response> | Response,
  onInvalidate: () => Promise<void> = async () => {}) {
  const requests: { path: string; init: RequestInit }[] = [];
  const fetchImpl: typeof fetch = async (input, init = {}) => {
    const path = new URL(String(input)).pathname.replace('/api/v1', '');
    requests.push({ path, init });
    if (path === '/auth/login') {
      const input = JSON.parse(String(init.body)) as LoginInput;
      return response(input.correo === 'b@uni.edu.ni'
        ? { accessToken: 'token-login-B', usuario: makeUsuario('ESTUDIANTE', { id: 'usuario-B', correo: input.correo }) }
        : makeSesionResponse(undefined, 'token-A'));
    }
    return handle(path, init);
  };
  const transport = createTransport(env, fetchImpl);
  const authApi = createAuthApi(transport);
  const session = createSessionService({ api: authApi, logoutStore: createLogoutStore(sessionStorage), onInvalidate });
  const http = createHttpClient(transport, session);
  return { session, http, authApi, requests };
}

describe('cliente protegido', () => {
  it('cuatro 401 comparten un refresh real y repiten una vez con Bearer y cookies', async () => {
    sessionStorage.clear();
    const renewal = deferred<Response>();
    const state = setup((path, init) => {
      if (path === '/auth/refresh') return renewal.promise;
      return new Headers(init.headers).get('Authorization') === 'Bearer token-B'
        ? response({ usuario: makeUsuario() }) : failure(401);
    });
    await state.session.login(login);
    const pending = Array.from({ length: 4 }, () => state.http.request('/auth/yo').catch((e: unknown) => e));
    await tick();
    expect(state.requests.filter((r) => r.path === '/auth/refresh')).toHaveLength(1);
    renewal.resolve(response(makeSesionResponse(undefined, 'token-B')));
    expect(await Promise.all(pending)).toEqual(Array.from({ length: 4 }, () => ({ usuario: makeUsuario() })));
    const privateCalls = state.requests.filter((r) => r.path === '/auth/yo');
    expect(privateCalls).toHaveLength(8);
    expect(privateCalls.every((r) => r.init.credentials === 'include')).toBe(true);
  });

  it.each(['token-B', 'token-A'])('401 tardío reutiliza versión renovada aunque JWT sea %s', async (token) => {
    sessionStorage.clear();
    const late = deferred<Response>();
    let calls = 0;
    const state = setup((path) => {
      if (path === '/auth/refresh') return response(makeSesionResponse(undefined, token));
      calls += 1;
      if (calls === 1) return late.promise;
      return calls === 2 ? failure(401) : response({ usuario: makeUsuario() });
    });
    await state.session.login(login);
    const version = state.session.getSnapshot().tokenVersion;
    const slow = state.http.request('/auth/yo');
    await state.http.request('/auth/yo');
    late.resolve(failure(401));
    await expect(slow).resolves.toEqual({ usuario: makeUsuario() });
    expect(state.session.getSnapshot().tokenVersion).toBe(version + 1);
    expect(state.requests.filter((r) => r.path === '/auth/refresh')).toHaveLength(1);
    expect(calls).toBe(4);
  });

  it('403 protegido y 401 de login/registro no renuevan', async () => {
    sessionStorage.clear();
    const state = setup(() => failure(403));
    await state.session.login(login);
    await expect(state.http.request('/auth/yo')).rejects.toMatchObject({ status: 403 });
    const publicFetch: typeof fetch = async () => failure(401);
    const auth = createAuthApi(createTransport(env, publicFetch));
    await expect(auth.login(login)).rejects.toMatchObject({ status: 401 });
    await expect(auth.registro({ ...login, nombres: 'Ana', apellidos: 'Pérez', rol: 'ESTUDIANTE',
      carnet: '2026-12345', carrera: 'Informática', anio: 3 })).rejects.toMatchObject({ status: 401 });
    expect(state.requests.filter((r) => r.path === '/auth/refresh')).toHaveLength(0);
    expect(state.session.getSnapshot().status).toBe('autenticada');
  });

  it('segundo 401 invalida y termina con dos intentos, sin bucle', async () => {
    sessionStorage.clear();
    const state = setup((path) => path === '/auth/refresh' ? response(makeSesionResponse()) : failure(401));
    await state.session.login(login);
    await expect(state.http.request('/auth/yo')).rejects.toMatchObject({ status: 401 });
    expect(state.requests.filter((r) => r.path === '/auth/yo')).toHaveLength(2);
    expect(state.requests.filter((r) => r.path === '/auth/refresh')).toHaveLength(1);
    expect(state.session.getSnapshot().status).toBe('anonima');
  });

  it('refresh 500 compartido permanece memorizado para 401 tardíos', async () => {
    sessionStorage.clear();
    const late = deferred<Response>();
    let calls = 0;
    const state = setup((path) => {
      if (path === '/auth/refresh') return failure(500);
      calls += 1;
      return calls === 1 ? late.promise : failure(401);
    });
    await state.session.login(login);
    const slow = state.http.request('/auth/yo').catch((e: unknown) => e);
    const errors = await Promise.all([state.http.request('/auth/yo'), state.http.request('/auth/yo')].map((p) => p.catch((e: unknown) => e)));
    late.resolve(failure(401));
    const slowError = await slow;
    expect(errors[0]).toMatchObject({ status: 500 });
    expect(errors[1]).toBe(errors[0]);
    expect(slowError).toBe(errors[0]);
    expect(state.requests.filter((r) => r.path === '/auth/refresh')).toHaveLength(1);
    expect(calls).toBe(3);
  });

  it('abortar consumidor esperando refresh no aborta la renovación compartida', async () => {
    sessionStorage.clear();
    const renewal = deferred<Response>();
    const controller = new AbortController();
    const state = setup((path, init) => path === '/auth/refresh' ? renewal.promise
      : new Headers(init.headers).get('Authorization') === 'Bearer token-B' ? response({ usuario: makeUsuario() }) : failure(401));
    await state.session.login(login);
    const aborted = state.http.request('/auth/yo', { signal: controller.signal }).catch((e: unknown) => e);
    const survivor = state.http.request('/auth/yo').catch((e: unknown) => e);
    await tick();
    controller.abort();
    // Must settle before refresh does, even if fetch ignores consumer cancellation.
    expect(await aborted).toMatchObject({ name: 'AbortError' });
    expect(state.requests.find((r) => r.path === '/auth/refresh')?.init.signal).toBeUndefined();
    renewal.resolve(response(makeSesionResponse(undefined, 'token-B')));
    await expect(survivor).resolves.toEqual({ usuario: makeUsuario() });
    expect(state.requests.filter((r) => r.path === '/auth/yo')).toHaveLength(3);
  });

  it.each([200, 401])('respuesta %i de A tras login B se rechaza sin invalidar B', async (status) => {
    sessionStorage.clear();
    const late = deferred<Response>();
    const state = setup(() => late.promise);
    await state.session.login(login);
    const pending = state.http.request('/auth/yo').catch((e: unknown) => e);
    await state.session.login({ ...login, correo: 'b@uni.edu.ni' });
    const current = state.session.getAccess();
    late.resolve(status === 200 ? response({ usuario: makeUsuario() }) : failure(401));
    expect(await pending).toMatchObject({ kind: 'stale-session' });
    expect(state.session.getAccess()).toEqual(current);
    expect(state.session.getSnapshot().usuario?.id).toBe('usuario-B');
    expect(state.requests.filter((r) => r.path === '/auth/refresh')).toHaveLength(0);
  });

  it('401 de repetición de A tras login B se descarta sin invalidar B', async () => {
    sessionStorage.clear();
    const late = deferred<Response>();
    let calls = 0;
    const state = setup((path) => {
      if (path === '/auth/refresh') return response(makeSesionResponse());
      calls += 1;
      return calls === 1 ? failure(401) : late.promise;
    });
    await state.session.login(login);
    const pending = state.http.request('/auth/yo').catch((e: unknown) => e);
    await tick();
    await state.session.login(login);
    const current = state.session.getAccess();
    late.resolve(failure(401));
    expect(await pending).toMatchObject({ kind: 'stale-session' });
    expect(state.session.getAccess()).toEqual(current);
  });

  it('sin acceso no envía petición ni restaura indefinidamente; señal abortada tampoco envía', async () => {
    sessionStorage.clear();
    const state = setup(() => response({}));
    await expect(state.http.request('/auth/yo')).rejects.toMatchObject({ status: 401 });
    expect(state.requests).toHaveLength(0);
    await state.session.login(login);
    const controller = new AbortController();
    controller.abort();
    await expect(state.http.request('/auth/yo', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(state.requests).toHaveLength(1);
  });

  it('recrea JSON y conserva señal al repetir sin permitir Authorization ajena', async () => {
    sessionStorage.clear();
    const state = setup((path, init) => path === '/auth/refresh' ? response(makeSesionResponse(undefined, 'token-B'))
      : new Headers(init.headers).get('Authorization') === 'Bearer token-B' ? response({ ok: true }) : failure(401));
    await state.session.login(login);
    const controller = new AbortController();
    await expect(state.http.request('/perfil', { method: 'PATCH', json: { nombres: 'Ana' }, signal: controller.signal,
      headers: { authorization: 'Bearer ajena' } })).resolves.toEqual({ ok: true });
    const calls = state.requests.filter((r) => r.path === '/perfil');
    expect(calls.map((r) => r.init.body)).toEqual(['{"nombres":"Ana"}', '{"nombres":"Ana"}']);
    expect(calls.every((r) => r.init.signal === controller.signal)).toBe(true);
    expect(new Headers(calls[0].init.headers).get('Authorization')).toBe('Bearer token-A');
  });

  it('401 de repetición con versión anterior no invalida una renovación posterior', async () => {
    sessionStorage.clear();
    const late = deferred<Response>();
    let calls = 0;
    const state = setup((path) => {
      if (path === '/auth/refresh') return response(makeSesionResponse());
      calls += 1;
      return calls === 1 ? failure(401) : late.promise;
    });
    await state.session.login(login);
    const pending = state.http.request('/auth/yo').catch((e: unknown) => e);
    await tick();
    await state.session.refresh(state.session.getAccess()!);
    const current = state.session.getAccess();
    late.resolve(failure(401));
    expect(await pending).toMatchObject({ status: 401 });
    expect(state.session.getAccess()).toEqual(current);
    expect(calls).toBe(2);
  });

  it.each([400, 409, 429, 500])('HTTP %i no renueva y conserva identidad', async (status) => {
    sessionStorage.clear();
    const state = setup(() => failure(status));
    await state.session.login(login);
    const current = state.session.getAccess();
    await expect(state.http.request('/auth/yo')).rejects.toMatchObject({ status });
    expect(state.session.getAccess()).toEqual(current);
    expect(state.requests.filter((r) => r.path === '/auth/refresh')).toHaveLength(0);
  });

  it.each(['login', 'logout'] as const)('refresh A fallido después de %s rechaza stale-session y no afecta identidad vigente', async (operation) => {
    sessionStorage.clear();
    const renewal = deferred<Response>();
    const state = setup((path) => {
      if (path === '/auth/refresh') return renewal.promise;
      if (path === '/auth/logout') return new Response(null, { status: 204 });
      return failure(401);
    });
    await state.session.login(login);
    const privateResult = state.http.request('/auth/yo').catch((e: unknown) => e);
    await tick();
    expect(state.requests.filter((r) => r.path === '/auth/refresh')).toHaveLength(1);
    const change = operation === 'login'
      ? state.session.login({ ...login, correo: 'b@uni.edu.ni' }) : state.session.logout();
    renewal.resolve(failure(500));
    expect(await privateResult).toMatchObject({ kind: 'stale-session' });
    await change;
    if (operation === 'login') {
      expect(state.session.getSnapshot().usuario?.id).toBe('usuario-B');
      expect(state.session.getAccess()?.accessToken).toBe('token-login-B');
    } else {
      expect(state.session.getSnapshot()).toMatchObject({ status: 'anonima', logoutPending: false });
      expect(state.session.getAccess()).toBeNull();
    }
  });

  it.each([401, 403])('refresh vigente %i conserva un error compartido aunque su invalidación avance generación', async (status) => {
    sessionStorage.clear();
    const renewal = deferred<Response>();
    const state = setup((path) => path === '/auth/refresh' ? renewal.promise : failure(401));
    await state.session.login(login);
    const generation = state.session.getSnapshot().generation;
    const results = Array.from({ length: 4 }, () => state.http.request('/auth/yo').catch((e: unknown) => e));
    await tick();
    expect(state.requests.filter((r) => r.path === '/auth/refresh')).toHaveLength(1);
    renewal.resolve(failure(status));
    const errors = await Promise.all(results);
    expect(errors[0]).toMatchObject({ kind: 'http', status });
    expect(errors.every((error) => error === errors[0])).toBe(true);
    expect(state.session.getSnapshot().generation).toBe(generation + 1);
    expect(state.session.getSnapshot().status).toBe('anonima');
    expect(state.requests.filter((r) => r.path === '/auth/yo')).toHaveLength(4);
    expect(state.requests.filter((r) => r.path === '/auth/refresh')).toHaveLength(1);
  });

  it.each(['resuelve', 'rechaza'] as const)('segundo 401 tras login B durante cleanup que %s devuelve stale-session', async (outcome) => {
    sessionStorage.clear();
    const cleanupStarted = deferred<void>();
    const cleanup = deferred<void>();
    let invalidations = 0;
    const state = setup((path) => path === '/auth/refresh'
      ? response(makeSesionResponse(undefined, 'token-renovado-A')) : failure(401), () => {
      invalidations += 1;
      if (invalidations === 2) {
        cleanupStarted.resolve();
        return cleanup.promise;
      }
      return Promise.resolve();
    });
    await state.session.login(login);
    const generationA = state.session.getSnapshot().generation;
    const privateResult = state.http.request('/auth/yo').catch((e: unknown) => e);
    await cleanupStarted.promise;
    expect(state.session.getSnapshot().generation).toBe(generationA + 1);
    const replacement = state.session.login({ ...login, correo: 'b@uni.edu.ni' }).catch((e: unknown) => e);
    const generationB = state.session.getSnapshot().generation;
    expect(generationB).toBe(generationA + 2);
    if (outcome === 'resuelve') cleanup.resolve();
    else cleanup.reject(new Error('No se pudo limpiar caché privada'));
    const oldError = await privateResult;
    const loginResult = await replacement;
    expect(oldError).toMatchObject({ kind: 'stale-session' });
    expect(state.session.getSnapshot().generation).toBe(generationB);
    if (outcome === 'resuelve') {
      expect(loginResult).toBeUndefined();
      expect(state.session.getSnapshot().usuario?.id).toBe('usuario-B');
      expect(state.session.getAccess()?.accessToken).toBe('token-login-B');
    } else {
      // A failed private-cache barrier prevents publishing B; A cannot replace B's failure.
      expect(loginResult).toMatchObject({ kind: 'network', codigo: 'ERROR_SESION' });
      expect(state.session.getSnapshot().error).toBe(loginResult);
      expect(state.session.getAccess()).toBeNull();
    }
    expect(invalidations).toBe(3);
    expect(state.requests.filter((r) => r.path === '/auth/yo')).toHaveLength(2);
    expect(state.requests.filter((r) => r.path === '/auth/refresh')).toHaveLength(1);
  });
});
