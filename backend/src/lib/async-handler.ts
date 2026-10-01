import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Express 4 no captura los errores de funciones async; este envoltorio los pasa a next(). */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
