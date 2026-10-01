import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import {
  bearer,
  CONTRASENA_PRUEBA,
  crearAsignacion,
  crearOrganizacion,
  crearPeriodoActivo,
  crearPlaza,
  crearTutorEmpresarial,
  crearUsuario,
} from '../../test/fabricas.js';
import { limpiarBaseDatos } from '../../test/helpers.js';

const app = crearApp();

const registroValido = {
  razonSocial: 'Soluciones Digitales del Pacífico, S.A.',
  ruc: 'j0310000000001',
  sector: 'Tecnología',
  direccion: 'Managua, Carretera a Masaya km 5',
  representante: {
    nombres: 'Gabriela',
    apellidos: 'Torres Aguilar',
    correo: 'rrhh@solucionesdigitales.example',
    contrasena: 'Segura2026',
  },
};

beforeEach(limpiarBaseDatos);
afterAll(() => prisma.$disconnect());

describe('POST /api/v1/organizaciones (RF-05)', () => {
  it('registra la organización como PENDIENTE junto con su representante', async () => {
    const res = await request(app).post('/api/v1/organizaciones').send(registroValido);

    expect(res.status).toBe(201);
    expect(res.body.organizacion).toMatchObject({
      ruc: 'J0310000000001',
      estadoVerificacion: 'PENDIENTE',
      convenioVigenteHasta: null,
    });
    const representante = await prisma.usuario.findUniqueOrThrow({
      where: { correo: registroValido.representante.correo },
    });
    expect(representante.rol).toBe('ORGANIZACION');
  });

  it('permite al representante iniciar sesión', async () => {
    await request(app).post('/api/v1/organizaciones').send(registroValido);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ correo: registroValido.representante.correo, contrasena: 'Segura2026' });

    expect(res.status).toBe(200);
    expect(res.body.usuario.organizacion.estadoVerificacion).toBe('PENDIENTE');
  });

  it('rechaza un RUC duplicado con 409', async () => {
    await request(app).post('/api/v1/organizaciones').send(registroValido);
    const res = await request(app)
      .post('/api/v1/organizaciones')
      .send({
        ...registroValido,
        representante: { ...registroValido.representante, correo: 'otro@x.example' },
      });

    expect(res.status).toBe(409);
  });

  it('valida el formato del RUC', async () => {
    const res = await request(app)
      .post('/api/v1/organizaciones')
      .send({ ...registroValido, ruc: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error.detalles[0]).toContain('ruc');
  });
});

describe('Verificación de organizaciones (RF-06)', () => {
  it('lista solo para coordinación y administración, con filtro por estado', async () => {
    await crearOrganizacion({ verificada: false });
    await crearOrganizacion({ verificada: true });
    const coordinador = await crearUsuario('COORDINADOR');
    const estudiante = await crearUsuario('ESTUDIANTE');

    const res = await request(app)
      .get('/api/v1/organizaciones?estado=PENDIENTE')
      .set('Authorization', bearer(coordinador));
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0].estadoVerificacion).toBe('PENDIENTE');

    const prohibido = await request(app)
      .get('/api/v1/organizaciones')
      .set('Authorization', bearer(estudiante));
    expect(prohibido.status).toBe(403);
  });

  it('verifica con vigencia de convenio, audita y notifica al representante', async () => {
    const { organizacion, representante } = await crearOrganizacion({ verificada: false });
    const coordinador = await crearUsuario('COORDINADOR');

    const res = await request(app)
      .patch(`/api/v1/organizaciones/${organizacion.id}/verificar`)
      .set('Authorization', bearer(coordinador))
      .send({ estado: 'VERIFICADA', convenioVigenteHasta: '2027-12-31' });

    expect(res.status).toBe(200);
    expect(res.body.organizacion.estadoVerificacion).toBe('VERIFICADA');
    expect(res.body.organizacion.convenioVigenteHasta).toMatch(/^2027-12-31/);

    const auditoria = await prisma.auditoria.findFirst({ where: { entidadId: organizacion.id } });
    expect(auditoria).toMatchObject({ accion: 'VERIFICAR', usuarioId: coordinador.id });
    const notificacion = await prisma.notificacion.findFirst({
      where: { usuarioId: representante.id },
    });
    expect(notificacion?.tipo).toBe('ORGANIZACION_VERIFICADA');
  });

  it('exige una fecha de convenio futura para verificar', async () => {
    const { organizacion } = await crearOrganizacion({ verificada: false });
    const coordinador = await crearUsuario('COORDINADOR');

    const sinFecha = await request(app)
      .patch(`/api/v1/organizaciones/${organizacion.id}/verificar`)
      .set('Authorization', bearer(coordinador))
      .send({ estado: 'VERIFICADA' });
    expect(sinFecha.status).toBe(400);

    const vencida = await request(app)
      .patch(`/api/v1/organizaciones/${organizacion.id}/verificar`)
      .set('Authorization', bearer(coordinador))
      .send({ estado: 'VERIFICADA', convenioVigenteHasta: '2020-01-01' });
    expect(vencida.status).toBe(400);
  });

  it('impide que una organización se verifique a sí misma', async () => {
    const { organizacion, representante } = await crearOrganizacion({ verificada: false });

    const res = await request(app)
      .patch(`/api/v1/organizaciones/${organizacion.id}/verificar`)
      .set('Authorization', bearer(representante))
      .send({ estado: 'VERIFICADA', convenioVigenteHasta: '2027-12-31' });
    expect(res.status).toBe(403);
  });
});

describe('Acceso al detalle de una organización', () => {
  it('el representante ve su organización con sus tutores', async () => {
    const { organizacion, representante } = await crearOrganizacion();
    await crearTutorEmpresarial(organizacion.id);

    const res = await request(app)
      .get('/api/v1/organizaciones/mia')
      .set('Authorization', bearer(representante));

    expect(res.status).toBe(200);
    expect(res.body.organizacion.id).toBe(organizacion.id);
    expect(res.body.organizacion.tutoresEmpresariales).toHaveLength(1);
  });

  it('responde 404 al representante de otra organización (IDOR)', async () => {
    const { organizacion } = await crearOrganizacion();
    const { representante: ajeno } = await crearOrganizacion();

    const res = await request(app)
      .get(`/api/v1/organizaciones/${organizacion.id}`)
      .set('Authorization', bearer(ajeno));
    expect(res.status).toBe(404);
  });
});

describe('Tutores empresariales (RF-07)', () => {
  it('la organización da de alta a un tutor que puede iniciar sesión', async () => {
    const { organizacion, representante } = await crearOrganizacion();

    const res = await request(app)
      .post(`/api/v1/organizaciones/${organizacion.id}/tutores`)
      .set('Authorization', bearer(representante))
      .send({
        nombres: 'Pedro José',
        apellidos: 'López Cruz',
        correo: 'pedro@empresa.example',
        contrasena: 'Segura2026',
        cargo: 'Líder de desarrollo',
      });

    expect(res.status).toBe(201);
    expect(res.body.tutor).toMatchObject({ cargo: 'Líder de desarrollo', activo: true });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ correo: 'pedro@empresa.example', contrasena: 'Segura2026' });
    expect(login.body.usuario.rol).toBe('TUTOR_EMPRESARIAL');
  });

  it('no permite dar de alta tutores en otra organización', async () => {
    const { organizacion } = await crearOrganizacion();
    const { representante: ajeno } = await crearOrganizacion();

    const res = await request(app)
      .post(`/api/v1/organizaciones/${organizacion.id}/tutores`)
      .set('Authorization', bearer(ajeno))
      .send({
        nombres: 'Ana',
        apellidos: 'Ruiz',
        correo: 'ana@x.example',
        contrasena: 'Segura2026',
        cargo: 'Jefa',
      });
    expect(res.status).toBe(404);
  });

  it('la baja desactiva la cuenta del tutor', async () => {
    const { organizacion, representante } = await crearOrganizacion();
    const { tutor, usuario } = await crearTutorEmpresarial(organizacion.id);

    const res = await request(app)
      .patch(`/api/v1/organizaciones/${organizacion.id}/tutores/${tutor.id}`)
      .set('Authorization', bearer(representante))
      .send({ activo: false });

    expect(res.status).toBe(200);
    expect(res.body.tutor.activo).toBe(false);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ correo: usuario.correo, contrasena: CONTRASENA_PRUEBA });
    expect(login.status).toBe(403);
  });

  it('no permite dar de baja a un tutor con asignaciones activas', async () => {
    const periodo = await crearPeriodoActivo();
    const { organizacion, representante } = await crearOrganizacion();
    const plaza = await crearPlaza(organizacion.id, periodo.id);
    const { tutor } = await crearAsignacion(plaza);

    const res = await request(app)
      .patch(`/api/v1/organizaciones/${organizacion.id}/tutores/${tutor.id}`)
      .set('Authorization', bearer(representante))
      .send({ activo: false });
    expect(res.status).toBe(409);
  });
});
