import { paginacionQuery } from '../../lib/paginacion.js';
import { z } from '../../lib/zod.js';

export const listarAuditoriaQuery = z.object({
  entidad: z.string().trim().max(50).optional().openapi({ example: 'Plaza' }),
  entidadId: z.string().trim().max(50).optional(),
  usuarioId: z.string().trim().max(50).optional(),
  accion: z.string().trim().max(50).optional().openapi({ example: 'APROBAR' }),
  desde: z.coerce
    .date()
    .optional()
    .openapi({ type: 'string', format: 'date', example: '2026-10-01' }),
  hasta: z.coerce
    .date()
    .optional()
    .openapi({ type: 'string', format: 'date', example: '2026-10-31' }),
  ...paginacionQuery,
});

export type ListarAuditoriaQuery = z.infer<typeof listarAuditoriaQuery>;
