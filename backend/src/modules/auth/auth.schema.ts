import { z } from '../../lib/zod.js';

export const correo = z
  .string({ required_error: 'El correo es obligatorio' })
  .trim()
  .toLowerCase()
  .email('Correo no válido');

export const contrasena = z
  .string({ required_error: 'La contraseña es obligatoria' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña no puede superar los 72 caracteres')
  .regex(/[A-Za-z]/, 'La contraseña debe contener al menos una letra')
  .regex(/\d/, 'La contraseña debe contener al menos un número')
  .openapi({ example: 'Segura2026' });

export const datosPersonales = {
  nombres: z
    .string()
    .trim()
    .min(2, 'Nombres demasiado cortos')
    .max(80)
    .openapi({ example: 'Ana Lucía' }),
  apellidos: z
    .string()
    .trim()
    .min(2, 'Apellidos demasiado cortos')
    .max(80)
    .openapi({ example: 'Pérez Gómez' }),
  correo,
  contrasena,
  telefono: z
    .string()
    .trim()
    .regex(/^\+?[\d\s-]{8,15}$/, 'Teléfono no válido')
    .optional()
    .openapi({ example: '+505 8888 0000' }),
};

/**
 * RF-01: el registro abierto es solo para estudiantes y docentes (tutores académicos).
 * Las organizaciones se registran por su propio endpoint (RF-05) y los
 * coordinadores y administradores los crea un administrador.
 */
export const registroSchema = z
  .discriminatedUnion('rol', [
    z
      .object({
        rol: z.literal('ESTUDIANTE'),
        ...datosPersonales,
        correo: correo.openapi({ example: 'ana.perez@std.uni.edu.ni' }),
        carnet: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^\d{4}-\d{4}[A-Z]$/, 'El carnet debe tener el formato 2022-0802U')
          .openapi({ example: '2022-0802U' }),
        carrera: z.string().trim().min(3).max(100).openapi({ example: 'Ingeniería en Sistemas' }),
        anio: z.coerce.number().int().min(1).max(5).openapi({ example: 5 }),
      })
      .openapi('RegistroEstudiante'),
    z
      .object({
        rol: z.literal('TUTOR_ACADEMICO'),
        ...datosPersonales,
        correo: correo.openapi({ example: 'docente@uni.edu.ni' }),
        departamento: z
          .string()
          .trim()
          .min(3)
          .max(100)
          .openapi({ example: 'Ingeniería en Sistemas' }),
        especialidad: z.string().trim().max(100).optional().openapi({ example: 'Bases de Datos' }),
      })
      .openapi('RegistroDocente'),
  ])
  .openapi('Registro');

export const loginSchema = z
  .object({
    correo: correo.openapi({ example: 'maria.gonzalez@std.uni.edu.ni' }),
    contrasena: z
      .string({ required_error: 'La contraseña es obligatoria' })
      .min(1)
      .max(72)
      .openapi({ example: 'Sigepp2026' }),
  })
  .openapi('Login');

export const rolSchema = z.enum([
  'ESTUDIANTE',
  'TUTOR_ACADEMICO',
  'TUTOR_EMPRESARIAL',
  'ORGANIZACION',
  'COORDINADOR',
  'ADMIN',
]);

/** Representación pública del usuario (nunca incluye el hash de la contraseña). Solo para documentación. */
export const usuarioPublicoSchema = z
  .object({
    id: z.string().openapi({ example: 'cmuppsesc000l149zydwil4e7' }),
    nombres: z.string(),
    apellidos: z.string(),
    correo: z.string(),
    rol: rolSchema,
    estado: z.enum(['ACTIVO', 'INACTIVO']),
    telefono: z.string().nullable(),
    creadoEn: z.string().datetime(),
    estudiante: z
      .object({
        id: z.string(),
        carnet: z.string(),
        carrera: z.string(),
        anio: z.number().int(),
        porcentajeAvance: z.string().openapi({ example: '92' }),
        avanceVerificado: z.boolean(),
      })
      .nullable(),
    docente: z
      .object({ id: z.string(), departamento: z.string(), especialidad: z.string().nullable() })
      .nullable(),
    tutorEmpresarial: z
      .object({ id: z.string(), organizacionId: z.string(), cargo: z.string() })
      .nullable(),
    organizacion: z
      .object({
        id: z.string(),
        razonSocial: z.string(),
        estadoVerificacion: z.enum(['PENDIENTE', 'VERIFICADA', 'RECHAZADA']),
      })
      .nullable(),
  })
  .openapi('Usuario');

export type RegistroInput = z.infer<typeof registroSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
