import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from './fixtures';
import { gotoWithEvidence } from './navigation-evidence';
import { writeFile } from 'node:fs/promises';

export async function noOverflow(page: Page) {
  const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(size.scroll).toBeLessThanOrEqual(size.client);
}
async function axe(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations.map(v => ({ id: v.id, impact: v.impact, targets: v.nodes.map(n => n.target) }))).toEqual([]);
}

for (const viewport of [{ width: 360, height: 800 }, { width: 768, height: 1024 }, { width: 1280, height: 800 }]) {
  test(`login, registro y shell sin desbordamiento/axe ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const route of ['/login', '/registro']) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await noOverflow(page); await axe(page);
    }
    await loginAs(page, 'ESTUDIANTE');
    await noOverflow(page); await axe(page);
  });
}
test('teclado opera validación y Select con retorno de foco', async ({ page }) => {
  await gotoWithEvidence(page, '/login', `.e2e/${process.env.E2E_RUN_ID}/keyboard-initial-goto.json`);
  await page.getByLabel('Correo', { exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Contraseña', { exact: true })).toBeFocused();
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(page.getByLabel('Correo', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Correo', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await page.goto('/registro');
  const select = page.getByRole('combobox', { name: 'Rol' });
  await select.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('option', { name: 'Estudiante', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  // Radix moves item focus asynchronously after End; activate the focused item.
  await expect(page.getByRole('option', { name: 'Tutor académico', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Departamento', { exact: true })).toBeVisible();
  await expect(select).toBeFocused();
  await axe(page);
});
test('teclado: Más, Escape, navegación, skip link y logout', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await loginAs(page, 'ESTUDIANTE');
  const more = page.getByRole('button', { name: 'Más', exact: true });
  await more.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(more).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByRole('dialog').getByRole('link', { name: 'Perfil' }).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#titulo-pagina')).toBeFocused();
  await page.getByRole('link', { name: 'Saltar al contenido' }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
});
test('componentes reales: resize, IDs únicos y axe en tres tamaños', async ({ page }) => {
  await page.goto('/e2e/components.html');
  for (const width of [1280, 360, 768, 360]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(page.locator('#fila-unica')).toHaveCount(1);
    await expect(page.getByRole(width < 640 ? 'list' : 'table', { name: 'Resultados' })).toBeVisible();
    await noOverflow(page); await axe(page);
  }
});
test('componentes reales: teclado, orden, páginas, modal, avisos y filas vacías', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/e2e/components.html');
  await page.getByRole('button', { name: /Nombre.*Ordenar/ }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'Ordenado por' })).toContainText('ascendente');
  await page.getByRole('button', { name: 'Siguiente' }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'Página' })).toHaveText('Página 2 de 3');
  const trigger = page.getByRole('button', { name: 'Abrir diálogo' });
  await trigger.focus(); await page.keyboard.press('Enter');
  await noOverflow(page); await axe(page);
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  await page.getByRole('button', { name: 'Mostrar aviso' }).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('[role="status"][aria-live="polite"]').filter({ hasText: 'Aviso de prueba' })).toBeAttached();
  await noOverflow(page); await axe(page);
  await page.getByRole('button', { name: 'Cerrar aviso' }).focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Alternar filas vacías' }).click();
  await expect(page.getByText('Sin resultados', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
});
test('movimiento reducido respeta preferencia real del navegador', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/e2e/components.html');
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  const duration = await page.getByRole('button', { name: 'Abrir diálogo' }).evaluate(el => getComputedStyle(el).transitionDuration);
  expect(duration).toBe('1e-05s');
  await page.screenshot({ path: '.e2e/reduced-motion.png', fullPage: true });
});

test('variantes visuales de Button y Badge', async ({ page }) => {
  await gotoWithEvidence(page, '/e2e/components.html', `.e2e/${process.env.E2E_RUN_ID}/styles-initial-goto.json`);
  const section = page.getByRole('region', { name: 'Variantes visuales' });
  const navy = 'rgb(31, 56, 100)', white = 'rgb(255, 255, 255)', red = 'rgb(192, 0, 0)';
  const buttons = [
    { variant: 'primario', background: navy, color: white },
    { variant: 'secundario', background: white, color: navy, border: navy },
    { variant: 'peligro', background: red, color: white },
    { variant: 'fantasma', background: 'rgba(0, 0, 0, 0)', color: navy },
  ];
  for (const variant of buttons) {
    const button = section.getByRole('button', { name: `Variante Button ${variant.variant}`, exact: true });
    await expect(button).toBeVisible(); await expect(button).toBeEnabled();
    await expect(button).toHaveCSS('background-color', variant.background);
    await expect(button).toHaveCSS('color', variant.color);
    if (variant.border) await expect(button).toHaveCSS('border-top-color', variant.border);
    await button.focus(); await expect(button).toBeFocused();
  }
  const badges = [
    { label: 'éxito', background: 'rgb(0, 176, 80)', color: 'rgb(32, 32, 32)' },
    { label: 'advertencia', background: 'rgb(237, 125, 49)', color: 'rgb(32, 32, 32)' },
    { label: 'error', background: red, color: white },
    { label: 'información', background: 'rgb(46, 84, 150)', color: white },
  ];
  for (const variant of badges) {
    const badge = section.getByText(`Variante Badge ${variant.label}`, { exact: true }).locator('..');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveCSS('background-color', variant.background);
    await expect(badge).toHaveCSS('color', variant.color);
  }
});

test('capas reales: primer Escape cierra Modal con Toast y devuelve foco una vez', async ({ page }) => {
  await page.goto('/e2e/components.html');
  await page.getByRole('button', { name: 'Abrir diálogo' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  const inside = page.getByRole('button', { name: 'Mostrar aviso dentro del diálogo' });
  await inside.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('li[data-state="open"]').filter({ hasText: 'Aviso superpuesto' })).toBeVisible();
  const observations = [];
  for (const step of ['antes de Escape', 'después del primer Escape']) {
    if (step !== 'antes de Escape') await page.keyboard.press('Escape');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    observations.push(await page.evaluate(step => ({ step,
      focus: { tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.trim().slice(0, 80) },
      dialogs: document.querySelectorAll('[role="dialog"]').length,
      toasts: document.querySelectorAll('li[data-state="open"]').length,
    }), step));
  }
  await writeFile('.e2e/layers-modal-fixed-result.json', JSON.stringify({ browser: page.context().browser()?.version(),
    order: 'abrir Modal → foco en botón interno → crear Toast → primer Escape', observations }, null, 2));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Abrir diálogo' })).toBeFocused();
  await expect(page.getByLabel('Solicitudes de cierre')).toHaveText('1');
});

test('capas reales: Escape descarta Select abierto antes de Toast asíncrono', async ({ page }) => {
  await page.goto('/e2e/components.html');
  await page.getByRole('button', { name: 'Abrir diálogo' }).click();
  await page.getByRole('button', { name: 'Programar aviso al abrir Select' }).click();
  await expect(page.getByRole('button', { name: 'Aviso programado para la lista' })).toBeVisible();
  const select = page.getByRole('combobox', { name: 'Selección de prueba' });
  await select.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('option', { name: 'Opción A', exact: true })).toBeFocused();
  await expect(page.locator('li[data-state="open"]').filter({ hasText: 'Aviso posterior al Select' })).toBeVisible();
  const observations = [];
  for (const step of ['antes de Escape', 'después del primer Escape', 'después del segundo Escape', 'después del tercer Escape']) {
    if (step !== 'antes de Escape') await page.keyboard.press('Escape');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    observations.push(await page.evaluate(step => ({ step,
      focus: { tag: document.activeElement?.tagName, role: document.activeElement?.getAttribute('role'), text: document.activeElement?.textContent?.trim().slice(0, 80) },
      dialogs: document.querySelectorAll('[role="dialog"]').length,
      listboxes: document.querySelectorAll('[role="listbox"]').length,
      toasts: document.querySelectorAll('li[data-state="open"]').length,
    }), step));
  }
  await writeFile('.e2e/layers-select-after-fixed-result.json', JSON.stringify({ browser: page.context().browser()?.version(),
    order: 'abrir Modal → programar aviso → abrir Select → observer detecta listbox → Toast asíncrono → Escape × 3', observations }, null, 2));
  expect(observations[1].listboxes).toBe(0);
  expect(observations[1].focus.role).toBe('combobox');
  expect(observations[1].focus.text).toBe('Opción A');
  expect(observations[1].dialogs).toBe(1);
});
