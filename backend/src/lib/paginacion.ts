import type { Request } from 'express';
import { z } from './zod.js';

/** Parámetros de paginación comunes a todos los listados (Fase 1, sección 5.3.1). */
export const paginacionQuery = {
  page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
  limit: z.coerce.number().int().min(1).max(50).default(10).openapi({ example: 10 }),
};

export interface Paginado<T> {
  data: T[];
  meta: {
    total: number;
    pagina: number;
    limite: number;
    totalPaginas: number;
    siguiente: string | null;
    anterior: string | null;
  };
}

export const saltar = (page: number, limit: number) => (page - 1) * limit;

/** Construye la respuesta paginada con enlaces a la página siguiente y anterior. */
export const paginar = <T>(
  req: Request,
  data: T[],
  total: number,
  page: number,
  limit: number,
): Paginado<T> => {
  const totalPaginas = Math.max(1, Math.ceil(total / limit));

  const enlace = (pagina: number) => {
    const params = new URLSearchParams();
    for (const [clave, valor] of Object.entries(req.query)) {
      if (valor !== undefined && valor !== '') params.set(clave, String(valor));
    }
    params.set('page', String(pagina));
    params.set('limit', String(limit));
    return `${req.baseUrl}${req.path === '/' ? '' : req.path}?${params.toString()}`;
  };

  return {
    data,
    meta: {
      total,
      pagina: page,
      limite: limit,
      totalPaginas,
      siguiente: page < totalPaginas ? enlace(page + 1) : null,
      anterior: page > 1 ? enlace(page - 1) : null,
    },
  };
};
