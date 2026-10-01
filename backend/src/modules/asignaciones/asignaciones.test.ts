import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import {
  bearer,
  crearAsignacion,
  crearDocente,
  crearEstudiante,
  crearOrganizacion,
  crearPeriodoActivo,
  crearPlaza,
  crearPostulacion,
  crearTutorEmpresarial,
  crearUsuario,
} from '../../test/fabricas.js';
import { limpiarBaseDatos } from '../../test/helpers.js';

const app = crearApp();

beforeEach(limpiarBaseDatos);
afterAll(() => prisma.$disconnect());

const preparar = async () => {
  const periodo = await crearPeriodoActivo();
  const { organizacion } = await crearOrganizacion();
  const plaza = await crearPlaza(organizacion.id, periodo.id, { cupos: 2 });
  const { estudiante, usuario: usuarioEstudiante } = await crearEstudiante();
  const { docente, usuario: usuarioDocente } = await crearDocente();
  const { tutor, usuario: usuarioTutor } = await crearTutorEmpresarial(organizacion.id);
  const postulacion = await crearPostulacion(estudiante.id, plaza.id, 'PRESELECCIONADA');
  const coordinador = await crearUsuario('COORDINADOR');

  const cuerpo = {
    postulacionId: postulacion.id,
    docenteId: docente.id,
    tutorEmpresarialId: tutor.id,
    fechaInicio: '2026-10-19',
    fechaFin: '2026-12-11',
  };

  return {
    periodo,
    organizacion,
    plaza,
    estudiante,
    usuarioEstudiante,
    docente,
    usuarioDocente,
    tutor,
    usuarioTutor,
    postulacion,
    coordinador,
    cuerpo,
  };
};

const asignar = (coordinador: { id: string; rol: 'COORDINADOR' }, cuerpo: object) =>
  request(app).post('/api/v1/asignaciones').set('Authorization', bearer(coordinador)).send(cuerpo);

describe('POST /api/v1/asignaciones (RF-13)', () => {
  it('confirma la asignación, ocupa cupos, retira otras postulaciones y notifica a las partes', async () => {
    const d = await preparar();
    const otraPlaza = await crearPlaza(d.organizacion.id, d.periodo.id);
    const otraPostulacion = await crearPostulacion(d.estudiante.id, otraPlaza.id, 'POSTULADA');

    const res = await asignar(d.coordinador as never, d.cuerpo);

    expect(res.status).toBe(201);
    expect(res.body.asignacion).toMatchObject({
      estado: 'ASIGNADA',
      estudiante: { id: d.estudiante.id },
      docente: { id: d.docente.id },
      tutorEmpresarial: { id: d.tutor.id },
      planTrabajo: null,
    });
    expect(res.body.asignacion.hitos[2]).toMatchObject({ clave: 'PLAN', estado: 'EN_CURSO' });

    expect(
      (await prisma.plaza.findUniqueOrThrow({ where: { id: d.plaza.id } })).cuposOcupados,
    ).toBe(1);
    expect(
      (await prisma.docente.findUniqueOrThrow({ where: { id: d.docente.id } })).cupoOcupado,
    ).toBe(1);
    expect(
      (await prisma.postulacion.findUniqueOrThrow({ where: { id: d.postulacion.id } })).estado,
    ).toBe('ASIGNADA');
    expect(
      (await prisma.postulacion.findUniqueOrThrow({ where: { id: otraPostulacion.id } })).estado,
    ).toBe('RETIRADA');

    const notificados = await prisma.notificacion.findMany({ select: { usuarioId: true } });
    expect(notificados.map((n) => n.usuarioId).sort()).toEqual(
      [d.usuarioEstudiante.id, d.usuarioDocente.id, d.usuarioTutor.id].sort(),
    );
  });

  it('registra la auditoría con el usuario y la IP de la petición (RNF-13)', async () => {
    const d = await preparar();
    const res = await asignar(d.coordinador as never, d.cuerpo);

    const auditoria = await prisma.auditoria.findFirstOrThrow({
      where: { entidad: 'Asignacion', entidadId: res.body.asignacion.id },
    });
    expect(auditoria).toMatchObject({ accion: 'CREAR', usuarioId: d.coordinador.id });
    expect(auditoria.ip).toBeTruthy();
  });

  it('exige que la postulación esté preseleccionada por la empresa', async () => {
    const d = await preparar();
    await prisma.postulacion.update({
      where: { id: d.postulacion.id },
      data: { estado: 'POSTULADA' },
    });

    const res = await asignar(d.coordinador as never, d.cuerpo);
    expect(res.status).toBe(422);
  });

  it('RN-02: rechaza si el estudiante ya tiene una asignación activa en el período', async () => {
    const d = await preparar();
    await asignar(d.coordinador as never, d.cuerpo);

    const otraPlaza = await crearPlaza(d.organizacion.id, d.periodo.id);
    const segunda = await crearPostulacion(d.estudiante.id, otraPlaza.id, 'PRESELECCIONADA');
    const res = await asignar(d.coordinador as never, { ...d.cuerpo, postulacionId: segunda.id });

    expect(res.status).toBe(409);
    expect(res.body.error.detalles[0]).toContain('RN-02');
  });

  it('RN-05: rechaza un tutor empresarial de otra organización o dado de baja', async () => {
    const d = await preparar();
    const { organizacion: otra } = await crearOrganizacion();
    const { tutor: ajeno } = await crearTutorEmpresarial(otra.id);

    const deOtraOrg = await asignar(d.coordinador as never, {
      ...d.cuerpo,
      tutorEmpresarialId: ajeno.id,
    });
    expect(deOtraOrg.status).toBe(422);
    expect(deOtraOrg.body.error.detalles[0]).toContain('RN-05');

    await prisma.tutorEmpresarial.update({ where: { id: d.tutor.id }, data: { activo: false } });
    const inactivo = await asignar(d.coordinador as never, d.cuerpo);
    expect(inactivo.status).toBe(422);
  });

  it('RN-06: rechaza si el docente alcanzó su máximo y no deja cambios a medias', async () => {
    const d = await preparar();
    await prisma.docente.update({
      where: { id: d.docente.id },
      data: { cupoMaximo: 1, cupoOcupado: 1 },
    });

    const res = await asignar(d.coordinador as never, d.cuerpo);

    expect(res.status).toBe(422);
    expect(res.body.error.detalles[0]).toContain('RN-06');
    // La transacción se revierte: la plaza no pierde el cupo.
    expect(
      (await prisma.plaza.findUniqueOrThrow({ where: { id: d.plaza.id } })).cuposOcupados,
    ).toBe(0);
    expect(await prisma.asignacion.count()).toBe(0);
  });

  it('rechaza si la plaza no tiene cupos disponibles', async () => {
    const d = await preparar();
    await prisma.plaza.update({ where: { id: d.plaza.id }, data: { cuposOcupados: 2 } });

    const res = await asignar(d.coordinador as never, d.cuerpo);
    expect(res.status).toBe(409);
  });

  it('valida que las fechas estén dentro del período y en orden', async () => {
    const d = await preparar();

    const fuera = await asignar(d.coordinador as never, { ...d.cuerpo, fechaFin: '2027-03-01' });
    expect(fuera.status).toBe(422);

    const invertidas = await asignar(d.coordinador as never, {
      ...d.cuerpo,
      fechaInicio: '2026-12-01',
      fechaFin: '2026-11-01',
    });
    expect(invertidas.status).toBe(400);
  });

  it('solo la coordinación puede asignar', async () => {
    const d = await preparar();
    const res = await request(app)
      .post('/api/v1/asignaciones')
      .set('Authorization', bearer(d.usuarioEstudiante))
      .send(d.cuerpo);
    expect(res.status).toBe(403);
  });
});

describe('Expediente y listados', () => {
  it('cada parte ve el expediente con su rol; un tercero recibe 404', async () => {
    const periodo = await crearPeriodoActivo();
    const { organizacion, representante } = await crearOrganizacion();
    const plaza = await crearPlaza(organizacion.id, periodo.id);
    const { asignacion, estudiante, docente } = await crearAsignacion(plaza);
    const { usuario: otroEstudiante } = await crearEstudiante();

    const comoEstudiante = await request(app)
      .get(`/api/v1/asignaciones/${asignacion.id}`)
      .set('Authorization', bearer({ id: estudiante.usuarioId, rol: 'ESTUDIANTE' }));
    expect(comoEstudiante.status).toBe(200);
    expect(comoEstudiante.body.asignacion.miRol).toBe('ESTUDIANTE');
    expect(comoEstudiante.body.asignacion.hitos).toHaveLength(6);
    expect(comoEstudiante.body.asignacion.progreso).toMatchObject({
      horasAcumuladas: 0,
      horasMinimas: 240,
    });

    const comoDocente = await request(app)
      .get(`/api/v1/asignaciones/${asignacion.id}`)
      .set('Authorization', bearer({ id: docente.usuarioId, rol: 'TUTOR_ACADEMICO' }));
    expect(comoDocente.body.asignacion.miRol).toBe('TUTOR_ACADEMICO');

    const comoTercero = await request(app)
      .get(`/api/v1/asignaciones/${asignacion.id}`)
      .set('Authorization', bearer(otroEstudiante));
    expect(comoTercero.status).toBe(404);

    const comoOrganizacion = await request(app)
      .get(`/api/v1/asignaciones/${asignacion.id}`)
      .set('Authorization', bearer(representante));
    expect(comoOrganizacion.status).toBe(403);
  });

  it('GET /actual devuelve la asignación activa del estudiante', async () => {
    const periodo = await crearPeriodoActivo();
    const { organizacion } = await crearOrganizacion();
    const plaza = await crearPlaza(organizacion.id, periodo.id);
    const { asignacion, estudiante } = await crearAsignacion(plaza);

    const res = await request(app)
      .get('/api/v1/asignaciones/actual')
      .set('Authorization', bearer({ id: estudiante.usuarioId, rol: 'ESTUDIANTE' }));
    expect(res.body.asignacion.id).toBe(asignacion.id);

    const { usuario: sinAsignacion } = await crearEstudiante();
    const vacio = await request(app)
      .get('/api/v1/asignaciones/actual')
      .set('Authorization', bearer(sinAsignacion));
    expect(vacio.status).toBe(404);
  });

  it('el docente solo lista a sus tutorados; la coordinación ve todos', async () => {
    const periodo = await crearPeriodoActivo();
    const { organizacion } = await crearOrganizacion();
    const plaza = await crearPlaza(organizacion.id, periodo.id, { cupos: 5 });
    const { docente } = await crearAsignacion(plaza);
    await crearAsignacion(plaza);
    const coordinador = await crearUsuario('COORDINADOR');

    const delDocente = await request(app)
      .get('/api/v1/asignaciones')
      .set('Authorization', bearer({ id: docente.usuarioId, rol: 'TUTOR_ACADEMICO' }));
    expect(delDocente.body.meta.total).toBe(1);

    const todas = await request(app)
      .get('/api/v1/asignaciones')
      .set('Authorization', bearer(coordinador));
    expect(todas.body.meta.total).toBe(2);
  });

  it('lista candidatos preseleccionados y docentes con su cupo', async () => {
    const d = await preparar();

    const candidatos = await request(app)
      .get('/api/v1/asignaciones/candidatos')
      .set('Authorization', bearer(d.coordinador));
    expect(candidatos.body.candidatos).toHaveLength(1);
    expect(candidatos.body.candidatos[0]).toMatchObject({
      id: d.postulacion.id,
      plaza: { cuposDisponibles: 2 },
      tutoresEmpresariales: [{ id: d.tutor.id }],
    });

    const docentes = await request(app)
      .get('/api/v1/asignaciones/docentes')
      .set('Authorization', bearer(d.coordinador));
    expect(docentes.body.docentes[0]).toMatchObject({ id: d.docente.id, cupoDisponible: 8 });
  });
});
