import { describe, expect, it, vi } from 'vitest';
import type { FrontendEnv } from '../config/env';
import { deferred } from '../test/deferred';
import { ApiError } from './errors';
import { createTransport } from './transport';

const config: FrontendEnv = {
  apiUrl: 'http://localhost:4000/api/v1',
  institutionalDomains: ['uni.edu.ni', 'std.uni.edu.ni'],
};

describe('transporte HTTP', () => {
  it('envía JSON, encabezados y cancelación al API configurado sin token automático', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ recibido: true }));
    const signal = new AbortController().signal;
    const transport = createTransport(config, fetchMock);

    expect(await transport.request('/auth/login', {
      method: 'POST', json: { correo: 'ana@uni.edu.ni', contrasena: ' clave1 ' },
      headers: { 'X-Consulta': 'prueba' }, credentials: 'include', signal,
    })).toEqual({ recibido: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:4000/api/v1/auth/login');
    expect(init).toMatchObject({
      method: 'POST', credentials: 'include', signal,
      body: '{"correo":"ana@uni.edu.ni","contrasena":" clave1 "}',
    });
    const headers = new Headers(init?.headers);
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('accept')).toBe('application/json');
    expect(headers.get('x-consulta')).toBe('prueba');
    expect(headers.has('authorization')).toBe(false);
  });

  it('GET sin JSON conserva query y un Bearer explícito del consumidor', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: true }));
    await createTransport(config, fetchMock).request('/auth/yo?detalle=1', {
      headers: { Authorization: 'Bearer token-explícito' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:4000/api/v1/auth/yo?detalle=1');
    expect(init?.method).toBe('GET');
    expect(init?.body).toBeUndefined();
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer token-explícito');
    expect(new Headers(init?.headers).has('content-type')).toBe(false);
  });

  it('204 no parsea JSON', async () => {
    const response = new Response(null, { status: 204 });
    const parseJson = vi.spyOn(response, 'json');
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
    expect(await createTransport(config, fetchMock).request('/auth/logout')).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(parseJson).not.toHaveBeenCalled();
  });

  it('error uniforme conserva detalles', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      error: { codigo: 'VALIDACION', mensaje: 'Datos no válidos', detalles: ['correo: Correo no válido'] },
    }, { status: 400 }));
    const error = await createTransport(config, fetchMock).request('/auth/registro').catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      kind: 'http', status: 400, codigo: 'VALIDACION',
      message: 'Datos no válidos', detalles: ['correo: Correo no válido'],
    });
  });

  it.each([
    { status: 502, body: '<html>Error de pasarela</html>' },
    { status: 200, body: '{' },
    { status: 401, body: '{"error":{"codigo":"DENEGADO"}}' },
    { status: 400, body: '{"error":{"codigo":"VALIDACION","mensaje":"Inválido","detalles":[1]}}' },
  ])('HTML o JSON incompleto conserva status $status', async ({ status, body }) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { status }));
    const error = await createTransport(config, fetchMock).request('/auth/login').catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'invalid-response', status });
    expect((error as Error).message).toMatch(/respuesta.*(válid|ilegible)/i);
    expect((error as ApiError).detalles).toEqual([]);
  });

  it('fallo de red tiene una categoría y un mensaje local', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));
    const error = await createTransport(config, fetchMock).request('/auth/login').catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'network', status: null, detalles: [] });
    expect((error as Error).message).toMatch(/conectar.*servidor/i);
  });

  it('cancelación durante fetch conserva AbortError sin convertirlo en red', async () => {
    const aborted = new DOMException('Cancelado', 'AbortError');
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(aborted);
    await expect(createTransport(config, fetchMock).request('/auth/yo')).rejects.toBe(aborted);
    expect(aborted.name).toBe('AbortError');
  });

  it('cancelación leyendo el cuerpo conserva AbortError', async () => {
    const aborted = new DOMException('Cancelado', 'AbortError');
    const response = Response.json({ ok: true });
    vi.spyOn(response, 'json').mockRejectedValue(aborted);
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
    await expect(createTransport(config, fetchMock).request('/auth/yo')).rejects.toBe(aborted);
  });

  it.each([
    'https://otro.example/auth/login', '//otro.example/auth/login',
    '/../fuera', '/%2e%2e/fuera', '/auth/../../fuera',
    '/auth\\..\\fuera', '/%2f%2fotro.example/auth', '/auth/login#fragmento',
  ])('rechaza paths fuera del API antes de enviar: %s', async (path) => {
    const fetchMock = vi.fn<typeof fetch>();
    await expect(createTransport(config, fetchMock).request(path)).rejects.toThrow(/ruta/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rechaza JSON circular antes de enviar sin clasificarlo como fallo de red', async () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    const fetchMock = vi.fn<typeof fetch>();
    await expect(createTransport(config, fetchMock).request('/auth/login', { json: circular })).rejects.toBeInstanceOf(TypeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rechaza un valor que JSON.stringify no puede representar', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    await expect(createTransport(config, fetchMock).request('/auth/login', { json: () => undefined })).rejects.toBeInstanceOf(TypeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('mantiene independientes las respuestas concurrentes sin sleeps', async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    const fetchMock = vi.fn<typeof fetch>().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const transport = createTransport(config, fetchMock);
    const firstRequest = transport.request('/primera');
    const secondRequest = transport.request('/segunda');
    second.resolve(Response.json({ resultado: 'segunda' }));
    expect(await secondRequest).toEqual({ resultado: 'segunda' });
    first.resolve(Response.json({ resultado: 'primera' }));
    expect(await firstRequest).toEqual({ resultado: 'primera' });
  });
});
