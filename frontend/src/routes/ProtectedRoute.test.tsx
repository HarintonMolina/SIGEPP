import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { RouterProvider } from 'react-router-dom';
import { createRuntime } from '../app/runtime';
import { Providers } from '../app/Providers';
import { makeSesionResponse, makeUsuario } from '../test/fixtures';
import { deferred } from '../test/deferred';
import { createAppRouter, type PageRegistry } from './router';
import { useRuntime } from '../hooks/useRuntime';
import { useEffect } from 'react';
import { SessionContext } from '../hooks/useSession';
import type { Rol } from '../features/auth/contracts';
import type { SessionSnapshot } from '../features/auth/session.types';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const env = { apiUrl: 'http://localhost:4000/api/v1', institutionalDomains: ['uni.edu.ni'] };
const errorResponse = (status: number) => json({ error: { codigo: 'ERROR', mensaje: 'Servicio no disponible', detalles: [] } }, status);
function PrivatePage() {
  const runtime = useRuntime();
  useEffect(() => { void runtime.http.request('/privada').catch(() => undefined); }, [runtime]);
  return <p>Contenido privado de prueba</p>;
}
const pages: PageRegistry = {
  login: async () => ({ default: () => <h1>Login de prueba</h1> }),
  registro: async () => ({ default: () => <h1>Registro de prueba</h1> }),
  inicio: async () => ({ default: PrivatePage }), perfil: async () => ({ default: PrivatePage }),
  modulo: async () => ({ default: PrivatePage }),
};
const routers: ReturnType<typeof createAppRouter>[] = [];
afterEach(() => { routers.forEach((router) => router.dispose()); routers.length = 0; sessionStorage.clear(); });
function setup(path: string, fetchImpl: typeof fetch, registry = pages) {
  window.history.replaceState(null, '', path);
  const runtime = createRuntime({ env, fetchImpl, storage: sessionStorage });
  const router = createAppRouter(registry);
  routers.push(router);
  render(<Providers runtime={runtime}><RouterProvider router={router} future={{ v7_startTransition: true }} /></Providers>);
  return { runtime, router };
}

it('waits for restoration without login navigation or private work', async () => {
  const pending = deferred<Response>();
  const requests: string[] = [];
  const { router } = setup('/plazas?area=software', async (url) => { requests.push(String(url)); return pending.promise; });
  expect(screen.getByRole('status')).toHaveTextContent(/sesión/i);
  expect(router.state.location.pathname).toBe('/plazas');
  expect(screen.queryByText('Contenido privado de prueba')).not.toBeInTheDocument();
  await waitFor(() => expect(requests).toHaveLength(1));
  await act(async () => { pending.resolve(errorResponse(401)); });
  expect(await screen.findByRole('heading', { name: 'Login de prueba' })).toBeInTheDocument();
  expect(router.state.location.state).toEqual({ returnTo: '/plazas?area=software' });
  expect(requests.every((url) => url.endsWith('/auth/refresh'))).toBe(true);
});
it('recovers explicitly after restoration failure without mounting private content', async () => {
  let attempts = 0;
  const calls: string[] = [];
  setup('/perfil', async (url) => {
    calls.push(String(url));
    if (String(url).endsWith('/auth/refresh')) return ++attempts === 1 ? errorResponse(503) : json(makeSesionResponse());
    return json({});
  });
  expect(await screen.findByRole('alert')).toHaveTextContent(/Servicio no disponible/);
  expect(screen.getByRole('link', { name: /login|iniciar sesión/i })).toHaveAttribute('href', '/login');
  expect(calls).toHaveLength(1);
  await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
  expect(await screen.findByText('Contenido privado de prueba')).toBeInTheDocument();
  expect(attempts).toBe(2);
});
it.each(['/expediente', '/org/tutores'])('denies ADMIN %s without private queries', async (path) => {
  const calls: string[] = [];
  setup(path, async (url) => { calls.push(String(url)); return json(makeSesionResponse('ADMIN')); });
  expect(await screen.findByRole('heading', { name: /403/ })).toBeInTheDocument();
  expect(screen.queryByText('Contenido privado de prueba')).not.toBeInTheDocument();
  expect(calls).toHaveLength(1);
});
it.each(['/desconocida', '/403'])('keeps %s outside private routes and offers role home', async (path) => {
  const calls: string[] = [];
  setup(path, async (url) => { calls.push(String(url)); return json(makeSesionResponse('COORDINADOR')); });
  expect(await screen.findByRole('heading', { name: path === '/403' ? /403/ : /404/ })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('link', { name: /inicio/i })).toHaveAttribute('href', '/panel'));
  expect(calls).toHaveLength(1);
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});
it.each([
  ['ESTUDIANTE', '/inicio'], ['TUTOR_ACADEMICO', '/inicio'], ['TUTOR_EMPRESARIAL', '/inicio'],
  ['COORDINADOR', '/panel'], ['ORGANIZACION', '/org/inicio'], ['ADMIN', '/inicio'],
] as const)('resolves root and public routes for %s', async (rol, target) => {
  const { router } = setup('/', async (url) => String(url).endsWith('/auth/refresh') ? json(makeSesionResponse(rol)) : json({}));
  await waitFor(() => expect(router.state.location.pathname).toBe(target));
  await act(() => router.navigate('/login?returnTo=https://evil.example'));
  await waitFor(() => expect(router.state.location.pathname).toBe(target));
  await act(() => router.navigate('/registro'));
  await waitFor(() => expect(router.state.location.pathname).toBe(target));
});
it('resolves anonymous root to login', async () => {
  const { router } = setup('/', async () => errorResponse(401));
  expect(await screen.findByRole('heading', { name: 'Login de prueba' })).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/login');
});
it('resolves the organization profile alias to the concrete profile', async () => {
  const { router } = setup('/org/perfil', async (url) => String(url).endsWith('/auth/refresh') ? json(makeSesionResponse('ORGANIZACION')) : json({}));
  await waitFor(() => expect(router.state.location.pathname).toBe('/perfil'));
  expect(await screen.findByText('Contenido privado de prueba')).toBeInTheDocument();
});
it('fails closed if a foreign role reaches the view boundary', async () => {
  const runtime = createRuntime({ env, fetchImpl: async () => errorResponse(401), storage: sessionStorage });
  const snapshot: SessionSnapshot = { status: 'autenticada', usuario: makeUsuario('INVALIDO' as Rol), error: null, generation: 1, tokenVersion: 1, logoutPending: false, logoutPersistenceAvailable: true };
  const service = { ...runtime.session, getSnapshot: () => snapshot, initialize: async () => undefined };
  window.history.replaceState(null, '', '/inicio');
  const router = createAppRouter(pages); routers.push(router);
  render(<Providers runtime={runtime}><SessionContext.Provider value={service}><RouterProvider router={router} future={{ v7_startTransition: true }} /></SessionContext.Provider></Providers>);
  expect(await screen.findByRole('heading', { name: /403/ })).toBeInTheDocument();
  expect(screen.queryByText('Contenido privado de prueba')).not.toBeInTheDocument();
});
it('shows a safe recovery page for a rejected lazy chunk', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const expectedChunkError = (event: ErrorEvent) => {
    if (event.error instanceof Error && event.error.message === 'secret stack') event.preventDefault();
  };
  window.addEventListener('error', expectedChunkError);
  try {
    setup('/plazas', async () => json(makeSesionResponse()), { ...pages, modulo: async () => { throw new Error('secret stack'); } });
    expect(await screen.findByRole('heading', { name: /no pudimos cargar/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /inicio/i })).toHaveAttribute('href', '/inicio');
    expect(screen.queryByText(/secret stack/)).not.toBeInTheDocument();
  } finally { consoleError.mockRestore(); window.removeEventListener('error', expectedChunkError); }
});
