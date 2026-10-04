import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useQueryClient } from '@tanstack/react-query';
import { createRuntime, type AppRuntime } from '../../app/runtime';
import { Providers } from '../../app/Providers';
import { useRuntime } from '../../hooks/useRuntime';
import { useSession } from '../../hooks/useSession';
import { deferred } from '../../test/deferred';
import { makeSesionResponse } from '../../test/fixtures';
import type { SessionService } from './session.types';

const env = { apiUrl: 'http://localhost:4000/api/v1', institutionalDomains: ['uni.edu.ni'] };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
afterEach(() => sessionStorage.clear());

function View({ expected, onRender }: { expected: AppRuntime; onRender: () => void }) {
  const { snapshot, service } = useSession();
  const runtime = useRuntime();
  const queryClient = useQueryClient();
  onRender();
  return <div>{snapshot.status};{service === expected.session && runtime === expected && queryClient === expected.queryClient ? 'inyectado' : 'incorrecto'}</div>;
}

describe('proveedor de sesión', () => {
  it.each([200, 401])('StrictMode, unsubscribe y remount comparten bootstrap %i sin abortar', async (status) => {
    const renewal = deferred<Response>();
    let refreshCalls = 0;
    let refreshSignal: AbortSignal | null | undefined;
    const runtime = createRuntime({ env, storage: sessionStorage, fetchImpl: async (_url, init) => {
      refreshCalls += 1;
      refreshSignal = init?.signal;
      return renewal.promise;
    } });
    let active = 0;
    let notifiedAfterUnsubscribe = 0;
    const original = runtime.session.subscribe;
    const instrumented: SessionService = { ...runtime.session, subscribe(listener) {
      active += 1;
      let subscribed = true;
      const unsubscribe = original(() => {
        if (!subscribed) notifiedAfterUnsubscribe += 1;
        listener();
      });
      return () => { subscribed = false; active -= 1; unsubscribe(); };
    } };
    runtime.session = instrumented;
    let renders = 0;
    const mount = () => render(<StrictMode><Providers runtime={runtime}><View expected={runtime} onRender={() => { renders += 1; }} /></Providers></StrictMode>);
    const first = mount();
    expect(screen.getByText('restaurando;inyectado')).toBeInTheDocument();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(refreshCalls).toBe(1);
    expect(active).toBe(1);
    first.unmount();
    expect(active).toBe(0);
    const before = renders;
    await act(async () => {
      renewal.resolve(status === 200 ? json(makeSesionResponse()) : json({ error: { codigo: 'NO_SESION', mensaje: 'No hay sesión', detalles: [] } }, 401));
      await runtime.session.initialize();
    });
    expect(renders).toBe(before);
    expect(notifiedAfterUnsubscribe).toBe(0);
    expect(refreshSignal).toBeUndefined();
    const second = mount();
    await waitFor(() => expect(screen.getByText(`${status === 200 ? 'autenticada' : 'anonima'};inyectado`)).toBeInTheDocument());
    expect(refreshCalls).toBe(1);
    expect(active).toBe(1);
    second.unmount();
    expect(active).toBe(0);
  });
});
