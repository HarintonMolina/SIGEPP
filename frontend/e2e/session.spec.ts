import { test, expect } from '@playwright/test';
import { collectAuthRequests, cuentas, loginAs, waitForAccessExpiry } from './fixtures';

test('StrictMode renueva una vez al recargar; cookie HttpOnly y almacenamiento vacío', async ({ page, context }) => {
  await loginAs(page, 'ESTUDIANTE');
  const cookie = (await context.cookies()).find(c => c.name === 'sigepp_rt');
  expect(cookie ? { httpOnly: cookie.httpOnly, path: cookie.path, sameSite: cookie.sameSite } : null)
    .toEqual({ httpOnly: true, path: '/api/v1/auth', sameSite: 'Strict' });
  expect(await page.evaluate(() => document.cookie.includes('sigepp_rt'))).toBe(false);
  const capture = collectAuthRequests(page);
  await page.reload();
  await expect(page.locator('#titulo-pagina')).toBeVisible();
  expect(capture.entries.filter(e => e.path.endsWith('/refresh') && e.method === 'POST')).toHaveLength(1);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
  capture.stop();
});
test('cuatro peticiones canónicas tras expiración real comparten un refresh', async ({ page }) => {
  const login = await loginAs(page, 'ESTUDIANTE');
  await waitForAccessExpiry(login);
  const capture = collectAuthRequests(page);
  const correct = await page.evaluate(async (correo) => {
    const modulePath = '/src/app/runtime.ts';
    const { runtime } = await import(/* @vite-ignore */ modulePath);
    const results = await Promise.all(Array.from({ length: 4 }, () => runtime.http.request('/auth/yo')));
    return results.map(result => result.usuario.correo === correo);
  }, cuentas.ESTUDIANTE);
  expect(correct).toEqual([true, true, true, true]);
  expect(capture.entries.filter(e => e.path.endsWith('/refresh') && e.method === 'POST')).toHaveLength(1);
  expect(capture.entries.filter(e => e.path.endsWith('/yo') && e.status === 200)).toHaveLength(4);
  capture.stop();
});
test('logout revoca cookie y recarga sin sesión', async ({ page, context }) => {
  await loginAs(page, 'ESTUDIANTE');
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  expect((await context.cookies()).filter(c => c.name === 'sigepp_rt')).toHaveLength(0);
});
test('logout offline borra identidad, conserva marcador y reintenta al pedirlo', async ({ page, context }) => {
  await loginAs(page, 'ESTUDIANTE');
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Cierre de sesión pendiente' })).toBeVisible();
  expect(await page.evaluate(() => ({ local: localStorage.length, session: Object.fromEntries(Object.entries(sessionStorage)) })))
    .toEqual({ local: 0, session: { 'sigepp.logoutPending': 'true' } });
  await context.setOffline(false);
  const capture = collectAuthRequests(page);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Reintentar cierre de sesión' })).toBeVisible();
  expect(capture.entries.filter(e => e.path.endsWith('/refresh'))).toHaveLength(0);
  expect(capture.entries.filter(e => e.path.endsWith('/logout'))).toHaveLength(0);
  await page.getByRole('button', { name: 'Reintentar cierre de sesión' }).click();
  await expect(page.getByRole('complementary', { name: 'Cierre de sesión pendiente' })).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  capture.stop();
});
