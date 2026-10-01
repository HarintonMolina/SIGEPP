import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import {
  actividadesPlan,
  bearer,
  crearAsignacion,
  crearEstudiante,
  crearOrganizacion,
  crearPeriodoActivo,
  crearPlaza,
} from '../../test/fabricas.js';
import { limpiarBaseDatos } from '../../test/helpers.js';

const app = crearApp();

beforeEach(limpiarBaseDatos);
afterAll(() => prisma.$disconnect());

const objetivos = 'Desarrollar el módulo de inventario de la aplicación web de la empresa.';

const preparar = async () => {
  const periodo = await crearPeriodoActivo();
  const { organizacion } = await crearOrganizacion();
  const plaza = await crearPlaza(organizacion.id, periodo.id);
  const { asignacion, estudiante, docente, tutor } = await crearAsignacion(plaza);
  return {
    asignacion,
    estudiante: bearer({ id: estudiante.usuarioId, rol: 'ESTUDIANTE' }),
    docente: bearer({ id: docente.usuarioId, rol: 'TUTOR_ACADEMICO' }),
    empresa: bearer({ id: tutor.usuarioId, rol: 'TUTOR_EMPRESARIAL' }),
    usuarioDocente: docente.usuarioId,
    usuarioTutor: tutor.usuarioId,
  };
};

type Contexto = Awaited<ReturnType<typeof preparar>>;

const crearPlan = (c: Contexto, actividades = actividadesPlan()) =>
  request(app)
    .post(`/api/v1/asignaciones/${c.asignacion.id}/plan`)
    .set('Authorization', c.estudiante)
    .send({ objetivos, actividades });

const enviar = (c: Contexto, planId: string) =>
  request(app).post(`/api/v1/planes-trabajo/${planId}/enviar`).set('Authorization', c.estudiante);

const aprobar = (token: string, planId: string) =>
  request(app).patch(`/api/v1/planes-trabajo/${planId}/aprobar`).set('Authorization', token);

/** Crea el plan y lo deja en revisión. */
const planEnRevision = async (c: Contexto) => {
  const { body } = await crearPlan(c);
  await enviar(c, body.plan.id);
  return body.plan.id as string;
};

describe('Elaboración del plan (RF-14)', () => {
  it('el estudiante crea su plan en borrador y las horas se calculan solas', async () => {
    const c = await preparar();
    const res = await crearPlan(c);

    expect(res.status).toBe(201);
    expect(res.body.plan).toMatchObject({ estado: 'BORRADOR', version: 1, horasPrevistas: 240 });
    expect(res.body.plan.actividades).toHaveLength(3);
  });

  it('no permite un segundo plan para la misma asignación', async () => {
    const c = await preparar();
    await crearPlan(c);
    const res = await crearPlan(c);
    expect(res.status).toBe(409);
  });

  it('un tutor no puede crear el plan y otro estudiante recibe 404', async () => {
    const c = await preparar();
    const comoDocente = await request(app)
      .post(`/api/v1/asignaciones/${c.asignacion.id}/plan`)
      .set('Authorization', c.docente)
      .send({ objetivos, actividades: actividadesPlan() });
    expect(comoDocente.status).toBe(403);

    const { usuario: otro } = await crearEstudiante();
    const comoOtro = await request(app)
      .post(`/api/v1/asignaciones/${c.asignacion.id}/plan`)
      .set('Authorization', bearer(otro))
      .send({ objetivos, actividades: actividadesPlan() });
    expect(comoOtro.status).toBe(404);
  });

  it('valida las actividades', async () => {
    const c = await preparar();
    const res = await crearPlan(c, [{ descripcion: 'X', semanaInicio: 5, semanaFin: 2, horas: 0 }]);
    expect(res.status).toBe(400);
    expect(res.body.error.detalles.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Envío a revisión', () => {
  it('exige alcanzar las horas mínimas del período', async () => {
    const c = await preparar();
    const { body } = await crearPlan(c, actividadesPlan(20));

    const res = await enviar(c, body.plan.id);
    expect(res.status).toBe(422);
    expect(res.body.error.detalles[0]).toContain('mínimo requerido: 240');
  });

  it('guarda la versión enviada, notifica a ambos tutores y bloquea la edición', async () => {
    const c = await preparar();
    const { body } = await crearPlan(c);

    const res = await enviar(c, body.plan.id);
    expect(res.status).toBe(200);
    expect(res.body.plan.estado).toBe('EN_REVISION');
    expect(res.body.plan.versiones).toHaveLength(1);

    const notificados = await prisma.notificacion.findMany({ where: { tipo: 'PLAN_EN_REVISION' } });
    expect(notificados.map((n) => n.usuarioId).sort()).toEqual(
      [c.usuarioDocente, c.usuarioTutor].sort(),
    );

    const edicion = await request(app)
      .put(`/api/v1/planes-trabajo/${body.plan.id}`)
      .set('Authorization', c.estudiante)
      .send({ objetivos, actividades: actividadesPlan() });
    expect(edicion.status).toBe(409);
  });
});

describe('Aprobación del plan (RF-15, RN-07)', () => {
  it('requiere la aprobación de ambos tutores; entonces la asignación pasa a EN_CURSO', async () => {
    const c = await preparar();
    const planId = await planEnRevision(c);

    const primera = await aprobar(c.docente, planId);
    expect(primera.status).toBe(200);
    expect(primera.body.plan.estado).toBe('EN_REVISION');
    expect(primera.body.plan.aprobadoDocenteEn).not.toBeNull();

    const repetida = await aprobar(c.docente, planId);
    expect(repetida.status).toBe(409);

    const segunda = await aprobar(c.empresa, planId);
    expect(segunda.body.plan.estado).toBe('APROBADO');

    const asignacion = await prisma.asignacion.findUniqueOrThrow({
      where: { id: c.asignacion.id },
    });
    expect(asignacion.estado).toBe('EN_CURSO');
    expect(await prisma.notificacion.count({ where: { tipo: 'PLAN_APROBADO' } })).toBe(1);
  });

  it('un plan aprobado ya no se puede editar', async () => {
    const c = await preparar();
    const planId = await planEnRevision(c);
    await aprobar(c.docente, planId);
    await aprobar(c.empresa, planId);

    const res = await request(app)
      .put(`/api/v1/planes-trabajo/${planId}`)
      .set('Authorization', c.estudiante)
      .send({ objetivos, actividades: actividadesPlan() });
    expect(res.status).toBe(409);
  });

  it('el estudiante no puede aprobar su propio plan', async () => {
    const c = await preparar();
    const planId = await planEnRevision(c);
    const res = await aprobar(c.estudiante, planId);
    expect(res.status).toBe(403);
  });

  it('no se puede aprobar un plan en borrador', async () => {
    const c = await preparar();
    const { body } = await crearPlan(c);
    const res = await aprobar(c.docente, body.plan.id);
    expect(res.status).toBe(409);
  });
});

describe('Observaciones y versiones', () => {
  it('la observación reinicia las aprobaciones y el reenvío crea la versión 2', async () => {
    const c = await preparar();
    const planId = await planEnRevision(c);
    await aprobar(c.empresa, planId);

    const observado = await request(app)
      .patch(`/api/v1/planes-trabajo/${planId}/observar`)
      .set('Authorization', c.docente)
      .send({ observacion: 'Falta detallar las horas de la etapa de pruebas.' });
    expect(observado.status).toBe(200);
    expect(observado.body.plan).toMatchObject({ estado: 'OBSERVADO', aprobadoEmpresaEn: null });
    expect(observado.body.plan.versiones[0].observacionDocente).toContain('etapa de pruebas');

    const corregido = await request(app)
      .put(`/api/v1/planes-trabajo/${planId}`)
      .set('Authorization', c.estudiante)
      .send({ objetivos, actividades: actividadesPlan(90) });
    expect(corregido.body.plan.horasPrevistas).toBe(270);

    const reenviado = await enviar(c, planId);
    expect(reenviado.body.plan).toMatchObject({ estado: 'EN_REVISION', version: 2 });
    expect(reenviado.body.plan.versiones.map((v: { version: number }) => v.version)).toEqual([
      2, 1,
    ]);
  });

  it('las partes consultan el plan con su historial', async () => {
    const c = await preparar();
    await planEnRevision(c);

    const res = await request(app)
      .get(`/api/v1/asignaciones/${c.asignacion.id}/plan`)
      .set('Authorization', c.empresa);
    expect(res.status).toBe(200);
    expect(res.body.plan.versiones).toHaveLength(1);
  });
});
