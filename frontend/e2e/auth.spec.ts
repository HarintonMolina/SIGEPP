import { test, expect } from '@playwright/test';
import { apiURL, collectAuthRequests, cuentas, fillLogin, fillRegistration, loginAs, newAccount } from './fixtures';
import type { Rol } from '../src/features/auth/contracts';

for (const rol of ['ESTUDIANTE', 'TUTOR_ACADEMICO'] as const) {
  test(`registro UI ${rol}: 201 sin sesión y login posterior`, async ({ page }) => {
    const account = newAccount(rol);
    await fillRegistration(page, account);
    const capture = collectAuthRequests(page);
    const response = page.waitForResponse(r => r.url() === `${apiURL}/auth/registro` && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
    const result = await response;
    expect(result.status()).toBe(201);
    const body = await result.json();
    expect(Object.keys(body)).toEqual(['usuario']);
    expect(body.usuario.rol).toBe(rol);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel('Correo', { exact: true })).toHaveValue(account.correo);
    expect(capture.entries.filter(e => e.path.endsWith('/login'))).toHaveLength(0);
    expect((await page.context().cookies()).filter(c => c.name === 'sigepp_rt')).toHaveLength(0);
    await fillLogin(page, account.correo);
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    await expect(page.locator('#titulo-pagina')).toHaveText('Inicio');
    capture.stop();
  });
}
for (const campo of ['correo', 'carnet'] as const) {
  test(`registro UI detecta duplicado de ${campo}`, async ({ page, request }) => {
    const original = newAccount();
    expect((await request.post(`${apiURL}/auth/registro`, { data: original })).status()).toBe(201);
    const account = { ...newAccount(), [campo]: original[campo] };
    await fillRegistration(page, account);
    const response = page.waitForResponse(r => r.url().endsWith('/auth/registro') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
    expect((await response).status()).toBe(409);
    // These real 409 responses carry a general error, not field-prefixed detalles.
    await expect(page.getByRole('alert')).toContainText(campo);
    await expect(page.getByRole('alert').locator('..')).toBeFocused();
  });
}
for (const rol of Object.keys(cuentas) as Rol[]) {
  test(`login UI acepta ${rol}`, async ({ page }) => { await loginAs(page, rol); });
}
test('cuenta dedicada: cinco 401 y sexto intento 429', async ({ page, request }) => {
  const account = newAccount();
  expect((await request.post(`${apiURL}/auth/registro`, { data: account })).status()).toBe(201);
  await page.goto('/login');
  await fillLogin(page, account.correo, 'Incorrecta2026');
  for (let index = 0; index < 6; index += 1) {
    const response = page.waitForResponse(r => r.url().endsWith('/auth/login') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    expect((await response).status()).toBe(index < 5 ? 401 : 429);
    await expect(page.getByRole('alert')).toBeVisible();
  }
  await expect(page.getByRole('alert')).toContainText('bloqueada');
});
test('contrato del servidor: rechaza entradas que bloquea el formulario', async ({ request }) => {
  for (const data of [{ ...newAccount(), correo: 'invalido', contrasena: '123' }, { ...newAccount(), rol: 'ADMIN' }]) {
    const response = await request.post(`${apiURL}/auth/registro`, { data });
    expect(response.status()).toBe(400);
    expect((await response.json()).error.codigo).toBe('VALIDACION');
  }
});
