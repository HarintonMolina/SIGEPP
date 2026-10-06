import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Providers } from '../../app/Providers';
import { createRuntime } from '../../app/runtime';
import { makeSesionResponse, makeUsuario } from '../../test/fixtures';
import { deferred } from '../../test/deferred';
import RegistroPage from './RegistroPage';

const env = { apiUrl: 'http://localhost:4000/api/v1', institutionalDomains: ['uni.edu.ni', 'std.uni.edu.ni'] };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const failure = (status = 401, detalles: string[] = []) => json({ error: { codigo: 'ERROR', mensaje: 'Revisa los datos.', detalles } }, status);
function Destination() { const { state } = useLocation(); return <><p>Login tras registro</p><pre>{JSON.stringify(state)}</pre></>; }
async function mount(fetchImpl: typeof fetch) {
  const runtime = createRuntime({ env, fetchImpl, storage: sessionStorage }); await runtime.session.initialize();
  render(<Providers runtime={runtime}><MemoryRouter initialEntries={['/registro']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/registro" element={<RegistroPage />} /><Route path="/login" element={<Destination />} /></Routes></MemoryRouter></Providers>);
  return runtime;
}
async function fill() {
  for (const [label, value] of [['Nombres', 'Ana'], ['Apellidos', 'Pérez'], ['Correo', 'ana@std.uni.edu.ni'], ['Contraseña', 'Clave1234'], ['Confirmar contraseña', 'Clave1234'], ['Carnet', '2026-1234a'], ['Carrera', 'Ingeniería']]) await userEvent.type(screen.getByLabelText(label), value, { delay: null });
}
async function teacher() { screen.getByRole('combobox', { name: 'Rol' }).focus(); await userEvent.keyboard('{Enter}{ArrowDown}{Enter}'); }
beforeEach(() => { Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: () => {} }); });
afterEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); Reflect.deleteProperty(Element.prototype, 'scrollIntoView'); });

it.each(['ESTUDIANTE', 'TUTOR_ACADEMICO'] as const)('registro %s manda payload exacto una vez sin login y conserva Toast al navegar', async (rol) => {
  const requests: { url: string; body: unknown }[] = []; const pending = deferred<Response>();
  const runtime = await mount(async (url, init) => { requests.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null }); return String(url).endsWith('/auth/registro') ? pending.promise : failure(); });
  await fill();
  if (rol === 'ESTUDIANTE') { screen.getByRole('combobox', { name: 'Año' }).focus(); await userEvent.keyboard('{Enter}{ArrowDown}{ArrowDown}{Enter}'); }
  if (rol === 'TUTOR_ACADEMICO') { await teacher(); expect(screen.getByLabelText('Nombres')).toHaveValue('Ana'); expect(screen.queryByLabelText('Carnet')).not.toBeInTheDocument(); await userEvent.type(screen.getByLabelText('Departamento'), 'Computación', { delay: null }); }
  const submit = screen.getByRole('button', { name: 'Crear cuenta' });
  fireEvent.submit(submit.closest('form')!); fireEvent.submit(submit.closest('form')!);
  await waitFor(() => expect(requests.filter((r) => r.url.endsWith('/auth/registro'))).toHaveLength(1));
  expect(requests.find((r) => r.url.endsWith('/auth/registro'))?.body).toEqual({ nombres: 'Ana', apellidos: 'Pérez', correo: 'ana@std.uni.edu.ni', contrasena: 'Clave1234', rol, ...(rol === 'ESTUDIANTE' ? { carnet: '2026-1234A', carrera: 'Ingeniería', anio: 3 } : { departamento: 'Computación' }) });
  const password = screen.getByLabelText('Contraseña'); const confirmation = screen.getByLabelText('Confirmar contraseña');
  await act(async () => pending.resolve(json({ usuario: makeUsuario(rol) }, 201)));
  expect(await screen.findByText('Login tras registro')).toBeInTheDocument();
  expect(screen.getByText('Cuenta creada')).toBeInTheDocument();
  expect(screen.getByText('{"correo":"ana@std.uni.edu.ni"}')).toBeInTheDocument();
  expect(password).toHaveValue(''); expect(confirmation).toHaveValue('');
  expect(runtime.session.getSnapshot().status).toBe('anonima');
  expect(requests.filter((r) => r.url.endsWith('/auth/login'))).toHaveLength(0);
});

it('validación cliente enfoca primer campo y no envía HTTP', async () => {
  let calls = 0; await mount(async () => { calls++; return failure(); });
  await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
  await waitFor(() => expect(screen.getByLabelText('Nombres')).toHaveFocus());
  expect(screen.getByLabelText('Nombres')).toHaveAttribute('aria-invalid', 'true'); expect(calls).toBe(1);
});

it.each([[400, ['carnet: Carnet ocupado.'], 'Carnet'], [409, ['correo: Correo ocupado.'], 'Correo'], [409, ['conflicto no asociado'], null]] as const)('error %s asocia campo/resumen sin borrar valores', async (status, details, label) => {
  await mount(async (url) => String(url).endsWith('/auth/registro') ? failure(status, [...details]) : failure());
  await fill(); await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Revisa los datos.');
  if (label) { await waitFor(() => expect(screen.getByLabelText(label)).toHaveFocus()); expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true'); }
  else { expect(screen.getByRole('alert')).toHaveTextContent('conflicto no asociado'); expect(screen.getByRole('alert').parentElement).toHaveFocus(); }
  expect(screen.getByLabelText('Nombres')).toHaveValue('Ana'); expect(screen.getByLabelText('Contraseña')).toHaveValue('Clave1234');
});

it.each([['telefono', 'Teléfono (opcional)'], ['carnet', 'Carnet']] as const)('400 con errores de contraseña y %s enfoca el primer campo en el orden visual', async (field, label) => {
  await mount(async (url) => String(url).endsWith('/auth/registro')
    ? failure(400, ['contrasena: Revisa tu contraseña.', `${field}: Revisa este campo anterior.`]) : failure());
  await fill();
  await userEvent.type(screen.getByLabelText('Teléfono (opcional)'), '88881234', { delay: null });
  await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Revisa los datos.');
  expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText('Contraseña')).toHaveAttribute('aria-invalid', 'true');
  await waitFor(() => expect(screen.getByLabelText(label)).toHaveFocus());
  expect(screen.getByLabelText('Teléfono (opcional)')).toHaveValue('88881234');
  expect(screen.getByLabelText('Contraseña')).toHaveValue('Clave1234');
});

it.each([201, 409])('respuesta registro antigua %s no publica Toast, error ni navegación tras cambio de identidad', async (status) => {
  const pending = deferred<Response>(); let calls = 0;
  const runtime = await mount(async (url) => { if (String(url).endsWith('/auth/login')) return json(makeSesionResponse('ADMIN')); if (String(url).endsWith('/auth/registro')) { calls++; return pending.promise; } return failure(); });
  await fill(); await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' })); await waitFor(() => expect(calls).toBe(1));
  await act(async () => { await runtime.session.login({ correo: 'admin@empresa.com', contrasena: 'clave' }); pending.resolve(status === 201 ? json({ usuario: makeUsuario() }, 201) : failure(409, ['correo: Error antiguo'])); });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeEnabled());
  expect(screen.queryByText('Cuenta creada')).not.toBeInTheDocument(); expect(screen.queryByText('Login tras registro')).not.toBeInTheDocument(); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
