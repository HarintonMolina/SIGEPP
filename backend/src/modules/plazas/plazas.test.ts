import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import {
  bearer,
  crearOrganizacion,
  crearPeriodoActivo,
  crearPlaza,
  crearTutorEmpresarial,
  crearUsuario,
  datosPlaza,
} from '../../test/fabricas.js';
import { limpiarBaseDatos } from '../../test/helpers.js';

const app = crearApp();

beforeEach(limpiarBaseDatos);
afterAll(() => prisma.$disconnect());

describe('POST /api/v1/plazas (RF-08, RN-12)', () => {
  it('una organización verificada publica una plaza que queda EN_REVISION', async () => {
    const periodo = await crearPeriodoActivo();
    const { organizacion, representante } = await crearOrganizacion();

    const res = await request(app)
      .post('/api/v1/plazas')
      .set('Authorization', bearer(representante))
      .send(datosPlaza());

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/v1/plazas/${res.body.plaza.id}`);
    expect(res.body.plaza).toMatchObject({
      estado: 'EN_REVISION',
      cuposDisponibles: 2,
      organizacion: { id: organizacion.id },
      periodo: { id: periodo.id },
    });
  });

  it('rechaza con 422 si la organización no está verificada (RN-12)', async () => {
    await crearPeriodoActivo();
    const { representante } = await crearOrganizacion({ verificada: false });

    const res = await request(app)
      .post('/api/v1/plazas')
      .set('Authorization', bearer(representante))
      .send(datosPlaza());

    expect(res.status).toBe(422);
    expect(res.body.error.detalles[0]).toContain('RN-12');
  });

  it('rechaza con 422 si el convenio está vencido (RN-12)', async () => {
    await crearPeriodoActivo();
    const { representante } = await crearOrganizacion({
      convenioVigenteHasta: new Date('2025-01-01'),
    });

    const res = await request(app)
      .post('/api/v1/plazas')
      .set('Authorization', bearer(representante))
      .send(datosPlaza());
    expect(res.status).toBe(422);
  });

  it('rechaza con 422 si no hay período activo', async () => {
    const { representante } = await crearOrganizacion();
    const res = await request(app)
      .post('/api/v1/plazas')
      .set('Authorization', bearer(representante))
      .send(datosPlaza());
    expect(res.status).toBe(422);
  });

  it('un estudiante no puede publicar plazas', async () => {
    const estudiante = await crearUsuario('ESTUDIANTE');
    const res = await request(app)
      .post('/api/v1/plazas')
      .set('Authorization', bearer(estudiante))
      .send(datosPlaza());
    expect(res.status).toBe(403);
  });

  it('valida los datos de la plaza', async () => {
    const { representante } = await crearOrganizacion();
    const res = await request(app)
      .post('/api/v1/plazas')
      .set('Authorization', bearer(representante))
      .send(datosPlaza({ cupos: 0, competencias: [], modalidad: 'NOCTURNA' }));

    expect(res.status).toBe(400);
    expect(res.body.error.detalles).toHaveLength(3);
  });
});

describe('Visibilidad de las plazas (RN-04)', () => {
  it('el estudiante solo ve plazas aprobadas en el listado', async () => {
    const periodo = await crearPeriodoActivo();
    const { organizacion } = await crearOrganizacion();
    await crearPlaza(organizacion.id, periodo.id, { titulo: 'Plaza aprobada' });
    await crearPlaza(organizacion.id, periodo.id, {
      titulo: 'Plaza en revisión',
      estado: 'EN_REVISION',
    });
    const estudiante = await crearUsuario('ESTUDIANTE');

    const res = await request(app)
      .get('/api/v1/plazas?estado=EN_REVISION')
      .set('Authorization', bearer(estudiante));

    expect(res.status).toBe(200);
    expect(res.body.data.map((p: { titulo: string }) => p.titulo)).toEqual(['Plaza aprobada']);
  });

  it('el coordinador puede filtrar las plazas en revisión', async () => {
    const periodo = await crearPeriodoActivo();
    const { organizacion } = await crearOrganizacion();
    await crearPlaza(organizacion.id, periodo.id);
    await crearPlaza(organizacion.id, periodo.id, { estado: 'EN_REVISION' });
    const coordinador = await crearUsuario('COORDINADOR');

    const res = await request(app)
      .get('/api/v1/plazas?estado=EN_REVISION')
      .set('Authorization', bearer(coordinador));

    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0].estado).toBe('EN_REVISION');
  });

  it('el detalle de una plaza en revisión responde 404 al estudiante y 200 a su organización', async () => {
    const periodo = await crearPeriodoActivo();
    const { organizacion, representante } = await crearOrganizacion();
    const { usuario: tutor } = await crearTutorEmpresarial(organizacion.id);
    const plaza = await crearPlaza(organizacion.id, periodo.id, { estado: 'EN_REVISION' });
    const estudiante = await crearUsuario('ESTUDIANTE');

    const comoEstudiante = await request(app)
      .get(`/api/v1/plazas/${plaza.id}`)
      .set('Authorization', bearer(estudiante));
    expect(comoEstudiante.status).toBe(404);

    const comoOrganizacion = await request(app)
      .get(`/api/v1/plazas/${plaza.id}`)
      .set('Authorization', bearer(representante));
    expect(comoOrganizacion.status).toBe(200);

    const comoTutor = await request(app)
      .get(`/api/v1/plazas/${plaza.id}`)
      .set('Authorization', bearer(tutor));
    expect(comoTutor.status).toBe(200);
  });

  it('exige autenticación', async () => {
    const res = await request(app).get('/api/v1/plazas');
    expect(res.status).toBe(401);
  });
});

describe('Aprobación de plazas (RF-09)', () => {
  const preparar = async () => {
    const periodo = await crearPeriodoActivo();
    const { organizacion, representante } = await crearOrganizacion();
    const plaza = await crearPlaza(organizacion.id, periodo.id, {
      estado: 'EN_REVISION',
      publicadaEn: null,
    });
    const coordinador = await crearUsuario('COORDINADOR');
    return { plaza, representante, coordinador };
  };

  it('el coordinador aprueba: la plaza se publica, se audita y se notifica', async () => {
    const { plaza, representante, coordinador } = await preparar();

    const res = await request(app)
      .patch(`/api/v1/plazas/${plaza.id}/aprobar`)
      .set('Authorization', bearer(coordinador));

    expect(res.status).toBe(200);
    expect(res.body.plaza.estado).toBe('APROBADA');
    expect(res.body.plaza.publicadaEn).not.toBeNull();
    expect(res.body.plaza.aprobadaPor.id).toBe(coordinador.id);

    expect(
      await prisma.auditoria.count({ where: { entidadId: plaza.id, accion: 'APROBAR' } }),
    ).toBe(1);
    expect(
      await prisma.notificacion.count({
        where: { usuarioId: representante.id, tipo: 'PLAZA_APROBADA' },
      }),
    ).toBe(1);

    const estudiante = await crearUsuario('ESTUDIANTE');
    const listado = await request(app)
      .get('/api/v1/plazas')
      .set('Authorization', bearer(estudiante));
    expect(listado.body.meta.total).toBe(1);
  });

  it('no se puede aprobar dos veces', async () => {
    const { plaza, coordinador } = await preparar();
    await request(app)
      .patch(`/api/v1/plazas/${plaza.id}/aprobar`)
      .set('Authorization', bearer(coordinador));

    const res = await request(app)
      .patch(`/api/v1/plazas/${plaza.id}/aprobar`)
      .set('Authorization', bearer(coordinador));
    expect(res.status).toBe(409);
  });

  it('la organización no puede aprobar sus propias plazas', async () => {
    const { plaza, representante } = await preparar();
    const res = await request(app)
      .patch(`/api/v1/plazas/${plaza.id}/aprobar`)
      .set('Authorization', bearer(representante));
    expect(res.status).toBe(403);
  });

  it('el rechazo exige motivo; la organización corrige y la plaza vuelve a revisión', async () => {
    const { plaza, representante, coordinador } = await preparar();

    const sinMotivo = await request(app)
      .patch(`/api/v1/plazas/${plaza.id}/rechazar`)
      .set('Authorization', bearer(coordinador))
      .send({});
    expect(sinMotivo.status).toBe(400);

    const rechazo = await request(app)
      .patch(`/api/v1/plazas/${plaza.id}/rechazar`)
      .set('Authorization', bearer(coordinador))
      .send({ motivo: 'Las actividades no corresponden a la carrera.' });
    expect(rechazo.body.plaza).toMatchObject({
      estado: 'RECHAZADA',
      motivoRechazo: expect.any(String),
    });

    const correccion = await request(app)
      .put(`/api/v1/plazas/${plaza.id}`)
      .set('Authorization', bearer(representante))
      .send(datosPlaza({ titulo: 'Desarrollador de Software Jr.' }));
    expect(correccion.status).toBe(200);
    expect(correccion.body.plaza).toMatchObject({
      estado: 'EN_REVISION',
      motivoRechazo: null,
      titulo: 'Desarrollador de Software Jr.',
    });
  });

  it('no se puede editar una plaza aprobada', async () => {
    const periodo = await crearPeriodoActivo();
    const { organizacion, representante } = await crearOrganizacion();
    const plaza = await crearPlaza(organizacion.id, periodo.id);

    const res = await request(app)
      .put(`/api/v1/plazas/${plaza.id}`)
      .set('Authorization', bearer(representante))
      .send(datosPlaza());
    expect(res.status).toBe(409);
  });
});

describe('Búsqueda, filtros y paginación (RF-10)', () => {
  const preparar = async () => {
    const periodo = await crearPeriodoActivo();
    const { organizacion } = await crearOrganizacion();
    await crearPlaza(organizacion.id, periodo.id, {
      titulo: 'Desarrollador Web',
      modalidad: 'REMOTA',
    });
    await crearPlaza(organizacion.id, periodo.id, {
      titulo: 'Analista de Datos',
      area: 'Datos',
      modalidad: 'PRESENCIAL',
      ubicacion: 'León',
    });
    await crearPlaza(organizacion.id, periodo.id, {
      titulo: 'Soporte Técnico',
      modalidad: 'PRESENCIAL',
    });
    return { estudiante: await crearUsuario('ESTUDIANTE') };
  };

  it('busca por texto sin distinguir mayúsculas', async () => {
    const { estudiante } = await preparar();
    const res = await request(app)
      .get('/api/v1/plazas?q=DATOS')
      .set('Authorization', bearer(estudiante));
    expect(res.body.data.map((p: { titulo: string }) => p.titulo)).toEqual(['Analista de Datos']);
  });

  it('filtra por modalidad y ubicación', async () => {
    const { estudiante } = await preparar();
    const res = await request(app)
      .get('/api/v1/plazas?modalidad=PRESENCIAL&ubicacion=managua')
      .set('Authorization', bearer(estudiante));
    expect(res.body.data.map((p: { titulo: string }) => p.titulo)).toEqual(['Soporte Técnico']);
  });

  it('pagina y devuelve enlaces a la página siguiente y anterior', async () => {
    const { estudiante } = await preparar();

    const primera = await request(app)
      .get('/api/v1/plazas?limit=2&orden=titulo')
      .set('Authorization', bearer(estudiante));
    expect(primera.body.data).toHaveLength(2);
    expect(primera.body.meta).toMatchObject({
      total: 3,
      pagina: 1,
      totalPaginas: 2,
      anterior: null,
    });
    expect(primera.body.meta.siguiente).toContain('page=2');

    const segunda = await request(app)
      .get(primera.body.meta.siguiente)
      .set('Authorization', bearer(estudiante));
    expect(segunda.body.data.map((p: { titulo: string }) => p.titulo)).toEqual(['Soporte Técnico']);
    expect(segunda.body.meta.siguiente).toBeNull();
  });

  it('rechaza parámetros no válidos', async () => {
    const { estudiante } = await preparar();
    const res = await request(app)
      .get('/api/v1/plazas?limit=500')
      .set('Authorization', bearer(estudiante));
    expect(res.status).toBe(400);
  });

  it('devuelve las opciones del panel de filtros', async () => {
    const { estudiante } = await preparar();
    const res = await request(app)
      .get('/api/v1/plazas/filtros')
      .set('Authorization', bearer(estudiante));
    expect(res.body.areas).toEqual(['Datos', 'Desarrollo de software']);
    expect(res.body.ubicaciones).toEqual(['León', 'Managua']);
  });
});

describe('GET /api/v1/plazas/mias', () => {
  it('devuelve solo las plazas de la organización del representante, en todos sus estados', async () => {
    const periodo = await crearPeriodoActivo();
    const { organizacion, representante } = await crearOrganizacion();
    const { organizacion: otra } = await crearOrganizacion();
    await crearPlaza(organizacion.id, periodo.id);
    await crearPlaza(organizacion.id, periodo.id, {
      estado: 'RECHAZADA',
      motivoRechazo: 'No aplica',
    });
    await crearPlaza(otra.id, periodo.id);

    const res = await request(app)
      .get('/api/v1/plazas/mias')
      .set('Authorization', bearer(representante));

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(2);
  });
});

describe('API pública GET /api/v1/publico/plazas (RF-26)', () => {
  it('no requiere autenticación, admite cualquier origen y oculta datos internos', async () => {
    const periodo = await crearPeriodoActivo();
    const { organizacion } = await crearOrganizacion();
    await crearPlaza(organizacion.id, periodo.id);
    await crearPlaza(organizacion.id, periodo.id, { estado: 'EN_REVISION' });

    const res = await request(app)
      .get('/api/v1/publico/plazas')
      .set('Origin', 'https://otro-sistema.example');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.body.meta.total).toBe(1);
    const [plaza] = res.body.data;
    expect(plaza).toMatchObject({ cuposDisponibles: 2, periodo: 'II Semestre 2026' });
    expect(plaza).not.toHaveProperty('estado');
    expect(plaza).not.toHaveProperty('motivoRechazo');
    expect(plaza.organizacion).not.toHaveProperty('id');
  });
});

describe('Documentación OpenAPI', () => {
  it('publica la especificación OpenAPI 3.1 con los endpoints del API', async () => {
    const res = await request(app).get('/api/docs/openapi.json');

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.1.0');
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining([
        '/auth/login',
        '/organizaciones',
        '/plazas',
        '/plazas/{id}/aprobar',
        '/publico/plazas',
      ]),
    );
  });

  it('sirve Swagger UI', async () => {
    const res = await request(app).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });
});
