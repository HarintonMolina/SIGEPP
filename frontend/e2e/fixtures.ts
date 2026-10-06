import { expect, type Page, type Response } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Rol } from '../src/features/auth/contracts';

export const apiURL = 'http://localhost:4000/api/v1';
export const cuentas: Record<Rol, string> = {
  ADMIN: 'admin@uni.edu.ni', COORDINADOR: 'coordinacion.sistemas@uni.edu.ni',
  TUTOR_ACADEMICO: 'jose.martinez@uni.edu.ni', ORGANIZACION: 'rrhh@solucionesdigitales.example',
  TUTOR_EMPRESARIAL: 'pedro.lopez@solucionesdigitales.example', ESTUDIANTE: 'maria.gonzalez@std.uni.edu.ni',
};
// Public seed credential documented in README; never write response bodies, storageState or traces.
export const seedPassword = 'Sigepp2026';
const run = process.env.E2E_RUN_ID;
if (!run || !/^[a-f0-9]{12}$/.test(run)) throw new Error('Use el orquestador para obtener un ID aislado');
const seed = readFileSync(new URL('../../backend/prisma/seed.ts', import.meta.url), 'utf8');
const counterPath = new URL(`../.e2e/${run}/account-counter.txt`, import.meta.url);
export function newAccount(rol: 'ESTUDIANTE' | 'TUTOR_ACADEMICO' = 'ESTUDIANTE') {
  const sequence = (existsSync(counterPath) ? Number(readFileSync(counterPath, 'utf8')) : 0) + 1;
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 9999) throw new Error('Contador de carnet inválido/agotado');
  writeFileSync(counterPath, String(sequence));
  const carnet = `9999-${String(sequence).padStart(4, '0')}U`;
  if (seed.includes(carnet)) throw new Error('Colisión con seed');
  return { rol, nombres: 'Persona E2E', apellidos: 'Verificación', correo: `e2e.${run}.${sequence}@uni.edu.ni`,
    contrasena: seedPassword, carnet, carrera: 'Ingeniería en Sistemas', anio: 3, departamento: 'Sistemas' };
}
export async function fillLogin(page: Page, correo: string, contrasena = seedPassword) {
  await page.getByLabel('Correo', { exact: true }).fill(correo);
  await page.getByLabel('Contraseña', { exact: true }).fill(contrasena);
}
export async function loginAs(page: Page, rol: Rol): Promise<Response> {
  await page.goto('/login');
  await fillLogin(page, cuentas[rol]);
  const response = page.waitForResponse(r => r.url() === `${apiURL}/auth/login` && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  const result = await response;
  expect(result.status()).toBe(200);
  await expect(page.locator('#titulo-pagina')).toBeVisible();
  return result;
}
export async function waitForAccessExpiry(loginResponse: Response): Promise<void> {
  const body = await loginResponse.json() as { accessToken: string };
  const payload = JSON.parse(Buffer.from(body.accessToken.split('.')[1], 'base64url').toString()) as { exp: number };
  const delay = payload.exp * 1000 - Date.now() + 1100;
  if (!Number.isFinite(delay) || delay > 10000) throw new Error('TTL E2E inválido');
  await new Promise(resolve => setTimeout(resolve, Math.max(0, delay)));
}
export function collectAuthRequests(page: Page): { entries: { method: string; path: string; status: number }[]; stop(): void } {
  const entries: { method: string; path: string; status: number }[] = [];
  const record = (response: Response) => {
    const url = new URL(response.url());
    if (url.origin === 'http://localhost:4000' && url.pathname.startsWith('/api/v1/auth/')) {
      entries.push({ method: response.request().method(), path: url.pathname, status: response.status() });
    }
  };
  page.on('response', record);
  return { entries, stop: () => page.off('response', record) };
}
export async function fillRegistration(page: Page, account: ReturnType<typeof newAccount>) {
  await page.goto('/registro');
  if (account.rol === 'TUTOR_ACADEMICO') {
    await page.getByRole('combobox', { name: 'Rol' }).click();
    await page.getByRole('option', { name: 'Tutor académico' }).click();
  }
  for (const [label, value] of [['Nombres', account.nombres], ['Apellidos', account.apellidos], ['Correo', account.correo]]) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  if (account.rol === 'ESTUDIANTE') {
    await page.getByLabel('Carnet', { exact: true }).fill(account.carnet);
    await page.getByLabel('Carrera', { exact: true }).fill(account.carrera);
  } else await page.getByLabel('Departamento', { exact: true }).fill(account.departamento);
  await page.getByLabel('Contraseña', { exact: true }).fill(account.contrasena);
  await page.getByLabel('Confirmar contraseña', { exact: true }).fill(account.contrasena);
}
