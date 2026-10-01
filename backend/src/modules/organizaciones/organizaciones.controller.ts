import type { Request, Response } from 'express';
import { paginar } from '../../lib/paginacion.js';
import type { ListarOrganizacionesQuery } from './organizaciones.schema.js';
import * as service from './organizaciones.service.js';

const parametro = (req: Request, nombre: string) => req.params[nombre] as string;

export const registrar = async (req: Request, res: Response) => {
  const organizacion = await service.registrar(req.body);
  res.status(201).json({ organizacion });
};

export const listar = async (req: Request, res: Response) => {
  const query = req.query as unknown as ListarOrganizacionesQuery;
  const { data, total } = await service.listar(query);
  res.json(paginar(req, data, total, query.page, query.limit));
};

export const obtenerMia = async (req: Request, res: Response) => {
  res.json({ organizacion: await service.obtenerMia(req.usuario!) });
};

export const obtener = async (req: Request, res: Response) => {
  res.json({ organizacion: await service.obtener(parametro(req, 'id'), req.usuario!) });
};

export const verificar = async (req: Request, res: Response) => {
  const organizacion = await service.verificar(
    parametro(req, 'id'),
    req.body,
    req.usuario!,
    req.ip,
  );
  res.json({ organizacion });
};

export const listarTutores = async (req: Request, res: Response) => {
  res.json({ tutores: await service.listarTutores(parametro(req, 'id'), req.usuario!) });
};

export const crearTutor = async (req: Request, res: Response) => {
  const tutor = await service.crearTutor(parametro(req, 'id'), req.body, req.usuario!);
  res.status(201).json({ tutor });
};

export const actualizarTutor = async (req: Request, res: Response) => {
  const tutor = await service.actualizarTutor(
    parametro(req, 'id'),
    parametro(req, 'tutorId'),
    req.body,
    req.usuario!,
    req.ip,
  );
  res.json({ tutor });
};
