import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { errores } from '../lib/errores.js';
import { formatearErroresZod } from './error.js';

interface Esquemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Valida cuerpo, consulta y parámetros con Zod antes de llegar al controlador.
 * Los valores validados (y transformados) reemplazan a los originales.
 */
export const validate =
  (esquemas: Esquemas): RequestHandler =>
  (req, _res, next) => {
    const detalles: string[] = [];

    for (const parte of ['params', 'query', 'body'] as const) {
      const esquema = esquemas[parte];
      if (!esquema) continue;
      const resultado = esquema.safeParse(req[parte]);
      if (resultado.success) {
        req[parte] = resultado.data;
      } else {
        detalles.push(...formatearErroresZod(resultado.error));
      }
    }

    next(detalles.length ? errores.validacion(detalles) : undefined);
  };
