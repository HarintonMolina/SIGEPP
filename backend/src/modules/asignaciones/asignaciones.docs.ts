import {
  json,
  MetaPaginacionSchema,
  registro,
  respuestasError,
  seguridad,
} from '../../docs/registro.js';
import { z } from '../../lib/zod.js';
import {
  crearAsignacionSchema,
  estadoAsignacionSchema,
  idParams,
  listarAsignacionesQuery,
} from './asignaciones.schema.js';

const tag = 'Asignaciones';

const persona = z.object({
  id: z.string(),
  nombres: z.string(),
  apellidos: z.string(),
  correo: z.string(),
  telefono: z.string().nullable(),
});

const estadoHito = z.enum(['COMPLETADO', 'EN_CURSO', 'PENDIENTE']);

const asignacionSchema = registro.register(
  'Asignacion',
  z.object({
    id: z.string(),
    estado: estadoAsignacionSchema,
    fechaInicio: z.string().datetime(),
    fechaFin: z.string().datetime(),
    horasAcumuladas: z.number().int(),
    notaFinal: z.string().nullable(),
    creadaEn: z.string().datetime(),
    estudiante: z.object({
      id: z.string(),
      carnet: z.string(),
      carrera: z.string(),
      usuarioId: z.string(),
      usuario: persona,
    }),
    plaza: z.object({
      id: z.string(),
      titulo: z.string(),
      area: z.string(),
      modalidad: z.string(),
      ubicacion: z.string(),
      horario: z.string(),
      organizacion: z.object({ id: z.string(), razonSocial: z.string() }),
    }),
    docente: z.object({
      id: z.string(),
      departamento: z.string(),
      usuarioId: z.string(),
      usuario: persona,
    }),
    tutorEmpresarial: z.object({
      id: z.string(),
      cargo: z.string(),
      usuarioId: z.string(),
      usuario: persona,
    }),
    periodo: z.object({ id: z.string(), nombre: z.string(), horasMinimas: z.number().int() }),
    planTrabajo: z
      .object({
        id: z.string(),
        version: z.number().int(),
        estado: z.string(),
        horasPrevistas: z.number().int(),
        aprobadoDocenteEn: z.string().datetime().nullable(),
        aprobadoEmpresaEn: z.string().datetime().nullable(),
      })
      .nullable(),
    totalBitacoras: z.number().int(),
    progreso: z.object({
      horasAcumuladas: z.number().int(),
      horasMinimas: z.number().int(),
      porcentaje: z.number().int().openapi({ example: 35 }),
    }),
    hitos: z
      .array(z.object({ clave: z.string(), titulo: z.string(), estado: estadoHito }))
      .openapi({ description: 'Línea de tiempo del trámite (RF-24)' }),
    miRol: z
      .enum(['ESTUDIANTE', 'TUTOR_ACADEMICO', 'TUTOR_EMPRESARIAL', 'SUPERVISOR'])
      .optional()
      .openapi({ description: 'Papel del usuario autenticado dentro de la asignación' }),
  }),
);

const unaAsignacion = z.object({ asignacion: asignacionSchema });

registro.registerPath({
  method: 'get',
  path: '/asignaciones',
  tags: [tag],
  summary: 'Listar asignaciones',
  description:
    'Cada rol recibe solo las asignaciones en las que participa (estudiante, tutor académico o empresarial); coordinación y administración ven todas.',
  security: seguridad,
  request: { query: listarAsignacionesQuery },
  responses: {
    200: json(
      z.object({ data: z.array(asignacionSchema), meta: MetaPaginacionSchema }),
      'Listado paginado',
    ),
    ...respuestasError(400, 401, 403),
  },
});

registro.registerPath({
  method: 'get',
  path: '/asignaciones/candidatos',
  tags: [tag],
  summary: 'Postulaciones preseleccionadas pendientes de asignar',
  description:
    'Coordinación. Incluye los tutores empresariales activos de cada organización para elegir uno.',
  security: seguridad,
  responses: {
    200: json(
      z.object({
        candidatos: z.array(
          z.object({
            id: z.string().openapi({ description: 'Id de la postulación' }),
            estudiante: z.object({
              id: z.string(),
              carnet: z.string(),
              porcentajeAvance: z.string(),
            }),
            plaza: z.object({
              id: z.string(),
              titulo: z.string(),
              cuposDisponibles: z.number().int(),
            }),
            tutoresEmpresariales: z.array(z.object({ id: z.string(), cargo: z.string() })),
          }),
        ),
      }),
      'Candidatos',
    ),
    ...respuestasError(401, 403),
  },
});

registro.registerPath({
  method: 'get',
  path: '/asignaciones/docentes',
  tags: [tag],
  summary: 'Docentes con su carga de tutorados (RN-06)',
  security: seguridad,
  responses: {
    200: json(
      z.object({
        docentes: z.array(
          z.object({
            id: z.string(),
            departamento: z.string(),
            cupoMaximo: z.number().int(),
            cupoOcupado: z.number().int(),
            cupoDisponible: z.number().int(),
          }),
        ),
      }),
      'Docentes',
    ),
    ...respuestasError(401, 403),
  },
});

registro.registerPath({
  method: 'get',
  path: '/asignaciones/actual',
  tags: [tag],
  summary: 'Asignación activa del estudiante autenticado',
  security: seguridad,
  responses: {
    200: json(unaAsignacion, 'Expediente del estudiante'),
    ...respuestasError(401, 403, 404),
  },
});

registro.registerPath({
  method: 'get',
  path: '/asignaciones/{id}',
  tags: [tag],
  summary: 'Expediente de una asignación',
  description:
    'Solo para las partes de la asignación y la coordinación; para cualquier otro usuario responde 404.',
  security: seguridad,
  request: { params: idParams },
  responses: {
    200: json(unaAsignacion, 'Expediente'),
    ...respuestasError(401, 403, 404),
  },
});

registro.registerPath({
  method: 'post',
  path: '/asignaciones',
  tags: [tag],
  summary: 'Confirmar asignación y designar tutor académico (RF-13)',
  description: [
    'Valida las reglas de negocio:',
    '- **RN-02**: el estudiante no puede tener otra asignación activa en el período (409).',
    '- **RN-05**: el tutor empresarial debe estar activo y pertenecer a la organización de la plaza (422).',
    '- **RN-06**: el docente no puede superar su máximo de tutorados (422).',
    '',
    'Ocupa un cupo de la plaza, retira las demás postulaciones pendientes del estudiante y notifica a las tres partes.',
  ].join('\n'),
  security: seguridad,
  request: { body: { content: { 'application/json': { schema: crearAsignacionSchema } } } },
  responses: {
    201: json(unaAsignacion, 'Asignación creada'),
    ...respuestasError(400, 401, 403, 404, 409, 422),
  },
});
