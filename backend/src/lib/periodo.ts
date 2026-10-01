import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

/** Período académico vigente, o null si la administración no ha activado ninguno. */
export const obtenerPeriodoActivo = (cliente: Prisma.TransactionClient = prisma) =>
  cliente.periodo.findFirst({ where: { activo: true }, orderBy: { fechaInicio: 'desc' } });
