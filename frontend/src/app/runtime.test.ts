import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryObserver } from '@tanstack/react-query';
import { createRuntime } from './runtime';
import { createQueryClient } from '../api/query-client';
import { deferred } from '../test/deferred';
import { makeSesionResponse } from '../test/fixtures';
import type { LoginInput } from '../features/auth/contracts';

const env = { apiUrl: 'http://localhost:4000/api/v1', institutionalDomains: ['uni.edu.ni'] };
const login: LoginInput = { correo: 'ana@std.uni.edu.ni', contrasena: 'secreto' };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
afterEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); });

describe('runtime privado', () => {
  it.each(['logout', 'login', 'invalidate'] as const)('%s cancela consulta y limpia query/mutation; respuestas tardías no publican éxito', async (operation) => {
    const lateQuery = deferred<Response>();
    const lateMutation = deferred<Response>();
    let signal: AbortSignal | null | undefined;
    const fetchImpl: typeof fetch = async (url, init) => {
      if (String(url).endsWith('/auth/login')) return json(makeSesionResponse());
      if (String(url).endsWith('/auth/logout')) return new Response(null, { status: 204 });
      if (String(url).endsWith('/consulta')) { signal = init?.signal; return lateQuery.promise; }
      return lateMutation.promise;
    };
    const runtime = createRuntime({ env, fetchImpl, storage: sessionStorage });
    await runtime.session.login(login);
    const identity = runtime.session.getAccess()!;
    const query = runtime.queryClient.fetchQuery({
      queryKey: ['privada', identity.generation, identity.tokenVersion],
      queryFn: ({ signal }) => runtime.http.request('/consulta', { signal }),
    }).catch((e: unknown) => e);
    const success = vi.fn();
    const mutation = runtime.queryClient.getMutationCache().build(runtime.queryClient, {
      mutationFn: () => runtime.http.request('/mutacion', { method: 'POST', json: {} }), onSuccess: success,
    });
    const mutated = mutation.execute(undefined).catch((e: unknown) => e);
    await tick();
    if (operation === 'logout') await runtime.session.logout();
    if (operation === 'login') await runtime.session.login(login);
    if (operation === 'invalidate') await runtime.session.invalidate(identity);
    expect(signal?.aborted).toBe(true);
    expect(runtime.queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(runtime.queryClient.getMutationCache().getAll()).toHaveLength(0);
    lateQuery.resolve(json({ secreto: 'A' }));
    lateMutation.resolve(json({ secreto: 'A' }));
    await query;
    expect(await mutated).toMatchObject({ kind: 'stale-session' });
    expect(success).not.toHaveBeenCalled();
    expect(runtime.queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(runtime.queryClient.getMutationCache().getAll()).toHaveLength(0);
  });

  it('errores Query/mutation no reintentan; foco y reconexión no hacen nuevas consultas', async () => {
    const client = createQueryClient();
    let queryCalls = 0;
    let mutationCalls = 0;
    const observer = new QueryObserver(client, { queryKey: ['fallida'], queryFn: async () => { queryCalls += 1; throw new Error('fallo'); } });
    const unsubscribe = observer.subscribe(() => {});
    await tick();
    await tick();
    // The cache handlers consult each observer's defaults for focus/reconnect.
    client.getQueryCache().onFocus();
    client.getQueryCache().onOnline();
    await tick();
    const mutation = client.getMutationCache().build(client, { mutationFn: async () => { mutationCalls += 1; throw new Error('fallo'); } });
    await expect(mutation.execute(undefined)).rejects.toThrow('fallo');
    expect(queryCalls).toBe(1);
    expect(mutationCalls).toBe(1);
    expect(observer.getCurrentResult().isError).toBe(true);
    unsubscribe();
    client.clear();
  });

  it('sessionStorage getter SecurityError usa fallback booleano en memoria', async () => {
    const getter = vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new DOMException('Bloqueado', 'SecurityError'); });
    const fetchImpl: typeof fetch = async (url) => String(url).endsWith('/auth/login')
      ? json(makeSesionResponse()) : json({ error: { codigo: 'ERROR', mensaje: 'Falló', detalles: [] } }, 500);
    let runtime: ReturnType<typeof createRuntime> | undefined;
    expect(() => { runtime = createRuntime({ env, fetchImpl }); }).not.toThrow();
    await runtime!.session.login(login);
    await expect(runtime!.session.logout()).rejects.toMatchObject({ status: 500 });
    expect(runtime!.session.getSnapshot()).toMatchObject({ logoutPending: true, logoutPersistenceAvailable: false, status: 'anonima' });
    getter.mockRestore();
  });
});
