import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

interface DatosNotificacion {
  tipo: string;
  titulo: string;
  mensaje: string;
  enlace?: string;
}

/** RF-23: crea una notificación dentro de la aplicación para el usuario indicado. */
export const notificar = (
  usuarioId: string,
  datos: DatosNotificacion,
  cliente: Prisma.TransactionClient = prisma,
) => cliente.notificacion.create({ data: { usuarioId, ...datos } });
