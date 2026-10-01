import {
  json,
  MetaPaginacionSchema,
  registro,
  respuestasError,
  seguridad,
} from '../../docs/registro.js';
import { z } from '../../lib/zod.js';
import {
  actualizarPlazaSchema,
  crearPlazaSchema,
  estadoPlazaSchema,
  idParams,
  listarMisPlazasQuery,
  listarPlazasPublicasQuery,
  listarPlazasQuery,
  modalidadSchema,
  rechazarPlazaSchema,
} from './plazas.schema.js';

const tag = 'Plazas';

const plazaSchema = registro.register(
  'Plaza',
  z.object({
    id: z.string(),
    titulo: z.string().openapi({ example: 'Desarrollador Web Jr.' }),
    descripcion: z.string(),
    area: z.string().openapi({ example: 'Desarrollo de software' }),
    modalidad: modalidadSchema,
    ubicacion: z.string().openapi({ example: 'Managua' }),
    cupos: z.number().int(),
    cuposOcupados: z.number().int(),
    cuposDisponibles: z.number().int(),
    horario: z.string(),
    competencias: z.array(z.string()),
    estado: estadoPlazaSchema,
    motivoRechazo: z.string().nullable(),
    publicadaEn: z.string().datetime().nullable(),
    creadaEn: z.string().datetime(),
    actualizadaEn: z.string().datetime(),
    totalPostulaciones: z.number().int(),
    organizacion: z.object({
      id: z.string(),
      razonSocial: z.string(),
      sector: z.string(),
      sitioWeb: z.string().nullable(),
      direccion: z.string(),
    }),
    periodo: z.object({
      id: z.string(),
      nombre: z.string().openapi({ example: 'II Semestre 2026' }),
    }),
    aprobadaPor: z
      .object({ id: z.string(), nombres: z.string(), apellidos: z.string() })
      .nullable(),
  }),
);

const plazaPublicaSchema = registro.register(
  'PlazaPublica',
  z.object({
    id: z.string(),
    titulo: z.string().openapi({ example: 'Desarrollador Web Jr.' }),
    descripcion: z.string(),
    area: z.string(),
    modalidad: modalidadSchema,
    ubicacion: z.string(),
    cuposDisponibles: z.number().int(),
    horario: z.string(),
    competencias: z.array(z.string()),
    publicadaEn: z.string().datetime().nullable(),
    periodo: z.string().openapi({ example: 'II Semestre 2026' }),
    organizacion: z.object({
      razonSocial: z.string(),
      sector: z.string(),
      sitioWeb: z.string().nullable(),
    }),
  }),
);

const paginado = (schema: z.ZodTypeAny) =>
  z.object({ data: z.array(schema), meta: MetaPaginacionSchema });
const unaPlaza = z.object({ plaza: plazaSchema });

registro.registerPath({
  method: 'get',
  path: '/plazas',
  tags: [tag],
  summary: 'Buscar plazas (RF-10)',
  description:
    'Búsqueda por texto, filtros, orden y paginación sobre el período activo. Los estudiantes y demás roles solo reciben plazas APROBADAS (RN-04); coordinación y administración pueden filtrar por cualquier estado.',
  security: seguridad,
  request: { query: listarPlazasQuery },
  responses: {
    200: json(paginado(plazaSchema), 'Listado paginado'),
    ...respuestasError(400, 401),
  },
});

registro.registerPath({
  method: 'get',
  path: '/plazas/filtros',
  tags: [tag],
  summary: 'Opciones para el panel de filtros',
  description: 'Áreas, ubicaciones y organizaciones con plazas aprobadas en el período activo.',
  security: seguridad,
  responses: {
    200: json(
      z.object({
        areas: z.array(z.string()),
        ubicaciones: z.array(z.string()),
        organizaciones: z.array(z.object({ id: z.string(), razonSocial: z.string() })),
      }),
      'Valores disponibles',
    ),
    ...respuestasError(401),
  },
});

registro.registerPath({
  method: 'get',
  path: '/plazas/mias',
  tags: [tag],
  summary: 'Plazas de mi organización',
  description: 'Todas las plazas de la organización del representante, en cualquier estado.',
  security: seguridad,
  request: { query: listarMisPlazasQuery },
  responses: {
    200: json(paginado(plazaSchema), 'Listado paginado'),
    ...respuestasError(400, 401, 403),
  },
});

registro.registerPath({
  method: 'get',
  path: '/plazas/{id}',
  tags: [tag],
  summary: 'Detalle de una plaza',
  description:
    'Una plaza no aprobada solo es visible para coordinación, administración y la propia organización; para los demás responde 404.',
  security: seguridad,
  request: { params: idParams },
  responses: {
    200: json(unaPlaza, 'Plaza'),
    ...respuestasError(401, 404),
  },
});

registro.registerPath({
  method: 'post',
  path: '/plazas',
  tags: [tag],
  summary: 'Publicar una plaza (RF-08)',
  description:
    'Crea la plaza en estado EN_REVISION dentro del período activo. La organización debe estar verificada y con convenio vigente (RN-12), de lo contrario responde 422.',
  security: seguridad,
  request: { body: { content: { 'application/json': { schema: crearPlazaSchema } } } },
  responses: {
    201: json(unaPlaza, 'Plaza creada en revisión'),
    ...respuestasError(400, 401, 403, 404, 422),
  },
});

registro.registerPath({
  method: 'put',
  path: '/plazas/{id}',
  tags: [tag],
  summary: 'Corregir una plaza',
  description: 'Solo plazas EN_REVISION o RECHAZADAS; la plaza vuelve a quedar EN_REVISION.',
  security: seguridad,
  request: {
    params: idParams,
    body: { content: { 'application/json': { schema: actualizarPlazaSchema } } },
  },
  responses: {
    200: json(unaPlaza, 'Plaza actualizada'),
    ...respuestasError(400, 401, 403, 404, 409, 422),
  },
});

registro.registerPath({
  method: 'patch',
  path: '/plazas/{id}/aprobar',
  tags: [tag],
  summary: 'Aprobar y publicar una plaza (RF-09, RN-04)',
  description:
    'Solo plazas EN_REVISION (409 en otro caso). Queda en auditoría y notifica a la organización.',
  security: seguridad,
  request: { params: idParams },
  responses: {
    200: json(unaPlaza, 'Plaza aprobada'),
    ...respuestasError(401, 403, 404, 409, 422),
  },
});

registro.registerPath({
  method: 'patch',
  path: '/plazas/{id}/rechazar',
  tags: [tag],
  summary: 'Rechazar una plaza (RF-09)',
  security: seguridad,
  request: {
    params: idParams,
    body: { content: { 'application/json': { schema: rechazarPlazaSchema } } },
  },
  responses: {
    200: json(unaPlaza, 'Plaza rechazada'),
    ...respuestasError(400, 401, 403, 404, 409),
  },
});

registro.registerPath({
  method: 'get',
  path: '/publico/plazas',
  tags: ['API pública'],
  summary: 'Plazas vigentes para sistemas externos (RF-26)',
  description:
    'Endpoint público, sin autenticación y con CORS abierto. Devuelve solo las plazas aprobadas del período activo, sin datos internos. Límite: 60 peticiones por minuto por IP.',
  request: { query: listarPlazasPublicasQuery },
  responses: {
    200: json(paginado(plazaPublicaSchema), 'Listado paginado'),
    ...respuestasError(400, 429),
  },
});
