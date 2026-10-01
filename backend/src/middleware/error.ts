import { Prisma } from '@prisma/client';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errores.js';

export const rutaNoEncontrada: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      codigo: 'NO_ENCONTRADO',
      mensaje: `Ruta ${req.method} ${req.path} no existe`,
      detalles: [],
    },
  });
};

export const formatearErroresZod = (error: ZodError) =>
  error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message));

const convertirError = (err: unknown): AppError => {
  if (err instanceof AppError) return err;

  if (err instanceof ZodError) {
    return new AppError(
      400,
      'VALIDACION',
      'Los datos enviados no son válidos',
      formatearErroresZod(err),
    );
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const campos = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'registro';
      return new AppError(
        409,
        'CONFLICTO',
        `Ya existe un registro con el mismo valor en: ${campos}`,
      );
    }
    if (err.code === 'P2025') {
      return new AppError(404, 'NO_ENCONTRADO', 'Registro no encontrado');
    }
  }

  const tipo = (err as { type?: string } | null)?.type;
  if (tipo === 'entity.parse.failed') {
    return new AppError(400, 'JSON_INVALIDO', 'El cuerpo de la petición no es un JSON válido');
  }
  if (tipo === 'entity.too.large') {
    return new AppError(
      413,
      'CARGA_DEMASIADO_GRANDE',
      'El cuerpo de la petición es demasiado grande',
    );
  }

  // Nunca se envían detalles internos al cliente (RNF-07); solo se registran en el servidor.
  console.error(err);
  return new AppError(500, 'ERROR_INTERNO', 'Ocurrió un error inesperado');
};

export const manejadorErrores: ErrorRequestHandler = (err, _req, res, _next) => {
  const error = convertirError(err);
  res.status(error.status).json({
    error: { codigo: error.codigo, mensaje: error.message, detalles: error.detalles },
  });
};
