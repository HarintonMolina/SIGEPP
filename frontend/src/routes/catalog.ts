import { matchPath } from 'react-router-dom';
import { ROLES, type Rol } from '../features/auth/contracts';
import { isKnownRole } from './permissions';

export type RouteId =
  | 'login' | 'registro' | 'root' | 'inicio' | 'panel' | 'org-inicio'
  | 'perfil' | 'org-perfil' | 'plazas' | 'plaza-detalle' | 'postulaciones'
  | 'candidatos' | 'org-plazas' | 'org-plaza-nueva' | 'org-plaza-detalle'
  | 'org-tutores' | 'organizaciones' | 'expediente' | 'expediente-plan'
  | 'expediente-bitacoras' | 'tutorados' | 'practicantes' | 'revisiones'
  | 'asignaciones' | 'asignacion-detalle' | 'auditoria' | 'forbidden' | 'not-found';
export type PageKey = 'login' | 'registro' | 'inicio' | 'perfil' | 'modulo';
export type RouteDefinition = {
  id: RouteId; path: string; roles: readonly Rol[] | 'public'; page: PageKey;
  label: string; availability: 'activa' | 'S2' | 'S3'; menuRoles: readonly Rol[];
  homeRoles?: readonly Rol[]; redirectTo?: RouteId;
};
const all = ROLES;
const student: readonly Rol[] = ['ESTUDIANTE'];
const academic: readonly Rol[] = ['TUTOR_ACADEMICO'];
const enterprise: readonly Rol[] = ['TUTOR_EMPRESARIAL'];
const organization: readonly Rol[] = ['ORGANIZACION'];
const management: readonly Rol[] = ['COORDINADOR', 'ADMIN'];

// The order is also the menu priority. Details, aliases and errors are explicit
// entries with an empty menuRoles list; guards and links share this catalogue.
export const routeCatalog: readonly RouteDefinition[] = [
  { id: 'login', path: '/login', roles: 'public', page: 'login', label: 'Iniciar sesión', availability: 'activa', menuRoles: [] },
  { id: 'registro', path: '/registro', roles: 'public', page: 'registro', label: 'Registro', availability: 'activa', menuRoles: [] },
  { id: 'root', path: '/', roles: 'public', page: 'inicio', label: 'Inicio', availability: 'activa', menuRoles: [] },
  { id: 'inicio', path: '/inicio', roles: all, page: 'inicio', label: 'Inicio', availability: 'activa', menuRoles: ['ESTUDIANTE', 'TUTOR_ACADEMICO', 'TUTOR_EMPRESARIAL', 'ADMIN'], homeRoles: ['ESTUDIANTE', 'TUTOR_ACADEMICO', 'TUTOR_EMPRESARIAL', 'ADMIN'] },
  { id: 'panel', path: '/panel', roles: management, page: 'modulo', label: 'Panel', availability: 'S2', menuRoles: ['COORDINADOR'], homeRoles: ['COORDINADOR'] },
  { id: 'org-inicio', path: '/org/inicio', roles: organization, page: 'inicio', label: 'Inicio', availability: 'activa', menuRoles: organization, homeRoles: organization },
  { id: 'org-perfil', path: '/org/perfil', roles: organization, page: 'perfil', label: 'Perfil', availability: 'activa', menuRoles: [], redirectTo: 'perfil' },
  { id: 'plazas', path: '/plazas', roles: all, page: 'modulo', label: 'Plazas', availability: 'S2', menuRoles: ['ESTUDIANTE', 'COORDINADOR', 'ADMIN'] },
  { id: 'plaza-detalle', path: '/plazas/:id', roles: all, page: 'modulo', label: 'Detalle de plaza', availability: 'S2', menuRoles: [] },
  { id: 'postulaciones', path: '/postulaciones', roles: student, page: 'modulo', label: 'Postulaciones', availability: 'S2', menuRoles: student },
  { id: 'candidatos', path: '/candidatos', roles: enterprise, page: 'modulo', label: 'Candidatos', availability: 'S2', menuRoles: enterprise },
  { id: 'org-plazas', path: '/org/plazas', roles: organization, page: 'modulo', label: 'Mis plazas', availability: 'S2', menuRoles: organization },
  { id: 'org-plaza-nueva', path: '/org/plazas/nueva', roles: organization, page: 'modulo', label: 'Nueva plaza', availability: 'S2', menuRoles: [] },
  { id: 'org-plaza-detalle', path: '/org/plazas/:id', roles: organization, page: 'modulo', label: 'Detalle de mi plaza', availability: 'S2', menuRoles: [] },
  { id: 'org-tutores', path: '/org/tutores', roles: organization, page: 'modulo', label: 'Tutores', availability: 'S2', menuRoles: organization },
  { id: 'organizaciones', path: '/organizaciones', roles: management, page: 'modulo', label: 'Organizaciones', availability: 'S2', menuRoles: management },
  { id: 'expediente', path: '/expediente', roles: student, page: 'modulo', label: 'Expediente', availability: 'S3', menuRoles: student },
  { id: 'expediente-plan', path: '/expediente/plan', roles: student, page: 'modulo', label: 'Plan de trabajo', availability: 'S3', menuRoles: [] },
  { id: 'expediente-bitacoras', path: '/expediente/bitacoras', roles: student, page: 'modulo', label: 'Bitácoras', availability: 'S3', menuRoles: [] },
  { id: 'tutorados', path: '/tutorados', roles: academic, page: 'modulo', label: 'Tutorados', availability: 'S3', menuRoles: academic },
  { id: 'practicantes', path: '/practicantes', roles: enterprise, page: 'modulo', label: 'Practicantes', availability: 'S3', menuRoles: enterprise },
  { id: 'revisiones', path: '/revisiones', roles: ['TUTOR_ACADEMICO', 'TUTOR_EMPRESARIAL'], page: 'modulo', label: 'Revisiones', availability: 'S3', menuRoles: academic },
  { id: 'asignaciones', path: '/asignaciones', roles: management, page: 'modulo', label: 'Asignaciones', availability: 'S3', menuRoles: management },
  { id: 'asignacion-detalle', path: '/asignaciones/:id', roles: ['ESTUDIANTE', 'TUTOR_ACADEMICO', 'TUTOR_EMPRESARIAL', 'COORDINADOR', 'ADMIN'], page: 'modulo', label: 'Detalle de asignación', availability: 'S3', menuRoles: [] },
  // S3 is a technical grouping, not a promise of an availability date.
  { id: 'auditoria', path: '/admin/auditoria', roles: ['ADMIN'], page: 'modulo', label: 'Auditoría', availability: 'S3', menuRoles: ['ADMIN'] },
  { id: 'perfil', path: '/perfil', roles: all, page: 'perfil', label: 'Perfil', availability: 'activa', menuRoles: all },
  { id: 'forbidden', path: '/403', roles: 'public', page: 'modulo', label: 'Acceso denegado', availability: 'activa', menuRoles: [] },
  { id: 'not-found', path: '*', roles: 'public', page: 'modulo', label: 'Página no encontrada', availability: 'activa', menuRoles: [] },
];

export function canAccess(routeId: RouteId, rol: Rol): boolean {
  const route = routeCatalog.find((entry) => entry.id === routeId);
  return isKnownRole(rol) && !!route && (route.roles === 'public' || route.roles.includes(rol));
}
export function getHomePath(rol: Rol): string {
  return routeCatalog.find((route) => route.homeRoles?.includes(rol))?.path ?? '/403';
}
export function getNavigation(rol: Rol): readonly RouteDefinition[] {
  return routeCatalog.filter((route) => route.menuRoles.includes(rol) && canAccess(route.id, rol));
}
export function findRoute(pathname: string): RouteDefinition | undefined {
  return routeCatalog.find((route) => route.path !== '*' && matchPath({ path: route.path, end: true, caseSensitive: true }, pathname));
}
