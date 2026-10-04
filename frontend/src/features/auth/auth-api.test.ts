import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/errors';
import { createTransport } from '../../api/transport';
import { makeSesionResponse, makeUsuario } from '../../test/fixtures';
import { createAuthApi } from './auth-api';
import type { RegistroInput } from './contracts';

const config = { apiUrl: 'http://localhost:4000/api/v1', institutionalDomains: ['uni.edu.ni'] };
const loginInput = { correo: 'supervisor@empresa.example', contrasena: ' clave1 ' };
const registroInput: RegistroInput = {
  rol: 'ESTUDIANTE', nombres: 'Ana', apellidos: 'Pérez', correo: 'ana@std.uni.edu.ni',
  contrasena: ' Clave123 ', carnet: '2022-0802U', carrera: 'Sistemas', anio: 5,
};

describe('API auth sin interceptor', () => {
  it('registro devuelve usuario sin iniciar sesión ni alterar el payload', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ usuario: makeUsuario() }, { status: 201 }));
    const api = createAuthApi(createTransport(config, fetchMock));
    const usuario = await api.registro(registroInput);
    expect(usuario).toMatchObject({ id: 'usuario-prueba-1', rol: 'ESTUDIANTE', correo: 'ana@std.uni.edu.ni' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/api/v1/auth/registro');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      rol: 'ESTUDIANTE', nombres: 'Ana', apellidos: 'Pérez', correo: 'ana@std.uni.edu.ni',
      contrasena: ' Clave123 ', carnet: '2022-0802U', carrera: 'Sistemas', anio: 5,
    });
  });

  it('login admite correo empresarial, conserva contraseña y devuelve sesión', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json(makeSesionResponse('TUTOR_EMPRESARIAL')));
    const sesion = await createAuthApi(createTransport(config, fetchMock)).login(loginInput);
    expect(sesion).toMatchObject({ accessToken: 'token-ficticio-prueba', usuario: { rol: 'TUTOR_EMPRESARIAL' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/api/v1/auth/login');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST', credentials: 'include',
      body: '{"correo":"supervisor@empresa.example","contrasena":" clave1 "}',
    });
  });

  it('refresh emite una petición con cookie y sin cuerpo ni Bearer', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json(makeSesionResponse('ADMIN', 'token-renovado-prueba')));
    const sesion = await createAuthApi(createTransport(config, fetchMock)).refresh();
    expect(sesion).toMatchObject({ accessToken: 'token-renovado-prueba', usuario: { rol: 'ADMIN' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/api/v1/auth/refresh');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(fetchMock.mock.calls[0][1]?.body).toBeUndefined();
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).has('authorization')).toBe(false);
  });

  it('logout 204 no parsea JSON', async () => {
    const response = new Response(null, { status: 204 });
    const parseJson = vi.spyOn(response, 'json');
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
    const api = createAuthApi(createTransport(config, fetchMock));
    expect(await api.logout()).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/api/v1/auth/logout');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(parseJson).not.toHaveBeenCalled();
  });

  it.each(['registro', 'login', 'refresh', 'logout'] as const)('auth no renueva ni reintenta tras 401 en %s', async (operation) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      error: { codigo: 'NO_AUTORIZADO', mensaje: 'Credenciales incorrectas', detalles: [] },
    }, { status: 401 }));
    const api = createAuthApi(createTransport(config, fetchMock));
    const request = operation === 'registro' ? api.registro(registroInput)
      : operation === 'login' ? api.login(loginInput) : api[operation]();
    await expect(request).rejects.toMatchObject({ kind: 'http', status: 401, codigo: 'NO_AUTORIZADO' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`http://localhost:4000/api/v1/auth/${operation}`);
    expect(fetchMock.mock.calls[0][1]?.credentials).toBe('include');
  });

  it.each(['registro', 'login', 'refresh', 'logout'] as const)('rechaza schema de respuesta inválido en %s', async (operation) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ usuario: { rol: 'INVITADO' } }));
    const api = createAuthApi(createTransport(config, fetchMock));
    const request = operation === 'registro' ? api.registro(registroInput)
      : operation === 'login' ? api.login(loginInput) : api[operation]();
    const error = await request.catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'invalid-response', status: null, detalles: [] });
    expect((error as Error).message).toMatch(/respuesta.*válida/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
