import type { Rol } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      /** Usuario autenticado, disponible después del middleware requireAuth. */
      usuario?: { id: string; rol: Rol };
    }
  }
}

export {};
