import type { Rol } from '@prisma/client';
import type { RequestHandler } from 'express';
import { errores } from '../lib/errores.js';

/**
 * Matriz de control de acceso basado en roles (Fase 1, Tabla 4.2 y Tabla 5.6).
 * El rol solo es la primera barrera: cada servicio verifica además que el usuario
 * sea parte del recurso que consulta o modifica (protección contra IDOR).
 */
export const PERMISOS = {
  'organizaciones:verificar': ['COORDINADOR', 'ADMIN'],
  'organizaciones:gestionarTutores': ['ORGANIZACION', 'ADMIN'],
  'plazas:crear': ['ORGANIZACION', 'ADMIN'],
  'plazas:aprobar': ['COORDINADOR', 'ADMIN'],
  'postulaciones:crear': ['ESTUDIANTE'],
  'postulaciones:verPropias': ['ESTUDIANTE'],
  'postulaciones:preseleccionar': ['TUTOR_EMPRESARIAL'],
  'asignaciones:crear': ['COORDINADOR'],
  'asignaciones:ver': [
    'ESTUDIANTE',
    'TUTOR_ACADEMICO',
    'TUTOR_EMPRESARIAL',
    'COORDINADOR',
    'ADMIN',
  ],
  'planes:editar': ['ESTUDIANTE'],
  'planes:aprobar': ['TUTOR_ACADEMICO', 'TUTOR_EMPRESARIAL'],
  'bitacoras:registrar': ['ESTUDIANTE'],
  'bitacoras:revisar': ['TUTOR_ACADEMICO', 'TUTOR_EMPRESARIAL'],
  'evaluaciones:registrar': ['TUTOR_ACADEMICO', 'TUTOR_EMPRESARIAL'],
  'indicadores:ver': ['COORDINADOR', 'ADMIN'],
  'periodos:administrar': ['ADMIN'],
  'auditoria:ver': ['ADMIN'],
} as const satisfies Record<string, readonly Rol[]>;

export type Permiso = keyof typeof PERMISOS;

export const tienePermiso = (rol: Rol, permiso: Permiso): boolean =>
  (PERMISOS[permiso] as readonly Rol[]).includes(rol);

/** Permite el paso solo a los roles indicados. Debe ir después de requireAuth. */
export const requireRole =
  (...roles: Rol[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.usuario) return next(errores.noAutenticado());
    if (!roles.includes(req.usuario.rol)) return next(errores.prohibido());
    next();
  };

/** Igual que requireRole, pero usando un permiso de la matriz. */
export const requirePermiso = (permiso: Permiso): RequestHandler =>
  requireRole(...PERMISOS[permiso]);
