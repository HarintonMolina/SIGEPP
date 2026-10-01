import type { Prisma } from '@prisma/client';
import { saltar } from '../../lib/paginacion.js';
import { prisma } from '../../lib/prisma.js';
import type { ListarAuditoriaQuery } from './auditoria.schema.js';

const UN_DIA_MS = 24 * 60 * 60 * 1000;

/** Consulta de la bitácora de auditoría (RNF-13), del registro más reciente al más antiguo. */
export const listar = async (filtros: ListarAuditoriaQuery) => {
  const where: Prisma.AuditoriaWhereInput = {
    ...(filtros.entidad && { entidad: filtros.entidad }),
    ...(filtros.entidadId && { entidadId: filtros.entidadId }),
    ...(filtros.usuarioId && { usuarioId: filtros.usuarioId }),
    ...(filtros.accion && { accion: filtros.accion }),
    ...((filtros.desde || filtros.hasta) && {
      creadaEn: {
        ...(filtros.desde && { gte: filtros.desde }),
        // "hasta" incluye el día completo
        ...(filtros.hasta && { lt: new Date(filtros.hasta.getTime() + UN_DIA_MS) }),
      },
    }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.auditoria.findMany({
      where,
      include: { usuario: { select: { id: true, nombres: true, apellidos: true, rol: true } } },
      orderBy: { creadaEn: 'desc' },
      skip: saltar(filtros.page, filtros.limit),
      take: filtros.limit,
    }),
    prisma.auditoria.count({ where }),
  ]);
  return { data, total };
};
