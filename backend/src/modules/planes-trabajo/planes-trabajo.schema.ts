import { z } from '../../lib/zod.js';

export const estadoPlanSchema = z.enum(['BORRADOR', 'EN_REVISION', 'OBSERVADO', 'APROBADO']);

export const idParams = z.object({ id: z.string().min(1) });

export const actividadSchema = z
  .object({
    descripcion: z
      .string()
      .trim()
      .min(5)
      .max(300)
      .openapi({ example: 'Levantamiento de requisitos del módulo de inventario' }),
    semanaInicio: z.coerce.number().int().min(1).max(26).openapi({ example: 1 }),
    semanaFin: z.coerce.number().int().min(1).max(26).openapi({ example: 2 }),
    horas: z.coerce.number().int().min(1).max(200).openapi({ example: 40 }),
  })
  .refine((a) => a.semanaFin >= a.semanaInicio, {
    message: 'La semana de fin no puede ser anterior a la de inicio',
    path: ['semanaFin'],
  })
  .openapi('ActividadPlan');

/** RF-14: contenido del plan. Las horas previstas se calculan sumando las actividades. */
export const planSchema = z
  .object({
    objetivos: z
      .string()
      .trim()
      .min(20, 'Describe los objetivos en al menos 20 caracteres')
      .max(2000)
      .openapi({
        example:
          'Desarrollar el módulo de inventario de la aplicación web aplicando buenas prácticas de ingeniería de software.',
      }),
    actividades: z
      .array(actividadSchema)
      .min(1, 'Agrega al menos una actividad')
      .max(30, 'Máximo 30 actividades'),
  })
  .openapi('PlanTrabajoEntrada');

export const observarPlanSchema = z
  .object({
    observacion: z
      .string()
      .trim()
      .min(10, 'Explica la observación en al menos 10 caracteres')
      .max(1000)
      .openapi({
        example: 'Detalla las horas de la actividad de pruebas y agrega la documentación técnica.',
      }),
  })
  .openapi('ObservarPlan');

export type PlanInput = z.infer<typeof planSchema>;
