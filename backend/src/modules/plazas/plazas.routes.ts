import cors from 'cors';
import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { limitePublico } from '../../middleware/rate-limit.js';
import { requirePermiso, requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './plazas.controller.js';
import {
  actualizarPlazaSchema,
  crearPlazaSchema,
  idParams,
  listarMisPlazasQuery,
  listarPlazasPublicasQuery,
  listarPlazasQuery,
  rechazarPlazaSchema,
} from './plazas.schema.js';

export const plazasRouter = Router();

plazasRouter.use(requireAuth);

plazasRouter.get('/', validate({ query: listarPlazasQuery }), asyncHandler(controller.listar));
plazasRouter.get('/filtros', asyncHandler(controller.opcionesFiltro));
plazasRouter.get(
  '/mias',
  requireRole('ORGANIZACION'),
  validate({ query: listarMisPlazasQuery }),
  asyncHandler(controller.listarMias),
);
plazasRouter.get('/:id', validate({ params: idParams }), asyncHandler(controller.obtener));
plazasRouter.post(
  '/',
  requirePermiso('plazas:crear'),
  validate({ body: crearPlazaSchema }),
  asyncHandler(controller.crear),
);
plazasRouter.put(
  '/:id',
  requirePermiso('plazas:crear'),
  validate({ params: idParams, body: actualizarPlazaSchema }),
  asyncHandler(controller.actualizar),
);
plazasRouter.patch(
  '/:id/aprobar',
  requirePermiso('plazas:aprobar'),
  validate({ params: idParams }),
  asyncHandler(controller.aprobar),
);
plazasRouter.patch(
  '/:id/rechazar',
  requirePermiso('plazas:aprobar'),
  validate({ params: idParams, body: rechazarPlazaSchema }),
  asyncHandler(controller.rechazar),
);

/**
 * RF-26: API pública de plazas vigentes para sistemas externos (ACT-07).
 * Sin autenticación, con CORS abierto solo para lectura y su propio límite de peticiones.
 */
export const publicoRouter = Router();

publicoRouter.use(cors({ origin: '*', methods: ['GET'] }), limitePublico);
publicoRouter.get(
  '/plazas',
  validate({ query: listarPlazasPublicasQuery }),
  asyncHandler(controller.listarPublicas),
);
