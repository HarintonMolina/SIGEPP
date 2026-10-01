import { z } from 'zod';

const correo = z
  .string({ required_error: 'El correo es obligatorio' })
  .trim()
  .toLowerCase()
  .email('Correo no válido');

const contrasena = z
  .string({ required_error: 'La contraseña es obligatoria' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña no puede superar los 72 caracteres')
  .regex(/[A-Za-z]/, 'La contraseña debe contener al menos una letra')
  .regex(/\d/, 'La contraseña debe contener al menos un número');

const datosPersonales = {
  nombres: z.string().trim().min(2, 'Nombres demasiado cortos').max(80),
  apellidos: z.string().trim().min(2, 'Apellidos demasiado cortos').max(80),
  correo,
  contrasena,
  telefono: z
    .string()
    .trim()
    .regex(/^\+?[\d\s-]{8,15}$/, 'Teléfono no válido')
    .optional(),
};

/**
 * RF-01: el registro abierto es solo para estudiantes y docentes (tutores académicos).
 * Las organizaciones se registran por su propio endpoint (RF-05) y los
 * coordinadores y administradores los crea un administrador.
 */
export const registroSchema = z.discriminatedUnion('rol', [
  z.object({
    rol: z.literal('ESTUDIANTE'),
    ...datosPersonales,
    carnet: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^\d{4}-\d{4}[A-Z]$/, 'El carnet debe tener el formato 2022-0802U'),
    carrera: z.string().trim().min(3).max(100),
    anio: z.coerce.number().int().min(1).max(5),
  }),
  z.object({
    rol: z.literal('TUTOR_ACADEMICO'),
    ...datosPersonales,
    departamento: z.string().trim().min(3).max(100),
    especialidad: z.string().trim().max(100).optional(),
  }),
]);

export const loginSchema = z.object({
  correo,
  contrasena: z.string({ required_error: 'La contraseña es obligatoria' }).min(1).max(72),
});

export type RegistroInput = z.infer<typeof registroSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
