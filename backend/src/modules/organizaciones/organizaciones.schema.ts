import { paginacionQuery } from '../../lib/paginacion.js';
import { z } from '../../lib/zod.js';
import { correo, datosPersonales } from '../auth/auth.schema.js';

export const estadoVerificacionSchema = z.enum(['PENDIENTE', 'VERIFICADA', 'RECHAZADA']);

export const idParams = z.object({
  id: z.string().min(1).openapi({ example: 'cmuppserf0000149zl9zbw8h1' }),
});
export const tutorParams = idParams.extend({ tutorId: z.string().min(1) });

/** RF-05: registro público de una organización receptora junto con su representante. */
export const registroOrganizacionSchema = z
  .object({
    razonSocial: z
      .string()
      .trim()
      .min(3)
      .max(150)
      .openapi({ example: 'Soluciones Digitales del Pacífico, S.A.' }),
    ruc: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{14}$/, 'El RUC debe tener 14 caracteres alfanuméricos')
      .openapi({ example: 'J0310000000001' }),
    sector: z.string().trim().min(3).max(80).openapi({ example: 'Tecnología' }),
    direccion: z
      .string()
      .trim()
      .min(5)
      .max(250)
      .openapi({ example: 'Managua, Carretera a Masaya km 5' }),
    sitioWeb: z
      .string()
      .trim()
      .url('Sitio web no válido')
      .optional()
      .openapi({ example: 'https://example.com' }),
    representante: z
      .object({ ...datosPersonales, correo: correo.openapi({ example: 'rrhh@empresa.com.ni' }) })
      .openapi('RepresentanteOrganizacion'),
  })
  .openapi('RegistroOrganizacion');

export const listarOrganizacionesQuery = z.object({
  estado: estadoVerificacionSchema.optional(),
  q: z.string().trim().max(100).optional().openapi({ description: 'Busca por razón social o RUC' }),
  ...paginacionQuery,
});

/** RF-06: verificación de la organización y vigencia del convenio (RN-12). */
export const verificarOrganizacionSchema = z
  .object({
    estado: z.enum(['VERIFICADA', 'RECHAZADA']),
    convenioVigenteHasta: z.coerce
      .date({ invalid_type_error: 'Fecha no válida' })
      .optional()
      .openapi({ type: 'string', format: 'date', example: '2027-12-31' }),
  })
  .refine(
    (d) =>
      d.estado !== 'VERIFICADA' || (d.convenioVigenteHasta && d.convenioVigenteHasta > new Date()),
    {
      message: 'Para verificar se requiere una fecha de vigencia del convenio posterior a hoy',
      path: ['convenioVigenteHasta'],
    },
  )
  .openapi('VerificarOrganizacion');

/** RF-07: alta de un tutor empresarial por parte de la organización. */
export const crearTutorSchema = z
  .object({
    ...datosPersonales,
    correo: correo.openapi({ example: 'tutor@empresa.com.ni' }),
    cargo: z.string().trim().min(2).max(100).openapi({ example: 'Líder de desarrollo' }),
  })
  .openapi('CrearTutorEmpresarial');

export const actualizarTutorSchema = z
  .object({ activo: z.boolean().openapi({ description: 'false da de baja al tutor' }) })
  .openapi('ActualizarTutorEmpresarial');

export type RegistroOrganizacionInput = z.infer<typeof registroOrganizacionSchema>;
export type ListarOrganizacionesQuery = z.infer<typeof listarOrganizacionesQuery>;
export type VerificarOrganizacionInput = z.infer<typeof verificarOrganizacionSchema>;
export type CrearTutorInput = z.infer<typeof crearTutorSchema>;
