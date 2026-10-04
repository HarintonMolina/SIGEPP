export type ApiErrorKind = 'http' | 'network' | 'invalid-response' | 'stale-session';

export interface ApiErrorOptions {
  kind: ApiErrorKind;
  status?: number;
  codigo: string;
  mensaje: string;
  detalles?: string[];
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly codigo: string;
  readonly detalles: string[];

  constructor(options: ApiErrorOptions) {
    super(options.mensaje);
    this.name = 'ApiError';
    this.kind = options.kind;
    this.status = options.status ?? null;
    this.codigo = options.codigo;
    this.detalles = options.detalles ?? [];
  }
}
