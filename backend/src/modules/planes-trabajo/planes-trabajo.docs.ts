import { json, registro, respuestasError, seguridad } from '../../docs/registro.js';
import { z } from '../../lib/zod.js';
import { idParams as asignacionParams } from '../asignaciones/asignaciones.schema.js';
import {
  actividadSchema,
  estadoPlanSchema,
  idParams,
  observarPlanSchema,
  planSchema,
} from './planes-trabajo.schema.js';

const tag = 'Plan de trabajo';

const planTrabajoSchema = registro.register(
  'PlanTrabajo',
  z.object({
    id: z.string(),
    asignacionId: z.string(),
    version: z.number().int(),
    objetivos: z.string(),
    actividades: z.array(actividadSchema),
    horasPrevistas: z
      .number()
      .int()
      .openapi({ description: 'Suma de las horas de las actividades' }),
    estado: estadoPlanSchema,
    aprobadoDocenteEn: z.string().datetime().nullable(),
    aprobadoEmpresaEn: z.string().datetime().nullable(),
    actualizadoEn: z.string().datetime(),
    versiones: z
      .array(
        z.object({
          version: z.number().int(),
          objetivos: z.string(),
          actividades: z.array(actividadSchema),
          horasPrevistas: z.number().int(),
          observacionDocente: z.string().nullable(),
          observacionEmpresa: z.string().nullable(),
          creadaEn: z.string().datetime(),
        }),
      )
      .openapi({
        description:
          'Historial de versiones enviadas a revisión, de la más reciente a la más antigua',
      }),
  }),
);

const unPlan = z.object({ plan: planTrabajoSchema });
const cuerpoPlan = { body: { content: { 'application/json': { schema: planSchema } } } };

registro.registerPath({
  method: 'get',
  path: '/asignaciones/{id}/plan',
  tags: [tag],
  summary: 'Plan de trabajo de una asignación',
  security: seguridad,
  request: { params: asignacionParams },
  responses: {
    200: json(unPlan, 'Plan con su historial de versiones'),
    ...respuestasError(401, 403, 404),
  },
});

registro.registerPath({
  method: 'post',
  path: '/asignaciones/{id}/plan',
  tags: [tag],
  summary: 'Crear el plan de trabajo (RF-14)',
  description: 'El estudiante de la asignación crea su plan en estado BORRADOR.',
  security: seguridad,
  request: { params: asignacionParams, ...cuerpoPlan },
  responses: {
    201: json(unPlan, 'Plan creado'),
    ...respuestasError(400, 401, 403, 404, 409),
  },
});

registro.registerPath({
  method: 'put',
  path: '/planes-trabajo/{id}',
  tags: [tag],
  summary: 'Reemplazar el contenido del plan',
  description:
    'Solo en estado BORRADOR u OBSERVADO; un plan en revisión o aprobado no se puede editar (409).',
  security: seguridad,
  request: { params: idParams, ...cuerpoPlan },
  responses: {
    200: json(unPlan, 'Plan actualizado'),
    ...respuestasError(400, 401, 403, 404, 409),
  },
});

registro.registerPath({
  method: 'post',
  path: '/planes-trabajo/{id}/enviar',
  tags: [tag],
  summary: 'Enviar el plan a revisión de los tutores',
  description:
    'Guarda la versión enviada en el historial. Las horas previstas deben alcanzar las horas mínimas del período (422).',
  security: seguridad,
  request: { params: idParams },
  responses: {
    200: json(unPlan, 'Plan en revisión'),
    ...respuestasError(401, 403, 404, 409, 422),
  },
});

registro.registerPath({
  method: 'patch',
  path: '/planes-trabajo/{id}/aprobar',
  tags: [tag],
  summary: 'Aprobar el plan (RF-15, RN-07)',
  description:
    'Cada tutor aprueba por separado. Con ambas aprobaciones el plan queda APROBADO y la asignación pasa a EN_CURSO, lo que habilita las bitácoras.',
  security: seguridad,
  request: { params: idParams },
  responses: {
    200: json(unPlan, 'Aprobación registrada'),
    ...respuestasError(401, 403, 404, 409),
  },
});

registro.registerPath({
  method: 'patch',
  path: '/planes-trabajo/{id}/observar',
  tags: [tag],
  summary: 'Devolver el plan con observaciones (RF-15)',
  description:
    'La observación queda guardada en la versión revisada y el estudiante es notificado.',
  security: seguridad,
  request: {
    params: idParams,
    body: { content: { 'application/json': { schema: observarPlanSchema } } },
  },
  responses: {
    200: json(unPlan, 'Plan observado'),
    ...respuestasError(400, 401, 403, 404, 409),
  },
});
