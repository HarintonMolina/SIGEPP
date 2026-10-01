import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermiso } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { idParams, observarPlanSchema, planSchema } from './planes-trabajo.schema.js';
import * as service from './planes-trabajo.service.js';

const id = (params: Record<string, string>) => params.id as string;

/** Montado en /asignaciones/:id/plan. */
export const planAsignacionRouter = Router({ mergeParams: true });

planAsignacionRouter.use(requireAuth);

planAsignacionRouter.get(
  '/',
  requirePermiso('asignaciones:ver'),
  asyncHandler(async (req, res) => {
    res.json({ plan: await service.obtenerPorAsignacion(id(req.params), req.usuario!) });
  }),
);

planAsignacionRouter.post(
  '/',
  requirePermiso('planes:editar'),
  validate({ body: planSchema }),
  asyncHandler(async (req, res) => {
    const plan = await service.crear(id(req.params), req.body, req.usuario!);
    res.status(201).json({ plan });
  }),
);

/** Operaciones sobre un plan existente: /planes-trabajo/:id */
export const planesTrabajoRouter = Router();

planesTrabajoRouter.use(requireAuth);

planesTrabajoRouter.put(
  '/:id',
  requirePermiso('planes:editar'),
  validate({ params: idParams, body: planSchema }),
  asyncHandler(async (req, res) => {
    res.json({ plan: await service.actualizar(id(req.params), req.body, req.usuario!) });
  }),
);

planesTrabajoRouter.post(
  '/:id/enviar',
  requirePermiso('planes:editar'),
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    res.json({ plan: await service.enviar(id(req.params), req.usuario!) });
  }),
);

planesTrabajoRouter.patch(
  '/:id/aprobar',
  requirePermiso('planes:aprobar'),
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    res.json({ plan: await service.aprobar(id(req.params), req.usuario!) });
  }),
);

planesTrabajoRouter.patch(
  '/:id/observar',
  requirePermiso('planes:aprobar'),
  validate({ params: idParams, body: observarPlanSchema }),
  asyncHandler(async (req, res) => {
    res.json({
      plan: await service.observar(id(req.params), req.body.observacion, req.usuario!),
    });
  }),
);
