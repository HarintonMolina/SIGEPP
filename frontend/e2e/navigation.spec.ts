import { test, expect } from '@playwright/test';
import { apiURL, cuentas, fillLogin, loginAs } from './fixtures';
import type { Rol } from '../src/features/auth/contracts';

const destinations: Record<Rol, string[]> = {
  ESTUDIANTE: ['/inicio', '/plazas', '/postulaciones', '/expediente', '/perfil'],
  TUTOR_ACADEMICO: ['/inicio', '/tutorados', '/revisiones', '/perfil'],
  TUTOR_EMPRESARIAL: ['/inicio', '/candidatos', '/practicantes', '/perfil'],
  ORGANIZACION: ['/org/inicio', '/org/plazas', '/org/tutores', '/perfil'],
  COORDINADOR: ['/panel', '/plazas', '/organizaciones', '/asignaciones', '/perfil'],
  ADMIN: ['/inicio', '/plazas', '/organizaciones', '/asignaciones', '/admin/auditoria', '/perfil'],
};
for (const rol of Object.keys(destinations) as Rol[]) {
  test(`todos los enlaces ${rol} tienen destino y perfil real`, async ({ page }) => {
    await loginAs(page, rol);
    const links = page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link');
    expect(await links.evaluateAll(elements => elements.map(e => e.getAttribute('href')))).toEqual(destinations[rol]);
    for (const path of destinations[rol]) {
      const response = path === '/perfil' ? page.waitForResponse(r => r.url() === `${apiURL}/auth/yo` && r.status() === 200) : null;
      await page.getByRole('navigation', { name: 'Navegación principal' }).locator(`[href="${path}"]`).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.locator('#titulo-pagina')).toBeFocused();
      if (!['/inicio', '/org/inicio', '/perfil'].includes(path)) {
        await expect(page.getByText('Esta sección aún no está disponible', { exact: true })).toBeVisible();
      }
      if (response) {
        const usuario = (await (await response).json()).usuario;
        expect(usuario.correo).toBe(cuentas[rol]);
        await expect(page.getByRole('main').getByText(usuario.correo, { exact: true })).toBeVisible();
      }
    }
  });
}
test('acceso directo anónimo conserva retorno permitido', async ({ page }) => {
  await page.goto('/perfil');
  await expect(page).toHaveURL(/\/login$/);
  await fillLogin(page, cuentas.ESTUDIANTE);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/perfil$/);
  await expect(page.getByRole('heading', { name: 'Datos personales' })).toBeVisible();
});

test('Más móvil: Escape devuelve foco y Perfil navega con identidad real', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await loginAs(page, 'ESTUDIANTE');
  const more = page.getByRole('button', { name: 'Más', exact: true });
  await more.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(more).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByRole('dialog').getByRole('link', { name: 'Perfil' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/perfil$/);
  await expect(page.locator('#titulo-pagina')).toBeFocused();
  await expect(page.getByRole('main').getByText(cuentas.ESTUDIANTE, { exact: true })).toBeVisible();
});
test('rol sin permiso recibe 403; URL desconocida recibe 404', async ({ page }) => {
  await loginAs(page, 'ESTUDIANTE');
  await page.goto('/admin/auditoria');
  await expect(page.getByRole('heading', { name: /403/ })).toBeVisible();
  await page.goto('/ruta-inexistente');
  await expect(page.getByRole('heading', { name: /404/ })).toBeVisible();
});
for (const returnTo of ['//example.com', '/%2f%2fexample.com', '/\\example.com', '/admin/auditoria']) {
  test(`retorno rechaza ${returnTo}`, async ({ page }) => {
    await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    await fillLogin(page, cuentas.ESTUDIANTE);
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    await expect(page).toHaveURL('http://localhost:5173/inicio');
  });
}
