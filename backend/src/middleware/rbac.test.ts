import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../lib/errores.js';
import { requirePermiso, requireRole, tienePermiso } from './rbac.js';

const ejecutar = (middleware: ReturnType<typeof requireRole>, usuario?: Request['usuario']) => {
  const next = vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
  middleware({ usuario } as Request, {} as Response, next);
  return next.mock.calls[0]?.[0] as AppError | undefined;
};

describe('Middleware RBAC (RF-04)', () => {
  it('deja pasar a un rol autorizado', () => {
    const error = ejecutar(requireRole('COORDINADOR', 'ADMIN'), { id: 'u1', rol: 'COORDINADOR' });
    expect(error).toBeUndefined();
  });

  it('responde 403 a un rol no autorizado', () => {
    const error = ejecutar(requireRole('COORDINADOR'), { id: 'u1', rol: 'ESTUDIANTE' });
    expect(error).toBeInstanceOf(AppError);
    expect(error?.status).toBe(403);
  });

  it('responde 401 si no hay usuario autenticado', () => {
    const error = ejecutar(requireRole('ESTUDIANTE'));
    expect(error?.status).toBe(401);
  });

  it('aplica la matriz de permisos', () => {
    expect(tienePermiso('ESTUDIANTE', 'postulaciones:crear')).toBe(true);
    expect(tienePermiso('ORGANIZACION', 'plazas:aprobar')).toBe(false);
    expect(
      ejecutar(requirePermiso('plazas:aprobar'), { id: 'u1', rol: 'ORGANIZACION' })?.status,
    ).toBe(403);
    expect(
      ejecutar(requirePermiso('plazas:crear'), { id: 'u1', rol: 'ORGANIZACION' }),
    ).toBeUndefined();
  });
});
