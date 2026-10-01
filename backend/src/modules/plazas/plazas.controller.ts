import type { Request, Response } from 'express';
import { paginar } from '../../lib/paginacion.js';
import type {
  ListarMisPlazasQuery,
  ListarPlazasPublicasQuery,
  ListarPlazasQuery,
} from './plazas.schema.js';
import * as service from './plazas.service.js';

const id = (req: Request) => req.params.id as string;

export const listar = async (req: Request, res: Response) => {
  const query = req.query as unknown as ListarPlazasQuery;
  const { data, total } = await service.listar(query, req.usuario!);
  res.json(paginar(req, data, total, query.page, query.limit));
};

export const opcionesFiltro = async (_req: Request, res: Response) => {
  res.json(await service.opcionesFiltro());
};

export const listarMias = async (req: Request, res: Response) => {
  const query = req.query as unknown as ListarMisPlazasQuery;
  const { data, total } = await service.listarMias(query, req.usuario!);
  res.json(paginar(req, data, total, query.page, query.limit));
};

export const obtener = async (req: Request, res: Response) => {
  res.json({ plaza: await service.obtener(id(req), req.usuario!) });
};

export const crear = async (req: Request, res: Response) => {
  const plaza = await service.crear(req.body, req.usuario!);
  res.status(201).location(`/api/v1/plazas/${plaza.id}`).json({ plaza });
};

export const actualizar = async (req: Request, res: Response) => {
  res.json({ plaza: await service.actualizar(id(req), req.body, req.usuario!) });
};

export const aprobar = async (req: Request, res: Response) => {
  res.json({ plaza: await service.aprobar(id(req), req.usuario!, req.ip) });
};

export const rechazar = async (req: Request, res: Response) => {
  res.json({ plaza: await service.rechazar(id(req), req.body.motivo, req.usuario!, req.ip) });
};

export const listarPublicas = async (req: Request, res: Response) => {
  const query = req.query as unknown as ListarPlazasPublicasQuery;
  const { data, total } = await service.listarPublicas(query);
  res.json(paginar(req, data, total, query.page, query.limit));
};
