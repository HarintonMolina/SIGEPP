import { z } from 'zod';
import type { LoginInput, RegistroInput } from './contracts';

const textoSchema = z.string({ required_error: 'Ingresa este campo.', invalid_type_error: 'Ingresa un texto válido.' });
const correoSchema = textoSchema.trim().toLowerCase().email('Ingresa un correo válido.');
const nombreSchema = textoSchema.trim()
  .min(2, 'Ingresa al menos 2 caracteres.').max(80, 'Ingresa como máximo 80 caracteres.');
const areaSchema = textoSchema.trim()
  .min(3, 'Ingresa al menos 3 caracteres.').max(100, 'Ingresa como máximo 100 caracteres.');
const contrasenaRegistroSchema = textoSchema
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(72, 'La contraseña debe tener como máximo 72 caracteres.')
  .regex(/[A-Za-z]/, 'La contraseña debe incluir una letra.')
  .regex(/\d/, 'La contraseña debe incluir un dígito.');
const telefonoSchema = textoSchema.trim()
  .refine((value) => value === '' || /^\+?[\d\s-]{8,15}$/.test(value), 'Ingresa un teléfono válido.')
  .optional();
// RHF's select supplies a string; its resolver passes the parsed number to submit.
const anioSchema = z.union([textoSchema, z.number()], {
  errorMap: () => ({ message: 'Selecciona un año entre 1 y 5.' }),
})
  .transform((value) => typeof value === 'string' ? Number(value) : value)
  .pipe(z.number({ invalid_type_error: 'Selecciona un año entre 1 y 5.' }).int('Selecciona un año entero.')
    .min(1, 'Selecciona un año entre 1 y 5.').max(5, 'Selecciona un año entre 1 y 5.'));

export function createRegistroFormSchema(domains: readonly string[]) {
  const comunes = {
    nombres: nombreSchema,
    apellidos: nombreSchema,
    correo: correoSchema.refine((value) => domains.includes(value.split('@')[1]),
      'Usa un correo institucional permitido.'),
    contrasena: contrasenaRegistroSchema,
    confirmacion: textoSchema,
    telefono: telefonoSchema,
  };
  return z.discriminatedUnion('rol', [
    z.object({
      ...comunes,
      rol: z.literal('ESTUDIANTE'),
      carnet: textoSchema.trim().toUpperCase().regex(/^\d{4}-\d{4}[A-Z]$/, 'Ingresa un carnet válido.'),
      carrera: areaSchema,
      anio: anioSchema,
    }),
    z.object({
      ...comunes,
      rol: z.literal('TUTOR_ACADEMICO'),
      departamento: areaSchema,
      especialidad: textoSchema.trim().max(100, 'Ingresa como máximo 100 caracteres.').optional(),
    }),
  ], { errorMap: () => ({ message: 'Selecciona estudiante o tutor académico.' }) }).refine((values) => values.contrasena === values.confirmacion, {
    message: 'Las contraseñas deben coincidir.', path: ['confirmacion'],
  });
}

export type RegistroFormValues = z.input<ReturnType<typeof createRegistroFormSchema>>;
export type RegistroFormParsed = z.output<ReturnType<typeof createRegistroFormSchema>>;

export function toRegistroInput(values: RegistroFormParsed): RegistroInput {
  const telefono = values.telefono?.trim();
  const comunes = {
    nombres: values.nombres, apellidos: values.apellidos,
    correo: values.correo, contrasena: values.contrasena,
    ...(telefono ? { telefono } : {}),
  };
  if (values.rol === 'ESTUDIANTE') {
    return { ...comunes, rol: values.rol, carnet: values.carnet, carrera: values.carrera, anio: values.anio };
  }
  const especialidad = values.especialidad?.trim();
  return {
    ...comunes, rol: values.rol, departamento: values.departamento,
    ...(especialidad ? { especialidad } : {}),
  };
}

export const loginFormSchema = z.object({
  correo: correoSchema,
  contrasena: textoSchema.min(1, 'Ingresa tu contraseña.')
    .max(72, 'La contraseña debe tener como máximo 72 caracteres.'),
}) satisfies z.ZodType<LoginInput>;
