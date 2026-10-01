import { json, registro, respuestasError, seguridad } from '../../docs/registro.js';
import { z } from '../../lib/zod.js';
import { loginSchema, registroSchema, usuarioPublicoSchema } from './auth.schema.js';

const tag = 'Autenticación';

const sesionSchema = z
  .object({
    accessToken: z.string().openapi({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }),
    usuario: usuarioPublicoSchema,
  })
  .openapi('Sesion');

const cookieRefresco = {
  'Set-Cookie': {
    description: 'Cookie HttpOnly `sigepp_rt` con el token de refresco (7 días, SameSite=Strict).',
    schema: { type: 'string' as const },
  },
};

registro.registerPath({
  method: 'post',
  path: '/auth/registro',
  tags: [tag],
  summary: 'Registrar estudiante o docente (RF-01)',
  description:
    'Registro abierto para estudiantes y tutores académicos. El correo debe pertenecer al dominio institucional.',
  request: { body: { content: { 'application/json': { schema: registroSchema } } } },
  responses: {
    201: json(z.object({ usuario: usuarioPublicoSchema }), 'Usuario creado'),
    ...respuestasError(400, 409, 429),
  },
});

registro.registerPath({
  method: 'post',
  path: '/auth/login',
  tags: [tag],
  summary: 'Iniciar sesión (RF-02)',
  description:
    'Devuelve el token de acceso (15 min) y fija la cookie de refresco. Tras 5 intentos fallidos la cuenta se bloquea temporalmente (RNF-08).',
  request: { body: { content: { 'application/json': { schema: loginSchema } } } },
  responses: {
    200: { ...json(sesionSchema, 'Sesión iniciada'), headers: cookieRefresco },
    ...respuestasError(400, 401, 403, 429),
  },
});

registro.registerPath({
  method: 'post',
  path: '/auth/refresh',
  tags: [tag],
  summary: 'Renovar el token de acceso',
  description:
    'Usa la cookie `sigepp_rt`. El token de refresco se rota en cada uso; reutilizar uno anterior cierra todas las sesiones.',
  responses: {
    200: { ...json(sesionSchema, 'Sesión renovada'), headers: cookieRefresco },
    ...respuestasError(401, 403),
  },
});

registro.registerPath({
  method: 'post',
  path: '/auth/logout',
  tags: [tag],
  summary: 'Cerrar sesión',
  responses: { 204: { description: 'Sesión cerrada' } },
});

registro.registerPath({
  method: 'get',
  path: '/auth/yo',
  tags: [tag],
  summary: 'Usuario autenticado',
  security: seguridad,
  responses: {
    200: json(z.object({ usuario: usuarioPublicoSchema }), 'Usuario de la sesión'),
    ...respuestasError(401),
  },
});
