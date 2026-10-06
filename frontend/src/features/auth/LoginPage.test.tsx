import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, RouterProvider, Routes, useLocation } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { Providers } from '../../app/Providers';
import { createRuntime } from '../../app/runtime';
import { makeSesionResponse } from '../../test/fixtures';
import { deferred } from '../../test/deferred';
import LoginPage from './LoginPage';
import { pages } from '../../app/pages';
import { createAppRouter } from '../../routes/router';
import { isCurrentAuthOperation, useLogin, useLogout, useRegistro } from './auth-hooks';
import { onlineManager } from '@tanstack/react-query';

const env = { apiUrl: 'http://localhost:4000/api/v1', institutionalDomains: ['uni.edu.ni', 'std.uni.edu.ni'] };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const failure = (status = 401, mensaje = 'Credenciales incorrectas.') => json({ error: { codigo: 'ERROR', mensaje, detalles: [] } }, status);
function Destination() { const location = useLocation(); return <p>Destino: {location.pathname}{location.search}</p>; }
async function mount(fetchImpl: typeof fetch, entry = '/login', blocked = false) {
  const runtime = createRuntime({ env, fetchImpl, storage: blocked ? { getItem() { throw Error('bloqueado'); }, setItem() { throw Error('bloqueado'); }, removeItem() { throw Error('bloqueado'); } } : sessionStorage });
  await runtime.session.initialize();
  render(<Providers runtime={runtime}><MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/login" element={<LoginPage />} /><Route path="*" element={<Destination />} /></Routes></MemoryRouter></Providers>);
  return runtime;
}
async function fill() {
  await userEvent.type(screen.getByLabelText('Correo'), 'gerente@empresa.com', { delay: null });
  await userEvent.type(screen.getByLabelText('Contraseña'), 'secreto123', { delay: null });
}
afterEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); });

it.each([['TUTOR_EMPRESARIAL', '/candidatos', '/candidatos'], ['ESTUDIANTE', '/admin/auditoria', '/inicio'], ['ADMIN', 'https://evil.example', '/inicio'], ['TUTOR_ACADEMICO', '/postulaciones', '/inicio'], ['COORDINADOR', '/postulaciones', '/panel'], ['ORGANIZACION', '//evil.example', '/org/inicio']] as const)('login %s acepta correo empresarial y valida destino por rol', async (rol, returnTo, expected) => {
  const pending = deferred<Response>();
  const requests: { url: string; body: unknown }[] = [];
  await mount(async (url, init) => { requests.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null }); return String(url).endsWith('/auth/login') ? pending.promise : failure(); }, '/login?returnTo=' + encodeURIComponent(returnTo));
  await fill();
  const button = screen.getByRole('button', { name: 'Iniciar sesión' });
  fireEvent.submit(button.closest('form')!); fireEvent.submit(button.closest('form')!);
  await waitFor(() => expect(requests.filter((r) => r.url.endsWith('/auth/login'))).toHaveLength(1));
  expect(button).toBeDisabled();
  expect(requests.find((r) => r.url.endsWith('/auth/login'))?.body).toEqual({ correo: 'gerente@empresa.com', contrasena: 'secreto123' });
  await act(async () => pending.resolve(json(makeSesionResponse(rol))));
  expect(await screen.findByText('Destino: ' + expected)).toBeInTheDocument();
  expect(requests.filter((r) => r.url.endsWith('/auth/refresh'))).toHaveLength(1);
});

it.each([[401, 'Credenciales incorrectas.'], [403, 'Tu cuenta está inactiva.'], [429, 'Demasiados intentos. Inténtalo más tarde.'], [0, 'No pudimos conectar con el servidor.']] as const)('error %s conserva valores y rehabilita controles sin refresh ni retry', async (status, message) => {
  const calls: string[] = [];
  await mount(async (url) => { calls.push(String(url)); if (!String(url).endsWith('/auth/login')) return failure(); if (!status) throw new TypeError('red'); return failure(status, message); });
  await fill(); await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(status ? message : /conexión|conectar/i);
  expect(screen.getByLabelText('Correo')).toHaveValue('gerente@empresa.com');
  expect(screen.getByLabelText('Contraseña')).toHaveValue('secreto123');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled());
  expect(calls.filter((url) => url.endsWith('/auth/login'))).toHaveLength(1);
  expect(calls.filter((url) => url.endsWith('/auth/refresh'))).toHaveLength(1);
});

it.each([false, true])('logout remoto pendiente persiste en login; almacenamiento bloqueado=%s y reintento explícito', async (blocked) => {
  let logoutCalls = 0;
  const runtime = await mount(async (url) => {
    if (String(url).endsWith('/auth/logout')) { logoutCalls++; return logoutCalls === 1 ? failure(500, 'No se pudo cerrar la sesión remota.') : new Response(null, { status: 204 }); }
    return failure();
  }, '/login', blocked);
  await act(async () => { await runtime.session.logout().catch(() => {}); });
  expect(screen.getByRole('complementary', { name: 'Cierre de sesión pendiente' })).toBeInTheDocument();
  expect(!!screen.queryByText(/almacenamiento.*no|no.*persistir/i)).toBe(blocked);
  expect(logoutCalls).toBe(1);
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar cierre de sesión' }));
  await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Cierre de sesión pendiente' })).not.toBeInTheDocument());
  expect(logoutCalls).toBe(2);
});

it.each([401, 200])('login antiguo %s no muestra error ni navega tras otra identidad', async (status) => {
  const pending = deferred<Response>(); let loginCalls = 0;
  const runtime = await mount(async (url) => String(url).endsWith('/auth/login') ? (++loginCalls === 1 ? pending.promise : json(makeSesionResponse('ADMIN'))) : failure());
  await fill(); await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
  await waitFor(() => expect(loginCalls).toBe(1));
  let newer!: Promise<void>;
  act(() => { newer = runtime.session.login({ correo: 'otro@empresa.com', contrasena: 'secreto' }); });
  await act(async () => { pending.resolve(status === 401 ? failure(401, 'Error antiguo') : json(makeSesionResponse())); await newer; });
  expect(screen.queryByText('Error antiguo')).not.toBeInTheDocument();
  expect(screen.queryByText(/Destino:/)).not.toBeInTheDocument();
});

it('login ofrece restauración explícita y no renueva de nuevo al mostrar su formulario', async () => {
  let refreshCalls = 0;
  await mount(async (url) => { if (String(url).endsWith('/auth/refresh')) { refreshCalls++; return failure(500, 'No pudimos restaurar tu sesión.'); } return failure(); });
  expect(screen.getByRole('alert')).toHaveTextContent('No pudimos restaurar tu sesión.');
  expect(screen.getByLabelText('Correo')).toBeEnabled(); expect(refreshCalls).toBe(1);
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar restauración' }));
  await waitFor(() => expect(refreshCalls).toBe(2));
  expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos restaurar tu sesión.');
});

it.each([['/candidatos', '/candidatos', 'query'], ['/candidatos', '/candidatos', 'state'], ['https://evil.example', '/inicio', 'query']] as const)('router real tras login valida retorno %s en %s (%s)', async (returnTo, expected, source) => {
  const runtime = createRuntime({ env, storage: sessionStorage, fetchImpl: async (url) => String(url).endsWith('/auth/login') ? json(makeSesionResponse('TUTOR_EMPRESARIAL')) : failure() });
  await runtime.session.initialize();
  window.history.replaceState(null, '', source === 'query' ? '/login?returnTo=' + encodeURIComponent(returnTo) : '/login');
  const router = createAppRouter(pages);
  if (source === 'state') await router.navigate('/login', { state: { returnTo } });
  render(<Providers runtime={runtime}><RouterProvider router={router} future={{ v7_startTransition: true }} /></Providers>);
  await screen.findByLabelText('Correo'); await fill();
  await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
  await waitFor(() => expect(router.state.location.pathname).toBe(expected));
  expect(await screen.findByRole('heading', { level: 1, name: expected === '/candidatos' ? 'Candidatos' : 'Inicio' })).toBeInTheDocument();
  router.dispose(); window.history.replaceState(null, '', '/');
});

it('router raíz conserva inicio por rol aunque incluya retorno externo', async () => {
  const runtime = createRuntime({ env, storage: sessionStorage, fetchImpl: async () => json(makeSesionResponse('ORGANIZACION')) });
  await runtime.session.login({ correo: 'empresa@empresa.com', contrasena: 'secreto' }); await runtime.session.initialize();
  window.history.replaceState(null, '', '/?returnTo=https%3A%2F%2Fevil.example');
  const router = createAppRouter(pages);
  render(<Providers runtime={runtime}><RouterProvider router={router} future={{ v7_startTransition: true }} /></Providers>);
  await waitFor(() => expect(router.state.location.pathname).toBe('/org/inicio'));
  expect(await screen.findByRole('heading', { level: 1, name: 'Inicio' })).toBeInTheDocument();
  router.dispose(); window.history.replaceState(null, '', '/');
});

it('hooks mantienen contexto por invocación al reutilizar input; callbacks antiguos quedan obsoletos', async () => {
  const firstResponse = deferred<Response>(); let calls = 0;
  const runtime = createRuntime({ env, storage: sessionStorage, fetchImpl: async (url) => String(url).endsWith('/auth/login') ? (++calls === 1 ? firstResponse.promise : json(makeSesionResponse('ADMIN'))) : failure() });
  await runtime.session.initialize();
  const { result } = renderHook(useLogin, { wrapper: ({ children }) => <Providers runtime={runtime}>{children}</Providers> });
  const input = { correo: 'gerente@empresa.com', contrasena: 'clave' };
  let first!: Promise<unknown>; let second!: Promise<void>; let secondContext: unknown;
  act(() => { first = result.current.mutateAsync(input).catch((error: unknown) => error); });
  await waitFor(() => expect(calls).toBe(1));
  act(() => { second = result.current.mutateAsync(input, { onSuccess(_data, _input, operation) { secondContext = operation; expect(isCurrentAuthOperation(runtime.session, operation)).toBe(true); }, onError(error, _input, operation) { expect(isCurrentAuthOperation(runtime.session, operation, error)).toBe(false); }, onSettled(_data, error, _input, operation) { expect(isCurrentAuthOperation(runtime.session, operation, error)).toBe(true); } }); });
  await act(async () => { firstResponse.resolve(json(makeSesionResponse())); await second; });
  expect(await first).toMatchObject({ kind: 'stale-session' }); expect(calls).toBe(2);
  expect(isCurrentAuthOperation(runtime.session, secondContext)).toBe(true);
  await act(async () => { await runtime.session.invalidate(runtime.session.getAccess()!); });
  expect(isCurrentAuthOperation(runtime.session, secondContext)).toBe(false);
});

it('logout offline limpia identidad/caché inmediatamente, conserva fallo remoto y no reintenta al reconectar', async () => {
  let logoutCalls = 0;
  const runtime = createRuntime({ env, storage: sessionStorage, fetchImpl: async (url) => { if (String(url).endsWith('/auth/logout')) { logoutCalls++; throw new TypeError('sin red'); } return json(makeSesionResponse()); } });
  await runtime.session.login({ correo: 'gerente@empresa.com', contrasena: 'clave' }); await runtime.session.initialize();
  runtime.queryClient.setQueryData(['privada', 'secreto'], { dato: 'privado' });
  const { result } = renderHook(useLogout, { wrapper: ({ children }) => <Providers runtime={runtime}>{children}</Providers> });
  let completion: Promise<unknown> = Promise.resolve();
  try {
    onlineManager.setOnline(false);
    act(() => { completion = result.current.mutateAsync().catch((error: unknown) => error); });
    await waitFor(() => expect(runtime.session.getAccess()).toBeNull());
    expect(runtime.queryClient.getQueryData(['privada', 'secreto'])).toBeUndefined();
    expect(await completion).toMatchObject({ kind: 'network' });
    expect(runtime.session.getSnapshot()).toMatchObject({ status: 'anonima', logoutPending: true, error: { kind: 'network' } });
    expect(logoutCalls).toBe(1); expect(result.current.isPaused).toBe(false);
    await act(async () => { onlineManager.setOnline(true); });
    expect(logoutCalls).toBe(1); expect(runtime.session.getSnapshot().logoutPending).toBe(true);
  } finally {
    await act(async () => { onlineManager.setOnline(true); await completion; });
  }
});

it.each(['login', 'registro'] as const)('%s offline falla explícitamente sin permanecer pausado ni reintentar al reconectar', async (kind) => {
  const calls: string[] = [];
  const runtime = createRuntime({ env, storage: sessionStorage, fetchImpl: async (url) => { if (String(url).endsWith('/auth/refresh')) return failure(); calls.push(String(url)); throw new TypeError('sin red'); } });
  await runtime.session.initialize();
  const { result } = renderHook(() => ({ login: useLogin(), registro: useRegistro() }), { wrapper: ({ children }) => <Providers runtime={runtime}>{children}</Providers> });
  let completion: Promise<unknown> = Promise.resolve();
  try {
    onlineManager.setOnline(false);
    act(() => { completion = (kind === 'login' ? result.current.login.mutateAsync({ correo: 'gerente@empresa.com', contrasena: 'clave' }) : result.current.registro.mutateAsync({ rol: 'TUTOR_ACADEMICO', nombres: 'Ana', apellidos: 'Pérez', correo: 'ana@uni.edu.ni', contrasena: 'Clave1234', departamento: 'Computación' })).catch((error: unknown) => error); });
    await waitFor(() => expect(kind === 'login' ? result.current.login.isError : result.current.registro.isError).toBe(true));
    expect(await completion).toMatchObject({ kind: 'network' });
    expect(calls).toEqual(['http://localhost:4000/api/v1/auth/' + kind]);
    expect(kind === 'login' ? result.current.login.isPaused : result.current.registro.isPaused).toBe(false);
    await act(async () => { onlineManager.setOnline(true); }); expect(calls).toHaveLength(1);
  } finally {
    await act(async () => { onlineManager.setOnline(true); await completion; });
  }
});
