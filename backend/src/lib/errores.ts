/**
 * Error de aplicación con código HTTP y código de negocio.
 * El middleware de errores lo convierte en la respuesta uniforme
 * { error: { codigo, mensaje, detalles[] } } (Fase 1, sección 5.3.1).
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    mensaje: string,
    public readonly detalles: string[] = [],
  ) {
    super(mensaje);
    this.name = 'AppError';
  }
}

export const errores = {
  validacion: (detalles: string[]) =>
    new AppError(400, 'VALIDACION', 'Los datos enviados no son válidos', detalles),
  noAutenticado: (mensaje = 'Debes iniciar sesión') => new AppError(401, 'NO_AUTENTICADO', mensaje),
  prohibido: (mensaje = 'No tienes permiso para realizar esta acción') =>
    new AppError(403, 'PROHIBIDO', mensaje),
  noEncontrado: (recurso: string) => new AppError(404, 'NO_ENCONTRADO', `${recurso} no encontrado`),
  conflicto: (mensaje: string, detalles: string[] = []) =>
    new AppError(409, 'CONFLICTO', mensaje, detalles),
  reglaNegocio: (mensaje: string, detalles: string[] = []) =>
    new AppError(422, 'REGLA_NEGOCIO', mensaje, detalles),
  demasiadasPeticiones: (mensaje: string) => new AppError(429, 'DEMASIADAS_PETICIONES', mensaje),
};
