import { ROLES, type Rol } from '../features/auth/contracts';

// Operation permissions mirror backend/middleware/rbac.ts. Presentation routes
// deliberately have their own metadata: API access does not imply a menu entry.
export const PERMISSIONS = {
  'organizaciones:verificar': ['COORDINADOR', 'ADMIN'],
  'organizaciones:gestionarTutores': ['ORGANIZACION', 'ADMIN'],
  'plazas:crear': ['ORGANIZACION', 'ADMIN'],
  'plazas:aprobar': ['COORDINADOR', 'ADMIN'],
  'postulaciones:crear': ['ESTUDIANTE'],
  'postulaciones:verPropias': ['ESTUDIANTE'],
  'postulaciones:preseleccionar': ['TUTOR_EMPRESARIAL'],
  'asignaciones:crear': ['COORDINADOR'],
  'asignaciones:ver': ['ESTUDIANTE', 'TUTOR_ACADEMICO', 'TUTOR_EMPRESARIAL', 'COORDINADOR', 'ADMIN'],
  'planes:editar': ['ESTUDIANTE'],
  'planes:aprobar': ['TUTOR_ACADEMICO', 'TUTOR_EMPRESARIAL'],
  'bitacoras:registrar': ['ESTUDIANTE'],
  'bitacoras:revisar': ['TUTOR_ACADEMICO', 'TUTOR_EMPRESARIAL'],
  'evaluaciones:registrar': ['TUTOR_ACADEMICO', 'TUTOR_EMPRESARIAL'],
  'indicadores:ver': ['COORDINADOR', 'ADMIN'],
  'periodos:administrar': ['ADMIN'],
  'auditoria:ver': ['ADMIN'],
} as const satisfies Record<string, readonly Rol[]>;
export type Permission = keyof typeof PERMISSIONS;
export function isKnownRole(value: unknown): value is Rol {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
export function hasPermission(rol: Rol, permission: Permission): boolean {
  return isKnownRole(rol) && (PERMISSIONS[permission] as readonly Rol[]).includes(rol);
}
