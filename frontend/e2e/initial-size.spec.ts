import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
test('login interactivo registra únicamente JS inicial solicitado', async ({ page }) => {
  const paths = new Set<string>();
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin === 'http://localhost:5173' && url.pathname.endsWith('.js')) paths.add(url.pathname);
  });
  await page.goto('/login');
  const submit = page.getByRole('button', { name: 'Iniciar sesión', exact: true });
  await expect(submit).toHaveCSS('background-color', 'rgb(31, 56, 100)');
  await expect(submit).toHaveCSS('color', 'rgb(255, 255, 255)');
  await page.getByLabel('Correo', { exact: true }).fill('medicion@uni.edu.ni');
  await submit.click();
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await page.waitForLoadState('networkidle');
  expect(paths.size).toBeGreaterThan(0);
  await mkdir('.e2e', { recursive: true });
  await writeFile('.e2e/initial-assets.json', JSON.stringify({ paths: [...paths].sort() }, null, 2));
});
