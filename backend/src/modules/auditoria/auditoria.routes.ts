import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { paginar } from '../../lib/paginacion.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermiso } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { type ListarAuditoriaQuery, listarAuditoriaQuery } from './auditoria.schema.js';
import * as service from './auditoria.service.js';

export const auditoriaRouter = Router();

auditoriaRouter.get(
  '/',
  requireAuth,
  requirePermiso('auditoria:ver'),
  validate({ query: listarAuditoriaQuery }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as ListarAuditoriaQuery;
    const { data, total } = await service.listar(query);
    res.json(paginar(req, data, total, query.page, query.limit));
  }),
);
