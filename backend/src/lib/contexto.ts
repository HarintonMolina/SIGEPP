import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestHandler } from 'express';

interface ContextoPeticion {
  ip?: string;
  usuarioId?: string;
}

const almacen = new AsyncLocalStorage<ContextoPeticion>();

/** Datos de la petición en curso (IP y usuario), accesibles desde cualquier capa sin pasarlos como parámetro. */
export const contextoActual = (): ContextoPeticion => almacen.getStore() ?? {};

/** Abre un contexto por petición; requireAuth le agrega el usuario autenticado. */
export const middlewareContexto: RequestHandler = (req, _res, next) => {
  almacen.run({ ip: req.ip }, next);
};

export const asignarUsuarioAlContexto = (usuarioId: string) => {
  const contexto = almacen.getStore();
  if (contexto) contexto.usuarioId = usuarioId;
};
