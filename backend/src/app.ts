import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env, esProduccion } from './config/env.js';
import { docsRouter } from './docs/openapi.js';
import { asyncHandler } from './lib/async-handler.js';
import { prisma } from './lib/prisma.js';
import { manejadorErrores, rutaNoEncontrada } from './middleware/error.js';
import { limiteGeneral } from './middleware/rate-limit.js';
import { publicoRouter } from './modules/plazas/plazas.routes.js';
import { apiV1 } from './routes.js';

export const crearApp = () => {
  const app = express();

  app.disable('x-powered-by');
  // Detrás del proxy de la plataforma de despliegue, para obtener la IP real del cliente.
  if (esProduccion) app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        // En localhost no hay HTTPS: forzar la actualización a https rompería Swagger UI.
        directives: { upgradeInsecureRequests: esProduccion ? [] : null },
      },
    }),
  );

  // Documentación y API pública: abiertas a cualquier origen, con su propio límite de peticiones.
  app.use('/api/docs', docsRouter);
  app.use('/api/v1/publico', publicoRouter);

  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use('/api', limiteGeneral);

  app.get(
    '/api/health',
    asyncHandler(async (_req, res) => {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ estado: 'ok', baseDatos: 'ok', hora: new Date().toISOString() });
    }),
  );

  app.use('/api/v1', apiV1);

  app.use(rutaNoEncontrada);
  app.use(manejadorErrores);

  return app;
};
