import type { Transport } from '../../api/transport';
import { z } from 'zod';
import { ApiError } from '../../api/errors';
import { sesionResponseSchema, usuarioResponseSchema } from './contracts';
import type { LoginInput, RegistroInput, SesionResponse, Usuario } from './contracts';

export type AuthApi = {
  registro(input: RegistroInput): Promise<Usuario>;
  login(input: LoginInput): Promise<SesionResponse>;
  refresh(): Promise<SesionResponse>;
  logout(): Promise<void>;
};

function parseResponse<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'invalid-response', codigo: 'RESPUESTA_INVALIDA',
      mensaje: 'El servidor devolvió una respuesta de autenticación no válida.',
    });
  }
  return parsed.data;
}

export function createAuthApi(transport: Transport): AuthApi {
  return {
    async registro(input) {
      const response = await transport.request<unknown>('/auth/registro', {
        method: 'POST', credentials: 'include', json: input,
      });
      return parseResponse(usuarioResponseSchema, response).usuario;
    },
    async login(input) {
      const response = await transport.request<unknown>('/auth/login', {
        method: 'POST', credentials: 'include', json: input,
      });
      return parseResponse(sesionResponseSchema, response);
    },
    async refresh() {
      const response = await transport.request<unknown>('/auth/refresh', {
        method: 'POST', credentials: 'include',
      });
      return parseResponse(sesionResponseSchema, response);
    },
    async logout() {
      const response = await transport.request<unknown>('/auth/logout', {
        method: 'POST', credentials: 'include',
      });
      parseResponse(z.undefined(), response);
    },
  };
}
