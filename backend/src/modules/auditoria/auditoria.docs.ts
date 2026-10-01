import {
  json,
  MetaPaginacionSchema,
  registro,
  respuestasError,
  seguridad,
} from '../../docs/registro.js';
import { z } from '../../lib/zod.js';
import { listarAuditoriaQuery } from './auditoria.schema.js';

const registroAuditoriaSchema = registro.register(
  'RegistroAuditoria',
  z.object({
    id: z.string(),
    usuarioId: z.string().nullable(),
    entidad: z.string().openapi({ example: 'Plaza' }),
    entidadId: z.string(),
    accion: z.string().openapi({ example: 'APROBAR' }),
    valoresAnteriores: z
      .record(z.unknown())
      .nullable()
      .openapi({ example: { estado: 'EN_REVISION' } }),
    valoresNuevos: z
      .record(z.unknown())
      .nullable()
      .openapi({ example: { estado: 'APROBADA' } }),
    ip: z.string().nullable().openapi({ example: '::1' }),
    creadaEn: z.string().datetime(),
    usuario: z
      .object({ id: z.string(), nombres: z.string(), apellidos: z.string(), rol: z.string() })
      .nullable(),
  }),
);

registro.registerPath({
  method: 'get',
  path: '/auditoria',
  tags: ['Auditoría'],
  summary: 'Consultar la bitácora de auditoría (RNF-13)',
  description:
    'Solo administración. Cada registro guarda usuario, IP, marca de tiempo y valores anterior y posterior; la tabla es inmutable a nivel de base de datos.',
  security: seguridad,
  request: { query: listarAuditoriaQuery },
  responses: {
    200: json(
      z.object({ data: z.array(registroAuditoriaSchema), meta: MetaPaginacionSchema }),
      'Listado paginado',
    ),
    ...respuestasError(400, 401, 403),
  },
});
