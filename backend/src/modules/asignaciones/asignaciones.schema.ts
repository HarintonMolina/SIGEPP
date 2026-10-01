import { paginacionQuery } from '../../lib/paginacion.js';
import { z } from '../../lib/zod.js';

export const estadoAsignacionSchema = z.enum(['ASIGNADA', 'EN_CURSO', 'FINALIZADA', 'CANCELADA']);

export const idParams = z.object({
  id: z.string().min(1).openapi({ example: 'cmuq1asig0000149zabcd1234' }),
});

const fecha = z.coerce
  .date({ invalid_type_error: 'Fecha no válida', required_error: 'La fecha es obligatoria' })
  .openapi({ type: 'string', format: 'date' });

/** RF-13: confirmación de la asignación y designación del tutor académico (CU-06). */
export const crearAsignacionSchema = z
  .object({
    postulacionId: z
      .string()
      .min(1)
      .openapi({ description: 'Postulación PRESELECCIONADA por la empresa' }),
    docenteId: z.string().min(1).openapi({ description: 'Docente que será el tutor académico' }),
    tutorEmpresarialId: z
      .string()
      .min(1)
      .openapi({ description: 'Tutor empresarial activo de la organización de la plaza' }),
    fechaInicio: fecha.openapi({ example: '2026-10-19' }),
    fechaFin: fecha.openapi({ example: '2026-12-11' }),
  })
  .refine((d) => d.fechaFin > d.fechaInicio, {
    message: 'La fecha de fin debe ser posterior a la de inicio',
    path: ['fechaFin'],
  })
  .openapi('CrearAsignacion');

export const listarAsignacionesQuery = z.object({
  estado: estadoAsignacionSchema.optional(),
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .openapi({ description: 'Nombre, apellido o carnet del estudiante' }),
  ...paginacionQuery,
});

export type CrearAsignacionInput = z.infer<typeof crearAsignacionSchema>;
export type ListarAsignacionesQuery = z.infer<typeof listarAsignacionesQuery>;
