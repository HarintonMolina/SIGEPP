import {
  json,
  MetaPaginacionSchema,
  registro,
  respuestasError,
  seguridad,
} from '../../docs/registro.js';
import { z } from '../../lib/zod.js';
import {
  actualizarTutorSchema,
  crearTutorSchema,
  estadoVerificacionSchema,
  idParams,
  listarOrganizacionesQuery,
  registroOrganizacionSchema,
  tutorParams,
  verificarOrganizacionSchema,
} from './organizaciones.schema.js';

const tag = 'Organizaciones';

const usuarioBasicoSchema = z.object({
  id: z.string(),
  nombres: z.string(),
  apellidos: z.string(),
  correo: z.string(),
  telefono: z.string().nullable(),
});

const tutorSchema = registro.register(
  'TutorEmpresarial',
  z.object({
    id: z.string(),
    cargo: z.string(),
    activo: z.boolean(),
    usuario: usuarioBasicoSchema.extend({ estado: z.enum(['ACTIVO', 'INACTIVO']) }),
  }),
);

const organizacionSchema = registro.register(
  'Organizacion',
  z.object({
    id: z.string(),
    razonSocial: z.string(),
    ruc: z.string(),
    sector: z.string(),
    direccion: z.string(),
    sitioWeb: z.string().nullable(),
    estadoVerificacion: estadoVerificacionSchema,
    convenioVigenteHasta: z.string().datetime().nullable(),
    creadaEn: z.string().datetime(),
    representante: usuarioBasicoSchema,
    _count: z.object({ plazas: z.number().int(), tutoresEmpresariales: z.number().int() }),
  }),
);

const organizacionDetalle = organizacionSchema.extend({
  tutoresEmpresariales: z.array(tutorSchema),
});

registro.registerPath({
  method: 'post',
  path: '/organizaciones',
  tags: [tag],
  summary: 'Registrar organización receptora (RF-05)',
  description:
    'Registro público. Crea la organización en estado PENDIENTE y la cuenta de su representante; la coordinación debe verificarla antes de que pueda publicar plazas (RN-12).',
  request: { body: { content: { 'application/json': { schema: registroOrganizacionSchema } } } },
  responses: {
    201: json(z.object({ organizacion: organizacionSchema }), 'Organización registrada'),
    ...respuestasError(400, 409, 429),
  },
});

registro.registerPath({
  method: 'get',
  path: '/organizaciones',
  tags: [tag],
  summary: 'Listar organizaciones',
  description: 'Coordinación y administración. Permite filtrar por estado de verificación.',
  security: seguridad,
  request: { query: listarOrganizacionesQuery },
  responses: {
    200: json(
      z.object({ data: z.array(organizacionSchema), meta: MetaPaginacionSchema }),
      'Listado paginado',
    ),
    ...respuestasError(400, 401, 403),
  },
});

registro.registerPath({
  method: 'get',
  path: '/organizaciones/mia',
  tags: [tag],
  summary: 'Organización del representante autenticado',
  security: seguridad,
  responses: {
    200: json(z.object({ organizacion: organizacionDetalle }), 'Organización con sus tutores'),
    ...respuestasError(401, 403, 404),
  },
});

registro.registerPath({
  method: 'get',
  path: '/organizaciones/{id}',
  tags: [tag],
  summary: 'Detalle de una organización',
  description: 'Coordinación, administración o el representante de la propia organización.',
  security: seguridad,
  request: { params: idParams },
  responses: {
    200: json(z.object({ organizacion: organizacionDetalle }), 'Organización con sus tutores'),
    ...respuestasError(401, 403, 404),
  },
});

registro.registerPath({
  method: 'patch',
  path: '/organizaciones/{id}/verificar',
  tags: [tag],
  summary: 'Verificar o rechazar una organización (RF-06)',
  description:
    'Registra el resultado de la verificación y la vigencia del convenio. Queda en la bitácora de auditoría y notifica al representante.',
  security: seguridad,
  request: {
    params: idParams,
    body: { content: { 'application/json': { schema: verificarOrganizacionSchema } } },
  },
  responses: {
    200: json(z.object({ organizacion: organizacionSchema }), 'Organización actualizada'),
    ...respuestasError(400, 401, 403, 404),
  },
});

registro.registerPath({
  method: 'get',
  path: '/organizaciones/{id}/tutores',
  tags: [tag],
  summary: 'Listar tutores empresariales',
  security: seguridad,
  request: { params: idParams },
  responses: {
    200: json(z.object({ tutores: z.array(tutorSchema) }), 'Tutores de la organización'),
    ...respuestasError(401, 403, 404),
  },
});

registro.registerPath({
  method: 'post',
  path: '/organizaciones/{id}/tutores',
  tags: [tag],
  summary: 'Dar de alta un tutor empresarial (RF-07)',
  security: seguridad,
  request: {
    params: idParams,
    body: { content: { 'application/json': { schema: crearTutorSchema } } },
  },
  responses: {
    201: json(z.object({ tutor: tutorSchema }), 'Tutor creado'),
    ...respuestasError(400, 401, 403, 404, 409),
  },
});

registro.registerPath({
  method: 'patch',
  path: '/organizaciones/{id}/tutores/{tutorId}',
  tags: [tag],
  summary: 'Dar de baja o reactivar un tutor empresarial (RF-07)',
  description: 'No se permite dar de baja a un tutor con asignaciones activas (409).',
  security: seguridad,
  request: {
    params: tutorParams,
    body: { content: { 'application/json': { schema: actualizarTutorSchema } } },
  },
  responses: {
    200: json(z.object({ tutor: tutorSchema }), 'Tutor actualizado'),
    ...respuestasError(400, 401, 403, 404, 409),
  },
});
