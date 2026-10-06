import { describe, expect, it } from 'vitest';
import { ROLES, type Rol } from '../features/auth/contracts';
import { canAccess, getHomePath, getNavigation, routeCatalog } from './catalog';
import { hasPermission } from './permissions';

// Literal expectations from the approved SPA table, independent of product metadata.
const destinations: [string, string][] = [
  ['/login', '111111'], ['/registro', '111111'], ['/', '111111'],
  ['/inicio', '111111'], ['/panel', '000011'], ['/org/inicio', '000100'],
  ['/perfil', '111111'], ['/org/perfil', '000100'], ['/plazas', '111111'],
  ['/plazas/:id', '111111'], ['/postulaciones', '100000'], ['/candidatos', '001000'],
  ['/org/plazas', '000100'], ['/org/plazas/nueva', '000100'],
  ['/org/plazas/:id', '000100'], ['/org/tutores', '000100'],
  ['/organizaciones', '000011'], ['/expediente', '100000'],
  ['/expediente/plan', '100000'], ['/expediente/bitacoras', '100000'],
  ['/tutorados', '010000'], ['/practicantes', '001000'], ['/revisiones', '011000'],
  ['/asignaciones', '000011'], ['/asignaciones/:id', '111011'],
  ['/admin/auditoria', '000001'], ['/403', '111111'], ['*', '111111'],
];
const menus: Record<Rol, string[]> = {
  ESTUDIANTE: ['/inicio', '/plazas', '/postulaciones', '/expediente', '/perfil'],
  TUTOR_ACADEMICO: ['/inicio', '/tutorados', '/revisiones', '/perfil'],
  TUTOR_EMPRESARIAL: ['/inicio', '/candidatos', '/practicantes', '/perfil'],
  ORGANIZACION: ['/org/inicio', '/org/plazas', '/org/tutores', '/perfil'],
  COORDINADOR: ['/panel', '/plazas', '/organizaciones', '/asignaciones', '/perfil'],
  ADMIN: ['/inicio', '/plazas', '/organizaciones', '/asignaciones', '/admin/auditoria', '/perfil'],
};

describe('SPA access matrix', () => {
  it.each(destinations)('%s permits exactly its presentation roles', (path, mask) => {
    const route = routeCatalog.find((entry) => entry.path === path);
    expect(route, `Missing ${path}`).toBeDefined();
    for (const [index, rol] of ROLES.entries()) {
      expect(canAccess(route!.id, rol), `${rol} ${path}`).toBe(mask[index] === '1');
    }
  });
  it('has no missing or invented destinations', () => {
    expect(routeCatalog.map((route) => route.path).sort()).toEqual(destinations.map(([path]) => path).sort());
    expect(new Set(routeCatalog.map((route) => route.id)).size).toBe(destinations.length);
  });
  it.each(ROLES)('%s receives only its approved concrete menu', (rol) => {
    expect(getNavigation(rol).map((route) => route.path)).toEqual(menus[rol]);
    expect(getNavigation(rol).every((route) => !/[#:*]/.test(route.path))).toBe(true);
  });
  it.each([
    ['ESTUDIANTE', '/inicio'], ['TUTOR_ACADEMICO', '/inicio'], ['TUTOR_EMPRESARIAL', '/inicio'],
    ['ORGANIZACION', '/org/inicio'], ['COORDINADOR', '/panel'], ['ADMIN', '/inicio'],
  ] as const)('resolves %s home', (rol, home) => expect(getHomePath(rol)).toBe(home));
  it('fails closed for an unknown role even on an all-role destination', () => {
    const invalid = 'SUPERADMIN' as Rol;
    expect(canAccess('inicio', invalid)).toBe(false);
    expect(getNavigation(invalid)).toEqual([]);
    expect(getHomePath(invalid)).toBe('/403');
  });
  it('keeps operation privileges distinct from presentation access', () => {
    expect(hasPermission('ADMIN', 'asignaciones:crear')).toBe(false);
    expect(hasPermission('COORDINADOR', 'asignaciones:crear')).toBe(true);
    expect(hasPermission('COORDINADOR', 'plazas:crear')).toBe(false);
    expect(hasPermission('ADMIN', 'organizaciones:gestionarTutores')).toBe(true);
    expect(canAccess('org-tutores', 'ADMIN')).toBe(false);
    expect(hasPermission('ESTUDIANTE', 'planes:aprobar')).toBe(false);
  });
});
