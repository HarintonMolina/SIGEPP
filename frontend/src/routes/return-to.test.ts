import { expect, it } from 'vitest';
import { getSafeReturnTo } from './return-to';

it.each([
  undefined, null, 42, {}, '', 'plazas', 'https://evil.example', '//evil.example',
  '/\\evil.example', '/%2f%2fevil.example', '/%252f%252fevil.example', '/%5cevil.example',
  '/plazas%2f..%2fadmin/auditoria', '/plazas/../admin/auditoria', '/plazas/..',
  'javascript:alert(1)', '/login', '/login?returnTo=/plazas', '/registro', '/inexistente',
  '/admin/auditoria', '/org/plazas/nueva', '/403', '/', '/plazas/:id', '/plazas/%3Aid',
  '/plazas/%', '/plazas//evil', '/plazas/%0aevil', '/plazas\nevil', '/PLAZAS', '/plazas#x',
])('rejects unsafe, unknown or unauthorized return %j', (target) => {
  expect(getSafeReturnTo(target, 'ESTUDIANTE')).toBe('/inicio');
});
it.each(['/plazas?area=software', '/plazas/abc-123', '/expediente/plan', '/asignaciones/42'])('accepts authorized %s', (target) => {
  expect(getSafeReturnTo(target, 'ESTUDIANTE')).toBe(target);
});
it('validates using the new role and has role-specific fallback', () => {
  expect(getSafeReturnTo('/expediente', 'ADMIN')).toBe('/inicio');
  expect(getSafeReturnTo('/asignaciones/42', 'ORGANIZACION')).toBe('/org/inicio');
  expect(getSafeReturnTo('/missing', 'COORDINADOR')).toBe('/panel');
  expect(getSafeReturnTo('/org/perfil', 'ORGANIZACION')).toBe('/org/perfil');
  expect(getSafeReturnTo('/revisiones', 'TUTOR_ACADEMICO')).toBe('/revisiones');
  expect(getSafeReturnTo('/revisiones', 'TUTOR_EMPRESARIAL')).toBe('/revisiones');
});
