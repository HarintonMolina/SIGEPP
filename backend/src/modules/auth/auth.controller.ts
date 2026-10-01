import type { CookieOptions, Request, Response } from 'express';
import { esProduccion } from '../../config/env.js';
import * as authService from './auth.service.js';

export const COOKIE_REFRESH = 'sigepp_rt';

/** Cookie HttpOnly + SameSite=Strict: inaccesible desde JavaScript y protegida contra CSRF. */
const opcionesCookie = (expira?: Date): CookieOptions => ({
  httpOnly: true,
  secure: esProduccion,
  sameSite: 'strict',
  path: '/api/v1/auth',
  ...(expira && { expires: expira }),
});

const responderSesion = (res: Response, sesion: authService.Sesion, status = 200) => {
  res.cookie(COOKIE_REFRESH, sesion.refreshToken, opcionesCookie(sesion.refreshExpiraEn));
  res.status(status).json({ accessToken: sesion.accessToken, usuario: sesion.usuario });
};

export const registro = async (req: Request, res: Response) => {
  const usuario = await authService.registrar(req.body);
  res.status(201).json({ usuario });
};

export const login = async (req: Request, res: Response) => {
  const sesion = await authService.iniciarSesion(req.body, req.ip);
  responderSesion(res, sesion);
};

export const refresh = async (req: Request, res: Response) => {
  const sesion = await authService.refrescarSesion(req.cookies?.[COOKIE_REFRESH]);
  responderSesion(res, sesion);
};

export const logout = async (req: Request, res: Response) => {
  await authService.cerrarSesion(req.cookies?.[COOKIE_REFRESH]);
  res.clearCookie(COOKIE_REFRESH, opcionesCookie());
  res.status(204).end();
};

export const yo = async (req: Request, res: Response) => {
  const usuario = await authService.obtenerPerfil(req.usuario!.id);
  res.json({ usuario });
};
