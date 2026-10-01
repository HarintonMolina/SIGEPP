import type { Prisma } from '@prisma/client';
import { contextoActual } from './contexto.js';
import { prisma } from './prisma.js';

interface EventoAuditoria {
  usuarioId?: string | null;
  entidad: string;
  entidadId: string;
  accion: string;
  valoresAnteriores?: Prisma.InputJsonValue;
  valoresNuevos?: Prisma.InputJsonValue;
  ip?: string | null;
}

/**
 * RNF-13: registra una operación sobre una entidad crítica en la bitácora de auditoría
 * (usuario, IP, marca de tiempo y valores anterior y posterior). Si no se indican el
 * usuario o la IP, se toman del contexto de la petición en curso.
 */
export const registrarAuditoria = (
  evento: EventoAuditoria,
  cliente: Prisma.TransactionClient = prisma,
) => {
  const contexto = contextoActual();
  return cliente.auditoria.create({
    data: {
      ...evento,
      usuarioId: evento.usuarioId ?? contexto.usuarioId ?? null,
      ip: evento.ip ?? contexto.ip ?? null,
    },
  });
};
