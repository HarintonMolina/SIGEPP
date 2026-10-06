import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { RouterProvider } from 'react-router-dom';
import { createRuntime } from '../app/runtime';
import { Providers } from '../app/Providers';
import { makeSesionResponse } from '../test/fixtures';
import { createAppRouter, type PageRegistry } from '../routes/router';
import type { Rol } from '../features/auth/contracts';
import { deferred } from '../test/deferred';

const menus: [Rol, string, string[]][] = [
  ['ESTUDIANTE', '/inicio', ['/inicio', '/plazas', '/postulaciones', '/expediente', '/perfil']],
  ['TUTOR_ACADEMICO', '/inicio', ['/inicio', '/tutorados', '/revisiones', '/perfil']],
  ['TUTOR_EMPRESARIAL', '/inicio', ['/inicio', '/candidatos', '/practicantes', '/perfil']],
  ['ORGANIZACION', '/org/inicio', ['/org/inicio', '/org/plazas', '/org/tutores', '/perfil']],
  ['COORDINADOR', '/panel', ['/panel', '/plazas', '/organizaciones', '/asignaciones', '/perfil']],
  ['ADMIN', '/inicio', ['/inicio', '/plazas', '/organizaciones', '/asignaciones', '/admin/auditoria', '/perfil']],
];
const pages: PageRegistry = {
  login: async () => ({ default: () => <h1>Login de prueba</h1> }),
  registro: async () => ({ default: () => <h1>Registro de prueba</h1> }),
  inicio: async () => ({ default: () => <p>Bienvenida real</p> }),
  perfil: async () => ({ default: () => <p>Perfil real</p> }),
  modulo: async () => ({ default: () => <p>Esta sección aún no está disponible</p> }),
};
const routers: ReturnType<typeof createAppRouter>[] = [];
afterEach(() => { routers.forEach((router) => router.dispose()); routers.length = 0; sessionStorage.clear(); });
function setup(rol: Rol, path: string, logoutResponse = async () => new Response(null, { status: 204 })) {
  window.history.replaceState(null, '', path);
  const requests: string[] = [];
  const runtime = createRuntime({
    env: { apiUrl: 'http://localhost:4000/api/v1', institutionalDomains: ['uni.edu.ni'] }, storage: sessionStorage,
    fetchImpl: async (url) => {
      requests.push(String(url));
      return String(url).endsWith('/auth/logout') ? logoutResponse() : new Response(JSON.stringify(makeSesionResponse(rol)));
    },
  });
  const router = createAppRouter(pages); routers.push(router);
  render(<Providers runtime={runtime}><RouterProvider router={router} future={{ v7_startTransition: true }} /></Providers>);
  return { runtime, router, requests };
}
it.each(menus)('%s renders approved desktop and mobile destinations', async (rol, path, expected) => {
  setup(rol, path);
  const desktop = await screen.findByRole('navigation', { name: 'Navegación principal' });
  expect(within(desktop).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(expected);
  const mobile = screen.getByRole('navigation', { name: 'Navegación móvil' });
  expect(within(mobile).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(expected.slice(0, 3));
  expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
  await userEvent.click(within(mobile).getByRole('button', { name: 'Más' }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(expected.slice(3));
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(within(mobile).getByRole('button', { name: 'Más' })).toHaveFocus();
});
it('closes Más on navigation and focuses the new heading with a usable skip link', async () => {
  const { router } = setup('ESTUDIANTE', '/inicio');
  await screen.findByRole('navigation', { name: 'Navegación principal' });
  expect(screen.getByRole('link', { name: 'Saltar al contenido' })).toHaveAttribute('href', '#contenido-principal');
  await userEvent.click(screen.getByRole('button', { name: 'Más' }));
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'Perfil' }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/perfil'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(await screen.findByRole('heading', { name: 'Perfil', level: 1 })).toHaveFocus();
});
it('canonical logout clears identity/cache immediately and preserves remote failure for public UI', async () => {
  const pending = deferred<Response>();
  const { runtime, requests } = setup('ESTUDIANTE', '/inicio', () => pending.promise);
  await screen.findByRole('navigation', { name: 'Navegación principal' });
  runtime.queryClient.setQueryData(['private'], { secret: true });
  await userEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }));
  expect(await screen.findByRole('heading', { name: 'Login de prueba' })).toBeInTheDocument();
  expect(runtime.session.getAccess()).toBeNull();
  expect(runtime.queryClient.getQueryData(['private'])).toBeUndefined();
  await act(async () => { pending.resolve(new Response(JSON.stringify({ error: { codigo: 'ERROR', mensaje: 'Cierre remoto pendiente', detalles: [] } }), { status: 503 })); });
  await waitFor(() => expect(runtime.session.getSnapshot().error?.message).toBe('Cierre remoto pendiente'));
  expect(runtime.session.getSnapshot().logoutPending).toBe(true);
  expect(requests.filter((url) => url.endsWith('/auth/logout'))).toHaveLength(1);
});
