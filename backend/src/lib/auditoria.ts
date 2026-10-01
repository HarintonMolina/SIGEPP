import type { Prisma } from '@prisma/client';
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

/** RNF-13: registra una operación sobre una entidad crítica en la bitácora de auditoría. */
export const registrarAuditoria = (
  evento: EventoAuditoria,
  cliente: Prisma.TransactionClient = prisma,
) => cliente.auditoria.create({ data: evento });
