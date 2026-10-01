import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { limiteAutenticacion } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './auth.controller.js';
import { loginSchema, registroSchema } from './auth.schema.js';

export const authRouter = Router();

authRouter.post(
  '/registro',
  limiteAutenticacion,
  validate({ body: registroSchema }),
  asyncHandler(controller.registro),
);
authRouter.post(
  '/login',
  limiteAutenticacion,
  validate({ body: loginSchema }),
  asyncHandler(controller.login),
);
authRouter.post('/refresh', asyncHandler(controller.refresh));
authRouter.post('/logout', asyncHandler(controller.logout));
authRouter.get('/yo', requireAuth, asyncHandler(controller.yo));
