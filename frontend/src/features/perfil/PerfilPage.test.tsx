import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import { Providers } from '../../app/Providers';
import { createRuntime } from '../../app/runtime';
import { makeSesionResponse, makeUsuario } from '../../test/fixtures';
import { deferred } from '../../test/deferred';
import PerfilPage from './PerfilPage';
const env = { apiUrl: 'http://localhost:4000/api/v1', institutionalDomains: ['uni.edu.ni'] };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
async function mount(fetchImpl: typeof fetch) {
  const runtime = createRuntime({ env, fetchImpl, storage: sessionStorage }); await runtime.session.login({ correo: 'ana@std.uni.edu.ni', contrasena: 'clave' }); await runtime.session.initialize();
  render(<Providers runtime={runtime}><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><PerfilPage /></MemoryRouter></Providers>); return runtime;
}
afterEach(() => sessionStorage.clear());
it('perfil null y nombres largos muestra datos reales sin inventar cifras ni h1 privado', async () => {
  const name = 'Nombre '.repeat(30); let calls = 0;
  await mount(async (url) => { if (String(url).endsWith('/auth/yo')) { calls++; return json({ usuario: makeUsuario('ESTUDIANTE', { nombres: name }) }); } return json(makeSesionResponse()); });
  expect(await screen.findByText(name.trim())).toBeInTheDocument();
  expect(screen.getAllByText('No disponible').length).toBeGreaterThan(3);
  expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument(); expect(screen.queryByText('0%')).not.toBeInTheDocument(); expect(calls).toBe(1);
});
it('renderiza datos públicos de todos los perfiles presentes y números sin conversión inventada', async () => {
  const usuario = makeUsuario('ADMIN', { estudiante: { id: 'e', carnet: '2026-1234A', carrera: 'Computación', anio: 4, porcentajeAvance: '73.50', avanceVerificado: false }, docente: { id: 'd', departamento: 'Sistemas', especialidad: null }, tutorEmpresarial: { id: 't', organizacionId: 'org-1', cargo: 'Supervisor' }, organizacion: { id: 'o', razonSocial: 'Empresa real', estadoVerificacion: 'PENDIENTE' } });
  await mount(async (url) => String(url).endsWith('/auth/yo') ? json({ usuario }) : json(makeSesionResponse('ADMIN')));
  for (const text of ['2026-1234A', 'Computación', '73.50%', 'Sistemas', 'Supervisor', 'org-1', 'Empresa real', 'PENDIENTE']) expect(await screen.findByText(text)).toBeInTheDocument();
});
it.each([false, true])('consulta fallida/malformada=%s requiere reintento manual', async (malformed) => {
  let calls = 0;
  await mount(async (url) => { if (!String(url).endsWith('/auth/yo')) return json(makeSesionResponse()); calls++; return calls > 1 ? json({ usuario: makeUsuario() }) : malformed ? json({ usuario: {} }) : json({ error: { codigo: 'ERROR', mensaje: 'Error de consulta.', detalles: [] } }, 500); });
  expect(await screen.findByRole('alert')).toHaveTextContent(malformed ? /respuesta.*válida/i : 'Error de consulta.'); expect(calls).toBe(1);
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' })); expect(await screen.findByText('ana@std.uni.edu.ni')).toBeInTheDocument(); expect(calls).toBe(2);
});
it('logout cancela consulta y respuesta antigua no presenta identidad anterior', async () => {
  const pending = deferred<Response>(); let signal: AbortSignal | null | undefined;
  const runtime = await mount(async (url, init) => { if (String(url).endsWith('/auth/yo')) { signal = init?.signal; return pending.promise; } if (String(url).endsWith('/auth/logout')) return new Response(null, { status: 204 }); return json(makeSesionResponse()); });
  await waitFor(() => expect(signal).toBeDefined()); await act(async () => { await runtime.session.logout(); pending.resolve(json({ usuario: makeUsuario('ESTUDIANTE', { nombres: 'Antigua' }) })); });
  expect(signal?.aborted).toBe(true); expect(screen.queryByText('Antigua')).not.toBeInTheDocument(); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
