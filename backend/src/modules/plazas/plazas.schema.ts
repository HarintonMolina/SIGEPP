import { paginacionQuery } from '../../lib/paginacion.js';
import { z } from '../../lib/zod.js';

export const modalidadSchema = z.enum(['PRESENCIAL', 'REMOTA', 'HIBRIDA']);
export const estadoPlazaSchema = z.enum(['EN_REVISION', 'APROBADA', 'RECHAZADA', 'CERRADA']);

export const idParams = z.object({
  id: z.string().min(1).openapi({ example: 'cmuppsesm000v149zrigypm7t' }),
});

const camposPlaza = {
  titulo: z.string().trim().min(5).max(120).openapi({ example: 'Desarrollador Web Jr.' }),
  descripcion: z
    .string()
    .trim()
    .min(20, 'La descripción debe tener al menos 20 caracteres')
    .max(3000)
    .openapi({ example: 'Apoyo en el desarrollo de una aplicación web con React y Node.js.' }),
  area: z.string().trim().min(3).max(80).openapi({ example: 'Desarrollo de software' }),
  modalidad: modalidadSchema,
  ubicacion: z.string().trim().min(2).max(80).openapi({ example: 'Managua' }),
  cupos: z.coerce.number().int().min(1).max(20).openapi({ example: 2 }),
  horario: z.string().trim().min(3).max(120).openapi({ example: 'Lunes a viernes, 8:00 a 12:00' }),
  competencias: z
    .array(z.string().trim().min(1).max(50))
    .min(1, 'Indica al menos una competencia')
    .max(15)
    .openapi({ example: ['JavaScript', 'React', 'Git'] }),
};

/** RF-08: publicación de una plaza (queda EN_REVISION hasta su aprobación, RN-04). */
export const crearPlazaSchema = z
  .object({
    ...camposPlaza,
    organizacionId: z.string().optional().openapi({
      description: 'Solo para el administrador; la organización publica siempre a su nombre.',
    }),
  })
  .openapi('CrearPlaza');

export const actualizarPlazaSchema = z.object(camposPlaza).openapi('ActualizarPlaza');

export const rechazarPlazaSchema = z
  .object({
    motivo: z
      .string()
      .trim()
      .min(10, 'Explica el motivo en al menos 10 caracteres')
      .max(500)
      .openapi({ example: 'Las actividades no corresponden al perfil de Ingeniería en Sistemas.' }),
  })
  .openapi('RechazarPlaza');

/** RF-10: búsqueda por texto, filtros, orden y paginación. */
export const listarPlazasQuery = z.object({
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .openapi({ description: 'Texto en título, descripción o área' }),
  area: z.string().trim().max(80).optional(),
  modalidad: modalidadSchema.optional(),
  ubicacion: z.string().trim().max(80).optional(),
  organizacionId: z.string().optional(),
  estado: estadoPlazaSchema.optional().openapi({
    description: 'Solo coordinación y administración; para los demás roles siempre es APROBADA.',
  }),
  orden: z.enum(['recientes', 'titulo', 'cupos']).default('recientes'),
  ...paginacionQuery,
});

export const listarMisPlazasQuery = z.object({
  estado: estadoPlazaSchema.optional(),
  ...paginacionQuery,
});

export const listarPlazasPublicasQuery = z.object({
  q: z.string().trim().max(100).optional(),
  area: z.string().trim().max(80).optional(),
  modalidad: modalidadSchema.optional(),
  ...paginacionQuery,
});

export type CrearPlazaInput = z.infer<typeof crearPlazaSchema>;
export type ActualizarPlazaInput = z.infer<typeof actualizarPlazaSchema>;
export type ListarPlazasQuery = z.infer<typeof listarPlazasQuery>;
export type ListarMisPlazasQuery = z.infer<typeof listarMisPlazasQuery>;
export type ListarPlazasPublicasQuery = z.infer<typeof listarPlazasPublicasQuery>;
