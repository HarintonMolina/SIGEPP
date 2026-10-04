import type { FrontendEnv } from '../config/env';
import { z } from 'zod';
import { ApiError } from './errors';

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  json?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
};

export type Transport = {
  request<T>(path: string, options?: RequestOptions): Promise<T>;
};

const errorResponseSchema = z.object({
  error: z.object({ codigo: z.string(), mensaje: z.string(), detalles: z.array(z.string()) }),
});

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}

function invalidResponse(status: number): ApiError {
  return new ApiError({
    kind: 'invalid-response', status, codigo: 'RESPUESTA_INVALIDA',
    mensaje: 'El servidor devolvió una respuesta no válida.',
  });
}

function apiPath(baseUrl: string, path: string): string {
  const invalidPath = () => new TypeError('La ruta debe ser relativa al API configurado.');
  if (!path.startsWith('/') || path.startsWith('//') || /[\\#\s]/.test(path)) {
    throw invalidPath();
  }

  const pathname = path.split('?')[0];
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    throw invalidPath();
  }
  if (/%2f|%5c/i.test(pathname) || decodedPath.includes('\\')
    || decodedPath.split('/').some((segment) => segment === '.' || segment === '..')) {
    throw invalidPath();
  }

  const base = new URL(baseUrl);
  const url = new URL(`${baseUrl}${path}`);
  if (url.origin !== base.origin || !url.pathname.startsWith(`${base.pathname.replace(/\/+$/, '')}/`)) {
    throw invalidPath();
  }
  return url.href;
}

export function createTransport(config: FrontendEnv, fetchImpl: typeof fetch = fetch): Transport {
  const baseUrl = config.apiUrl.replace(/\/+$/, '');

  return {
    async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
      const url = apiPath(baseUrl, path);
      const headers = new Headers(options.headers);
      if (!headers.has('Accept')) headers.set('Accept', 'application/json');

      let body: string | undefined;
      if (options.json !== undefined) {
        body = JSON.stringify(options.json);
        if (body === undefined) throw new TypeError('El cuerpo debe ser JSON serializable.');
        headers.set('Content-Type', 'application/json');
      }

      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: options.method ?? 'GET', headers, body,
          signal: options.signal, credentials: options.credentials,
        });
      } catch (error) {
        if (isAbortError(error)) throw error;
        throw new ApiError({
          kind: 'network', codigo: 'ERROR_RED',
          mensaje: 'No se pudo conectar con el servidor. Inténtalo de nuevo.',
        });
      }

      if (response.status === 204) return undefined as T;

      let data: unknown;
      try {
        data = await response.json();
      } catch (error) {
        if (isAbortError(error)) throw error;
        throw invalidResponse(response.status);
      }

      if (!response.ok) {
        const parsed = errorResponseSchema.safeParse(data);
        if (!parsed.success) throw invalidResponse(response.status);
        throw new ApiError({ kind: 'http', status: response.status, ...parsed.data.error });
      }

      return data as T;
    },
  };
}
