import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { loginAs } from './fixtures';
import { gotoWithEvidence } from './navigation-evidence';

// One owned browser per case keeps each existing 45s deadline focused. Proof is
// written before/after operations so a timeout cannot discard the last stage.
async function nativeZoom(name: string, factor: number, scenario: (page: Page, stage: (label: string) => Promise<void>, measure: (label: string) => Promise<void>, capture: (file: string) => Promise<void>) => Promise<void>) {
  const root = path.resolve('.e2e');
  const runId = process.env.E2E_RUN_ID!;
  const evidenceDir = path.join(root, runId, `zoom-${name}`);
  await mkdir(evidenceDir, { recursive: true });
  const profile = await mkdtemp(path.join(root, 'zoom-owned-'));
  if (!profile.startsWith(root + path.sep + 'zoom-owned-')) throw new Error('Perfil fuera de directorio propio');
  const proof: { runId: string; name: string; factor: number; configuredViewport: { width: number; height: number }; browser?: string; status: string; stages: { label: string; elapsedMs: number }[]; measurements: unknown[]; errorName?: string } = {
    runId, name, factor, configuredViewport: { width: 1280, height: 800 }, status: 'running', stages: [], measurements: [],
  };
  const started = Date.now();
  const save = () => writeFile(path.join(evidenceDir, 'proof.json'), JSON.stringify(proof, null, 2));
  const stage = async (label: string) => {
    proof.stages.push({ label, elapsedMs: Date.now() - started });
    await save();
    console.log(`[zoom ${name}] ${label}`);
  };
  let context: BrowserContext | undefined;
  try {
    await stage('profile-created');
    await mkdir(path.join(profile, 'Default'), { recursive: true });
    await writeFile(path.join(profile, 'Default', 'Preferences'), JSON.stringify({ partition: { default_zoom_level: { x: Math.log(factor) / Math.log(1.2) } } }));
    await stage('browser-launch-start');
    context = await chromium.launchPersistentContext(profile, { channel: 'chrome', headless: true, baseURL: 'http://localhost:5173', viewport: { width: 1280, height: 800 } });
    proof.browser = context.browser()!.version();
    await stage('browser-launched');
    const page = await context.newPage();
    const measure = async (label: string) => {
      const metrics = await page.evaluate(() => {
        const rect = (selector: string) => {
          const value = document.querySelector(selector)?.getBoundingClientRect();
          return value ? { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right, bottom: value.bottom } : null;
        };
        return { route: location.pathname, innerWidth, innerHeight, dpr: devicePixelRatio,
          scale: visualViewport?.scale, cssZoom: getComputedStyle(document.documentElement).zoom,
          clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
          bodyClientWidth: document.body.clientWidth, bodyScrollWidth: document.body.scrollWidth,
          containers: { main: rect('main'), form: rect('form'), heading: rect('h1') } };
      });
      proof.measurements.push({ label, elapsedMs: Date.now() - started, ...metrics });
      await save();
      expect(metrics).toMatchObject({ innerWidth: 1280 / factor, innerHeight: 800 / factor, dpr: factor, scale: 1, cssZoom: '1' });
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
    };
    const capture = async (file: string) => {
      await stage(`capture-${file}-start`);
      await measure(`before-capture-${file}`);
      const cdp = await context!.newCDPSession(page);
      try {
        const layout = await cdp.send('Page.getLayoutMetrics');
        const { x, y, width, height } = layout.contentSize;
        proof.measurements.push({ label: `capture-layout-${file}`, contentSize: layout.contentSize, cssContentSize: layout.cssContentSize });
        await save();
        // Calibrated Chrome 154 path: capture clip is DIP, not DOM CSS pixels.
        // scale:1 affects output clipping only; native page zoom stays unchanged.
        const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: true, clip: { x, y, width, height, scale: 1 } });
        await writeFile(path.join(root, file), Buffer.from(data, 'base64'));
      } finally { await cdp.detach(); }
      await measure(`after-capture-${file}`);
      await stage(`capture-${file}-completed`);
    };
    await scenario(page, stage, measure, capture);
    proof.status = 'scenario-passed';
    await stage('scenario-completed');
  } catch (error) {
    proof.status = 'failed';
    // Do not persist exception messages, response bodies, cookies or credentials.
    proof.errorName = error instanceof Error ? error.name : 'UnknownError';
    await save();
    throw error;
  } finally {
    try {
      if (context) { await stage('browser-close-start'); await context.close(); await stage('browser-closed'); }
    } finally {
      await stage('profile-remove-start');
      await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      await stage('profile-removed');
    }
    if (proof.status === 'scenario-passed') { proof.status = 'passed'; await save(); }
  }
}

test('Chrome separado: control nativo 100% registra métricas', async () => {
  await nativeZoom('control100', 1, async (page, stage, measure) => {
    await stage('login-navigation-start'); await gotoWithEvidence(page, '/login', `.e2e/${process.env.E2E_RUN_ID}/zoom-control100/initial-goto.json`);
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    await measure('login-control100');
  });
});

test('Chrome separado: formularios con zoom nativo 200% y captura DIP', async () => {
  await nativeZoom('forms200', 2, async (page, stage, measure, capture) => {
    await stage('login-navigation-start'); await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toHaveCSS('background-color', 'rgb(31, 56, 100)');
    await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toHaveCSS('color', 'rgb(255, 255, 255)');
    await measure('login200'); await capture('zoom200-login-fixed.png');
    await page.getByLabel('Correo', { exact: true }).focus(); await page.keyboard.press('Tab');
    await expect(page.getByLabel('Contraseña', { exact: true })).toBeFocused();
    await stage('registration-navigation-start'); await page.goto('/registro');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crear cuenta', exact: true })).toHaveCSS('background-color', 'rgb(31, 56, 100)');
    await expect(page.getByRole('button', { name: 'Crear cuenta', exact: true })).toHaveCSS('color', 'rgb(255, 255, 255)');
    await measure('registro200'); await capture('zoom200-registro-fixed.png');
    const select = page.getByRole('combobox', { name: 'Rol' });
    await select.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('option', { name: 'Estudiante', exact: true })).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.getByRole('option', { name: 'Tutor académico', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Departamento', { exact: true })).toBeVisible();
    await expect(select).toBeFocused(); await measure('registro200-tutor');
  });
});

test('Chrome separado: shell y cierre de sesión con zoom nativo 200%', async () => {
  await nativeZoom('shell200', 2, async (page, stage, measure, capture) => {
    await stage('login-real-start'); await loginAs(page, 'ESTUDIANTE');
    await measure('shell200');
    const more = page.getByRole('button', { name: 'Más', exact: true });
    await more.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible(); await measure('shell200-modal');
    await page.keyboard.press('Escape'); await expect(more).toBeFocused();
    await capture('zoom200-shell-fixed.png');
    await stage('logout-start');
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    await measure('logout200'); await stage('logout-completed');
  });
});
