import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import { limpiarBaseDatos } from '../../test/helpers.js';
import { MAX_INTENTOS_FALLIDOS } from './auth.service.js';

const app = crearApp();

const estudiante = {
  rol: 'ESTUDIANTE',
  nombres: 'Ana Lucía',
  apellidos: 'Pérez Gómez',
  correo: 'ana.perez@std.uni.edu.ni',
  contrasena: 'Segura2026',
  carnet: '2022-0001U',
  carrera: 'Ingeniería en Sistemas',
  anio: 5,
};

const registrar = (datos: Record<string, unknown> = estudiante) =>
  request(app).post('/api/v1/auth/registro').send(datos);

const login = (correo = estudiante.correo, contrasena = estudiante.contrasena) =>
  request(app).post('/api/v1/auth/login').send({ correo, contrasena });

const cookieRefresh = (res: request.Response) =>
  ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('sigepp_rt='));

beforeEach(limpiarBaseDatos);
afterAll(() => prisma.$disconnect());

describe('POST /api/v1/auth/registro (RF-01)', () => {
  it('registra un estudiante con correo institucional', async () => {
    const res = await registrar();

    expect(res.status).toBe(201);
    expect(res.body.usuario).toMatchObject({ correo: estudiante.correo, rol: 'ESTUDIANTE' });
    expect(res.body.usuario.estudiante.carnet).toBe('2022-0001U');
    expect(res.body.usuario).not.toHaveProperty('hashContrasena');
  });

  it('guarda la contraseña con bcrypt de costo 12 (RNF-05)', async () => {
    await registrar();
    const usuario = await prisma.usuario.findUniqueOrThrow({
      where: { correo: estudiante.correo },
    });
    expect(usuario.hashContrasena).toMatch(/^\$2[aby]\$12\$/);
  });

  it('rechaza un correo fuera del dominio institucional', async () => {
    const res = await registrar({ ...estudiante, correo: 'ana@gmail.com' });

    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe('VALIDACION');
  });

  it('rechaza un correo ya registrado con 409', async () => {
    await registrar();
    const res = await registrar({ ...estudiante, carnet: '2022-0002U' });
    expect(res.status).toBe(409);
  });

  it('rechaza un carnet duplicado con 409', async () => {
    await registrar();
    const res = await registrar({ ...estudiante, correo: 'otra@std.uni.edu.ni' });
    expect(res.status).toBe(409);
  });

  it('devuelve los errores de validación en formato uniforme', async () => {
    const res = await registrar({ rol: 'ESTUDIANTE', correo: 'no-es-correo', contrasena: '123' });

    expect(res.status).toBe(400);
    expect(res.body.error.detalles).toEqual(
      expect.arrayContaining([
        expect.stringContaining('correo'),
        expect.stringContaining('contrasena'),
      ]),
    );
  });

  it('no permite registrarse como coordinador', async () => {
    const res = await registrar({ ...estudiante, rol: 'COORDINADOR' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/auth/login (RF-02)', () => {
  beforeEach(async () => {
    await registrar();
  });

  it('devuelve el token de acceso y la cookie de refresco HttpOnly', async () => {
    const res = await login();

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.usuario.rol).toBe('ESTUDIANTE');
    const cookie = cookieRefresh(res);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
  });

  it('rechaza credenciales incorrectas con 401', async () => {
    const res = await login(estudiante.correo, 'Incorrecta1');
    expect(res.status).toBe(401);
  });

  it('no revela si el correo existe', async () => {
    const res = await login('nadie@uni.edu.ni', 'Incorrecta1');
    expect(res.status).toBe(401);
    expect(res.body.error.mensaje).toBe('Correo o contraseña incorrectos');
  });

  it(`bloquea la cuenta tras ${MAX_INTENTOS_FALLIDOS} intentos fallidos (RNF-08)`, async () => {
    for (let i = 0; i < MAX_INTENTOS_FALLIDOS; i++) {
      await login(estudiante.correo, 'Incorrecta1');
    }

    const res = await login();
    expect(res.status).toBe(429);
    expect(res.body.error.codigo).toBe('CUENTA_BLOQUEADA');

    const auditoria = await prisma.auditoria.findFirst({
      where: { accion: 'BLOQUEO_POR_INTENTOS' },
    });
    expect(auditoria).not.toBeNull();
  });
});

describe('Sesión: /yo, /refresh y /logout', () => {
  beforeEach(async () => {
    await registrar();
  });

  it('GET /yo exige token', async () => {
    const res = await request(app).get('/api/v1/auth/yo');
    expect(res.status).toBe(401);
  });

  it('GET /yo devuelve el usuario autenticado', async () => {
    const { body } = await login();
    const res = await request(app)
      .get('/api/v1/auth/yo')
      .set('Authorization', `Bearer ${body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.usuario.correo).toBe(estudiante.correo);
  });

  it('GET /yo rechaza un token manipulado', async () => {
    const { body } = await login();
    const res = await request(app)
      .get('/api/v1/auth/yo')
      .set('Authorization', `Bearer ${body.accessToken}x`);
    expect(res.status).toBe(401);
  });

  it('POST /refresh rota el token y rechaza la reutilización del anterior', async () => {
    const cookie = cookieRefresh(await login())!;

    const primero = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(primero.status).toBe(200);
    expect(primero.body.accessToken).toEqual(expect.any(String));

    const reutilizado = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(reutilizado.status).toBe(401);

    // Al detectar la reutilización se revocan todas las sesiones, incluida la nueva.
    const nuevaCookie = cookieRefresh(primero)!;
    const conNueva = await request(app).post('/api/v1/auth/refresh').set('Cookie', nuevaCookie);
    expect(conNueva.status).toBe(401);
  });

  it('POST /logout revoca la sesión', async () => {
    const cookie = cookieRefresh(await login())!;

    const salida = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    expect(salida.status).toBe(204);

    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(401);
  });
});

describe('Infraestructura', () => {
  it('GET /api/health verifica la conexión con la base de datos', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ estado: 'ok', baseDatos: 'ok' });
  });

  it('responde 404 uniforme en rutas inexistentes', async () => {
    const res = await request(app).get('/api/v1/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.error.codigo).toBe('NO_ENCONTRADO');
  });

  it('responde 400 ante un JSON mal formado', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"correo":');
    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe('JSON_INVALIDO');
  });

  it('envía encabezados de seguridad (Helmet)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
