import type { Rol } from '@prisma/client';
import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { errores } from '../lib/errores.js';

interface PayloadAcceso {
  sub: string;
  rol: Rol;
}

/** Exige el encabezado Authorization: Bearer <token> con un token de acceso válido. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const encabezado = req.headers.authorization;
  if (!encabezado?.startsWith('Bearer ')) {
    return next(errores.noAutenticado());
  }

  try {
    const payload = jwt.verify(encabezado.slice(7), env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
    }) as PayloadAcceso;
    req.usuario = { id: payload.sub, rol: payload.rol };
    next();
  } catch (error) {
    const expirado = error instanceof jwt.TokenExpiredError;
    next(errores.noAutenticado(expirado ? 'La sesión expiró' : 'Token inválido'));
  }
};
