import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes.js';
import { organizacionesRouter } from './modules/organizaciones/organizaciones.routes.js';
import { plazasRouter } from './modules/plazas/plazas.routes.js';

/** Enrutador de la versión 1 de la API, montado en /api/v1. */
export const apiV1 = Router();

apiV1.use('/auth', authRouter);
apiV1.use('/organizaciones', organizacionesRouter);
apiV1.use('/plazas', plazasRouter);
