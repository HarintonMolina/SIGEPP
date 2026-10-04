import { z } from 'zod';

export const ROLES = [
  'ESTUDIANTE', 'TUTOR_ACADEMICO', 'TUTOR_EMPRESARIAL',
  'ORGANIZACION', 'COORDINADOR', 'ADMIN',
] as const;

export type Rol = (typeof ROLES)[number];

export const usuarioSchema = z.object({
  id: z.string(),
  nombres: z.string(),
  apellidos: z.string(),
  correo: z.string(),
  rol: z.enum(ROLES),
  estado: z.enum(['ACTIVO', 'INACTIVO']),
  telefono: z.string().nullable(),
  creadoEn: z.string().datetime(),
  estudiante: z.object({
    id: z.string(),
    carnet: z.string(),
    carrera: z.string(),
    anio: z.number().int(),
    porcentajeAvance: z.string(),
    avanceVerificado: z.boolean(),
  }).nullable(),
  docente: z.object({
    id: z.string(), departamento: z.string(), especialidad: z.string().nullable(),
  }).nullable(),
  tutorEmpresarial: z.object({
    id: z.string(), organizacionId: z.string(), cargo: z.string(),
  }).nullable(),
  organizacion: z.object({
    id: z.string(), razonSocial: z.string(),
    estadoVerificacion: z.enum(['PENDIENTE', 'VERIFICADA', 'RECHAZADA']),
  }).nullable(),
});

export const usuarioResponseSchema = z.object({ usuario: usuarioSchema });
export const sesionResponseSchema = z.object({ accessToken: z.string(), usuario: usuarioSchema });

export type Usuario = z.infer<typeof usuarioSchema>;
export type SesionResponse = z.infer<typeof sesionResponseSchema>;

type DatosPersonalesInput = {
  nombres: string; apellidos: string; correo: string;
  contrasena: string; telefono?: string;
};
export type RegistroInput = DatosPersonalesInput & (
  | { rol: 'ESTUDIANTE'; carnet: string; carrera: string; anio: number }
  | { rol: 'TUTOR_ACADEMICO'; departamento: string; especialidad?: string }
);
export type LoginInput = { correo: string; contrasena: string };
