import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from '../lib/zod.js';

/** Registro central de la especificación OpenAPI; cada módulo agrega aquí sus rutas. */
export const registro = new OpenAPIRegistry();

export const bearerAuth = registro.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'Token de acceso obtenido en POST /auth/login (vigencia de 15 minutos).',
});

export const seguridad = [{ [bearerAuth.name]: [] }];

export const ErrorSchema = registro.register(
  'Error',
  z.object({
    error: z.object({
      codigo: z.string().openapi({ example: 'VALIDACION' }),
      mensaje: z.string().openapi({ example: 'Los datos enviados no son válidos' }),
      detalles: z.array(z.string()).openapi({ example: ['correo: Correo no válido'] }),
    }),
  }),
);

export const MetaPaginacionSchema = registro.register(
  'MetaPaginacion',
  z.object({
    total: z.number().int().openapi({ example: 42 }),
    pagina: z.number().int().openapi({ example: 1 }),
    limite: z.number().int().openapi({ example: 10 }),
    totalPaginas: z.number().int().openapi({ example: 5 }),
    siguiente: z.string().nullable().openapi({ example: '/api/v1/plazas?page=2&limit=10' }),
    anterior: z.string().nullable().openapi({ example: null }),
  }),
);

const DESCRIPCIONES_ERROR: Record<number, string> = {
  400: 'Datos de entrada no válidos',
  401: 'No autenticado o token inválido',
  403: 'El rol del usuario no tiene permiso',
  404: 'Recurso no encontrado',
  409: 'Conflicto con el estado actual del recurso',
  422: 'Se incumple una regla de negocio',
  429: 'Demasiadas peticiones',
};

/** Genera las respuestas de error estándar para los códigos indicados. */
export const respuestasError = (...codigos: number[]) =>
  Object.fromEntries(
    codigos.map((codigo) => [
      codigo,
      {
        description: DESCRIPCIONES_ERROR[codigo] ?? 'Error',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    ]),
  );

/** Cuerpo JSON de una respuesta. */
export const json = <T extends z.ZodTypeAny>(schema: T, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});
