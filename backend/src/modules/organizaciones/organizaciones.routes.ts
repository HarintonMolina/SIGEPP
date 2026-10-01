import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { limiteAutenticacion } from '../../middleware/rate-limit.js';
import { requirePermiso, requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './organizaciones.controller.js';
import {
  actualizarTutorSchema,
  crearTutorSchema,
  idParams,
  listarOrganizacionesQuery,
  registroOrganizacionSchema,
  tutorParams,
  verificarOrganizacionSchema,
} from './organizaciones.schema.js';

export const organizacionesRouter = Router();

// Registro público (RF-05): crea la organización en estado PENDIENTE.
organizacionesRouter.post(
  '/',
  limiteAutenticacion,
  validate({ body: registroOrganizacionSchema }),
  asyncHandler(controller.registrar),
);

organizacionesRouter.use(requireAuth);

organizacionesRouter.get(
  '/',
  requirePermiso('organizaciones:verificar'),
  validate({ query: listarOrganizacionesQuery }),
  asyncHandler(controller.listar),
);
organizacionesRouter.get('/mia', requireRole('ORGANIZACION'), asyncHandler(controller.obtenerMia));
organizacionesRouter.get(
  '/:id',
  requireRole('ORGANIZACION', 'COORDINADOR', 'ADMIN'),
  validate({ params: idParams }),
  asyncHandler(controller.obtener),
);
organizacionesRouter.patch(
  '/:id/verificar',
  requirePermiso('organizaciones:verificar'),
  validate({ params: idParams, body: verificarOrganizacionSchema }),
  asyncHandler(controller.verificar),
);
organizacionesRouter.get(
  '/:id/tutores',
  requireRole('ORGANIZACION', 'COORDINADOR', 'ADMIN'),
  validate({ params: idParams }),
  asyncHandler(controller.listarTutores),
);
organizacionesRouter.post(
  '/:id/tutores',
  requirePermiso('organizaciones:gestionarTutores'),
  validate({ params: idParams, body: crearTutorSchema }),
  asyncHandler(controller.crearTutor),
);
organizacionesRouter.patch(
  '/:id/tutores/:tutorId',
  requirePermiso('organizaciones:gestionarTutores'),
  validate({ params: tutorParams, body: actualizarTutorSchema }),
  asyncHandler(controller.actualizarTutor),
);
