import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';
import {
  bearer,
  crearOrganizacion,
  crearPeriodoActivo,
  crearPlaza,
  crearUsuario,
} from '../../test/fabricas.js';
import { limpiarBaseDatos } from '../../test/helpers.js';

const app = crearApp();

beforeEach(limpiarBaseDatos);
afterAll(() => prisma.$disconnect());

describe('GET /api/v1/auditoria (RNF-13)', () => {
  it('el administrador consulta los registros con filtros; incluye usuario e IP de la petición', async () => {
    const periodo = await crearPeriodoActivo();
    const { organizacion } = await crearOrganizacion();
    const plaza = await crearPlaza(organizacion.id, periodo.id, { estado: 'EN_REVISION' });
    const coordinador = await crearUsuario('COORDINADOR');
    const admin = await crearUsuario('ADMIN');

    await request(app)
      .patch(`/api/v1/plazas/${plaza.id}/aprobar`)
      .set('Authorization', bearer(coordinador));

    const res = await request(app)
      .get(`/api/v1/auditoria?entidad=Plaza&entidadId=${plaza.id}`)
      .set('Authorization', bearer(admin));

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0]).toMatchObject({
      accion: 'APROBAR',
      usuario: { id: coordinador.id, rol: 'COORDINADOR' },
      valoresAnteriores: { estado: 'EN_REVISION' },
      valoresNuevos: { estado: 'APROBADA' },
    });
    expect(res.body.data[0].ip).toBeTruthy();
  });

  it('solo la administración puede consultarla', async () => {
    const coordinador = await crearUsuario('COORDINADOR');
    const res = await request(app)
      .get('/api/v1/auditoria')
      .set('Authorization', bearer(coordinador));
    expect(res.status).toBe(403);
  });

  it('la bitácora de auditoría es inmutable en la base de datos', async () => {
    const registro = await prisma.auditoria.create({
      data: { entidad: 'Prueba', entidadId: '1', accion: 'CREAR' },
    });

    await expect(
      prisma.auditoria.update({ where: { id: registro.id }, data: { accion: 'OTRA' } }),
    ).rejects.toThrow(/inmutable/);
    await expect(prisma.auditoria.delete({ where: { id: registro.id } })).rejects.toThrow(
      /inmutable/,
    );
  });
});
