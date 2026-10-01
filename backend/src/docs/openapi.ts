import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { registro } from './registro.js';

// Cada módulo registra sus rutas al importarse.
import '../modules/auth/auth.docs.js';
import '../modules/organizaciones/organizaciones.docs.js';
import '../modules/plazas/plazas.docs.js';
import '../modules/asignaciones/asignaciones.docs.js';
import '../modules/planes-trabajo/planes-trabajo.docs.js';
import '../modules/auditoria/auditoria.docs.js';

const DESCRIPCION = `
API REST del **Sistema de Gestión del Ejercicio y Prácticas Profesionales (SIGEPP)**.

- Todas las rutas cuelgan de \`/api/v1\` y usan JSON en UTF-8; las fechas van en ISO 8601.
- Autenticación con \`Authorization: Bearer <token>\` (botón **Authorize**). El token se obtiene en \`POST /auth/login\`.
- Los listados se paginan con \`page\` y \`limit\` y devuelven un objeto \`meta\` con enlaces a la página siguiente y anterior.
- Los errores siguen el formato \`{ error: { codigo, mensaje, detalles[] } }\`.
`.trim();

let documento: ReturnType<OpenApiGeneratorV31['generateDocument']> | undefined;

/** Especificación OpenAPI 3.1 generada a partir de los esquemas Zod de validación. */
export const generarDocumentoOpenApi = () => {
  documento ??= new OpenApiGeneratorV31(registro.definitions).generateDocument({
    openapi: '3.1.0',
    info: { title: 'SIGEPP API', version: '1.0.0', description: DESCRIPCION },
    servers: [{ url: '/api/v1', description: 'Servidor actual' }],
    tags: [
      { name: 'Autenticación', description: 'Registro, inicio de sesión y manejo de la sesión' },
      {
        name: 'Organizaciones',
        description: 'Organizaciones receptoras y sus tutores empresariales',
      },
      { name: 'Plazas', description: 'Bolsa de plazas de prácticas y su aprobación académica' },
      { name: 'Asignaciones', description: 'Asignación de estudiantes y expediente de prácticas' },
      { name: 'Plan de trabajo', description: 'Elaboración, versiones y aprobación del plan' },
      { name: 'API pública', description: 'Consulta abierta para sistemas externos (RF-26)' },
      { name: 'Auditoría', description: 'Bitácora inmutable de operaciones críticas' },
    ],
  });
  return documento;
};

export const docsRouter = Router();

docsRouter.get('/openapi.json', (_req, res) => {
  res.json(generarDocumentoOpenApi());
});
docsRouter.use(
  '/',
  swaggerUi.serve,
  swaggerUi.setup(undefined, {
    customSiteTitle: 'SIGEPP API — Documentación',
    swaggerOptions: { url: '/api/docs/openapi.json', persistAuthorization: true },
  }),
);
