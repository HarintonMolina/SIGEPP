import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { paginar } from '../../lib/paginacion.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermiso, requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  crearAsignacionSchema,
  idParams,
  type ListarAsignacionesQuery,
  listarAsignacionesQuery,
} from './asignaciones.schema.js';
import * as service from './asignaciones.service.js';

export const asignacionesRouter = Router();

asignacionesRouter.use(requireAuth);

asignacionesRouter.get(
  '/',
  requirePermiso('asignaciones:ver'),
  validate({ query: listarAsignacionesQuery }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as ListarAsignacionesQuery;
    const { data, total } = await service.listar(query, req.usuario!);
    res.json(paginar(req, data, total, query.page, query.limit));
  }),
);

asignacionesRouter.get(
  '/candidatos',
  requirePermiso('asignaciones:crear'),
  asyncHandler(async (_req, res) => {
    res.json({ candidatos: await service.listarCandidatos() });
  }),
);

asignacionesRouter.get(
  '/docentes',
  requirePermiso('asignaciones:crear'),
  asyncHandler(async (_req, res) => {
    res.json({ docentes: await service.listarDocentes() });
  }),
);

asignacionesRouter.get(
  '/actual',
  requireRole('ESTUDIANTE'),
  asyncHandler(async (req, res) => {
    res.json({ asignacion: await service.obtenerActual(req.usuario!) });
  }),
);

asignacionesRouter.get(
  '/:id',
  requirePermiso('asignaciones:ver'),
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    res.json({ asignacion: await service.obtener(req.params.id as string, req.usuario!) });
  }),
);

asignacionesRouter.post(
  '/',
  requirePermiso('asignaciones:crear'),
  validate({ body: crearAsignacionSchema }),
  asyncHandler(async (req, res) => {
    const asignacion = await service.crear(req.body, req.usuario!);
    res.status(201).location(`/api/v1/asignaciones/${asignacion.id}`).json({ asignacion });
  }),
);
