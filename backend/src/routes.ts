import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes.js';

/** Enrutador de la versión 1 de la API, montado en /api/v1. */
export const apiV1 = Router();

apiV1.use('/auth', authRouter);
